"""
Tax & audit exports — CSV / PDF downloads of spot history.

Two endpoints:
- /api/export/transactions : the user's stored trades (always available).
- /api/export/tax          : trades + deposits + withdrawals + conversions,
  laid out for tax.

Deposits, withdrawals, and conversions are fetched live from Binance and are
best-effort — on testnet those endpoints return empty or reject the key, and the
export still succeeds with whatever it could gather (a `warnings` header lists
what was unavailable). Conversions cover both the Convert tradeFlow endpoint and
the dust log (small balances swept into BNB), since both are disposals that a
tax report has to account for.

Binance caps convert history at a 30-day window per call and *requires* both
startTime and endTime, so `_convert_rows` pages backwards in 30-day chunks.
"""
import csv
import io
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session

from core.dependencies import get_db, get_current_active_user
from database.models import User, Trade
from services.binance.client import BinanceClientManager, run_sync

router = APIRouter()
logger = logging.getLogger(__name__)

TRADE_COLUMNS = [
    "executed_at", "symbol", "side", "order_type", "quantity", "price",
    "quote_quantity", "commission", "commission_asset", "realized_pnl_usd",
]
TAX_COLUMNS = ["record_type", "datetime", "asset", "amount", "fee", "status", "reference"]

# Binance's convert/tradeFlow endpoint rejects windows wider than 30 days.
CONVERT_WINDOW_DAYS = 30


def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _iso_from_ms(value) -> str:
    """Binance timestamps are ms ints, but some endpoints return preformatted strings."""
    if isinstance(value, (int, float)) and value:
        return datetime.utcfromtimestamp(value / 1000).isoformat()
    return str(value) if value else ""


def _trade_rows(db: Session, user_id: int, start: datetime = None, end: datetime = None):
    query = db.query(Trade).filter(Trade.user_id == user_id)
    if start:
        query = query.filter(Trade.executed_at >= start)
    if end:
        query = query.filter(Trade.executed_at <= end)
    trades = query.order_by(Trade.executed_at).all()
    for t in trades:
        yield {
            "executed_at": t.executed_at.isoformat() if t.executed_at else "",
            "symbol": t.symbol,
            "side": t.side,
            "order_type": t.order_type,
            "quantity": str(t.quantity),
            "price": str(t.price),
            "quote_quantity": str(t.quote_quantity),
            "commission": str(t.commission or 0),
            "commission_asset": t.commission_asset or "",
            "realized_pnl_usd": str(t.realized_pnl_usd) if t.realized_pnl_usd is not None else "",
        }


async def _deposit_rows(client, start: datetime, end: datetime):
    deposits = await run_sync(
        client.get_deposit_history, startTime=_ms(start), endTime=_ms(end)
    ) or []
    if not isinstance(deposits, list):
        deposits = deposits.get("depositList", [])
    return [
        {
            "record_type": "DEPOSIT",
            "datetime": _iso_from_ms(d.get("insertTime")),
            "asset": d.get("coin", ""),
            "amount": str(d.get("amount", "")),
            "fee": "",
            "status": str(d.get("status", "")),
            "reference": d.get("txId", ""),
        }
        for d in deposits
    ]


async def _withdrawal_rows(client, start: datetime, end: datetime):
    withdrawals = await run_sync(
        client.get_withdraw_history, startTime=_ms(start), endTime=_ms(end)
    ) or []
    if not isinstance(withdrawals, list):
        withdrawals = withdrawals.get("withdrawList", [])
    return [
        {
            "record_type": "WITHDRAWAL",
            "datetime": _iso_from_ms(w.get("applyTime")),
            "asset": w.get("coin", ""),
            "amount": str(w.get("amount", "")),
            "fee": str(w.get("transactionFee", "")),
            "status": str(w.get("status", "")),
            "reference": str(w.get("id", "")),
        }
        for w in withdrawals
    ]


async def _convert_rows(client, start: datetime, end: datetime):
    """Convert tradeFlow history, paged in 30-day windows.

    A conversion is a disposal of one asset and an acquisition of another, so it
    emits two rows — CONVERT_OUT and CONVERT_IN — sharing the same quoteId. A tax
    report that recorded only one side would understate either proceeds or basis.
    """
    rows = []
    window_start = start
    while window_start < end:
        window_end = min(window_start + timedelta(days=CONVERT_WINDOW_DAYS), end)
        result = await run_sync(
            client.get_convert_trade_history,
            startTime=_ms(window_start),
            endTime=_ms(window_end),
            limit=100,
        ) or {}
        for c in (result.get("list") or []):
            ts = _iso_from_ms(c.get("createTime"))
            ref = str(c.get("quoteId") or c.get("orderId") or "")
            rows.append({
                "record_type": "CONVERT_OUT",
                "datetime": ts,
                "asset": c.get("fromAsset", ""),
                "amount": str(c.get("fromAmount", "")),
                "fee": "",
                "status": str(c.get("orderStatus", "")),
                "reference": ref,
            })
            rows.append({
                "record_type": "CONVERT_IN",
                "datetime": ts,
                "asset": c.get("toAsset", ""),
                "amount": str(c.get("toAmount", "")),
                "fee": "",
                "status": str(c.get("orderStatus", "")),
                "reference": ref,
            })
        window_start = window_end
    return rows


async def _dust_rows(client, start: datetime, end: datetime):
    """Dust conversions — small balances swept into BNB.

    Structurally the same event as a convert (disposal + acquisition), so it uses
    the same CONVERT_OUT/CONVERT_IN record types rather than inventing a third.
    """
    result = await run_sync(
        client.get_dust_log, startTime=_ms(start), endTime=_ms(end)
    ) or {}
    rows = []
    for dribblet in (result.get("userAssetDribblets") or []):
        for item in (dribblet.get("userAssetDribbletDetails") or []):
            ts = _iso_from_ms(item.get("operateTime"))
            ref = str(item.get("transId", ""))
            rows.append({
                "record_type": "CONVERT_OUT",
                "datetime": ts,
                "asset": item.get("fromAsset", ""),
                "amount": str(item.get("amount", "")),
                "fee": str(item.get("serviceChargeAmount", "")),
                "status": "DUST",
                "reference": ref,
            })
            rows.append({
                "record_type": "CONVERT_IN",
                "datetime": ts,
                "asset": "BNB",
                "amount": str(item.get("transferedAmount", "")),
                "fee": "",
                "status": "DUST",
                "reference": ref,
            })
    return rows


def _csv_response(columns, rows, filename):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _latin1(text) -> str:
    """fpdf's built-in Helvetica is latin-1 only.

    Row data comes from Binance (asset names, txIds, statuses), so a single
    non-latin-1 character anywhere would otherwise raise and 500 the whole
    export. Substitute rather than fail — a mangled character in one cell beats
    losing the report.
    """
    return str(text).encode("latin-1", "replace").decode("latin-1")


def _pdf_response(title, columns, rows, filename):
    from fpdf import FPDF

    pdf = FPDF(orientation="L")
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, _latin1(title), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 7)
    col_w = (pdf.w - 20) / len(columns)
    for c in columns:
        pdf.cell(col_w, 6, _latin1(c)[:20], border=1)
    pdf.ln()
    pdf.set_font("Helvetica", "", 7)
    for r in rows:
        for c in columns:
            pdf.cell(col_w, 5, _latin1(r.get(c, ""))[:20], border=1)
        pdf.ln()
    out = pdf.output()  # fpdf2 returns a bytearray
    data = bytes(out)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/transactions")
async def export_transactions(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    start_date: datetime = Query(None, description="Include trades from this date (ISO 8601)"),
    end_date: datetime = Query(None, description="Include trades up to this date (ISO 8601)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Download the user's trade history as CSV or PDF, optionally date-bounded."""
    rows = list(_trade_rows(db, current_user.id, start_date, end_date))
    fname = f"vaultx_transactions_{datetime.utcnow():%Y%m%d}.{format}"
    if format == "csv":
        return _csv_response(TRADE_COLUMNS, rows, fname)
    return _pdf_response("VaultX Transactions", TRADE_COLUMNS, rows, fname)


@router.get("/export/tax")
async def export_tax(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    start_date: datetime = Query(None, description="Period start (ISO 8601). Defaults to 1 year ago."),
    end_date: datetime = Query(None, description="Period end (ISO 8601). Defaults to now."),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Tax/audit sheet: trades, deposits, withdrawals, and conversions.

    Trades come from our own DB and are always present. The other three are
    fetched live from Binance and are best-effort — each is isolated so one
    failing source can't sink the export. Anything unavailable is named in the
    `X-Export-Warnings` response header.
    """
    end = end_date or datetime.utcnow()
    start = start_date or (end - timedelta(days=365))

    rows = []
    warnings = []

    # Trades (always available, from our own DB).
    for t in _trade_rows(db, current_user.id, start, end):
        rows.append({
            "record_type": "TRADE",
            "datetime": t["executed_at"],
            "asset": t["symbol"],
            "amount": t["quantity"],
            "fee": f'{t["commission"]} {t["commission_asset"]}'.strip(),
            "status": "FILLED",
            "reference": t["side"],
        })

    client = BinanceClientManager().get_client()
    if not client:
        warnings.append("binance_unavailable")
    else:
        sources = [
            ("deposits", _deposit_rows),
            ("withdrawals", _withdrawal_rows),
            ("conversions", _convert_rows),
            ("dust_conversions", _dust_rows),
        ]
        for name, fetch in sources:
            try:
                rows.extend(await fetch(client, start, end))
            except Exception as e:
                logger.warning("Tax export: %s unavailable (%s)", name, e)
                warnings.append(name)

    # Chronological across every record type, so the sheet reads as one ledger.
    rows.sort(key=lambda r: r["datetime"] or "")

    fname = f"vaultx_tax_{datetime.utcnow():%Y%m%d}.{format}"
    title = f"VaultX Tax & Audit Export — {start:%Y-%m-%d} to {end:%Y-%m-%d}"
    if format == "csv":
        response = _csv_response(TAX_COLUMNS, rows, fname)
    else:
        response = _pdf_response(title, TAX_COLUMNS, rows, fname)

    if warnings:
        response.headers["X-Export-Warnings"] = ",".join(warnings)
    return response
