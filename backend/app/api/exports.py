"""
Tax & audit exports — CSV / PDF downloads of spot history.

Two endpoints:
- /api/export/transactions : the user's stored trades (always available).
- /api/export/tax          : trades + deposits + withdrawals, laid out for tax.
  Deposits/withdrawals are fetched live from Binance and are best-effort — on
  testnet they're usually empty (the export structure is still correct). Binance
  "convert" history isn't reliably exposed by python-binance 1.0.19, so
  conversions are out of scope this cut.
"""
import csv
import io
import logging
from datetime import datetime

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


def _trade_rows(db: Session, user_id: int):
    trades = (
        db.query(Trade).filter(Trade.user_id == user_id).order_by(Trade.executed_at).all()
    )
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


def _pdf_response(title, columns, rows, filename):
    from fpdf import FPDF

    pdf = FPDF(orientation="L")
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 7)
    col_w = (pdf.w - 20) / len(columns)
    for c in columns:
        pdf.cell(col_w, 6, str(c)[:20], border=1)
    pdf.ln()
    pdf.set_font("Helvetica", "", 7)
    for r in rows:
        for c in columns:
            pdf.cell(col_w, 5, str(r.get(c, ""))[:20], border=1)
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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Download the user's full trade history as CSV or PDF."""
    rows = list(_trade_rows(db, current_user.id))
    fname = f"vaultx_transactions_{datetime.utcnow():%Y%m%d}.{format}"
    if format == "csv":
        return _csv_response(TRADE_COLUMNS, rows, fname)
    return _pdf_response("VaultX Transactions", TRADE_COLUMNS, rows, fname)


@router.get("/export/tax")
async def export_tax(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Download a tax/audit sheet: trades + (best-effort) deposits & withdrawals."""
    rows = []

    # Trades (always available, from our own DB).
    for t in _trade_rows(db, current_user.id):
        rows.append({
            "record_type": "TRADE",
            "datetime": t["executed_at"],
            "asset": t["symbol"],
            "amount": t["quantity"],
            "fee": f'{t["commission"]} {t["commission_asset"]}'.strip(),
            "status": "FILLED",
            "reference": t["side"],
        })

    # Deposits / withdrawals — live from Binance, best-effort (testnet may return
    # empty or error; the export must still succeed with trades).
    client = BinanceClientManager().get_client()
    if client:
        try:
            deposits = await run_sync(client.get_deposit_history) or []
            for d in (deposits if isinstance(deposits, list) else deposits.get("depositList", [])):
                ts = d.get("insertTime")
                rows.append({
                    "record_type": "DEPOSIT",
                    "datetime": datetime.utcfromtimestamp(ts / 1000).isoformat() if ts else "",
                    "asset": d.get("coin", ""),
                    "amount": str(d.get("amount", "")),
                    "fee": "",
                    "status": str(d.get("status", "")),
                    "reference": d.get("txId", ""),
                })
        except Exception as e:
            logger.warning("Deposit history unavailable for tax export: %s", e)
        try:
            withdrawals = await run_sync(client.get_withdraw_history) or []
            for w in (withdrawals if isinstance(withdrawals, list) else withdrawals.get("withdrawList", [])):
                ts = w.get("applyTime")
                # applyTime can be a ms int or a formatted string depending on API version.
                dt = ""
                if isinstance(ts, (int, float)):
                    dt = datetime.utcfromtimestamp(ts / 1000).isoformat()
                elif ts:
                    dt = str(ts)
                rows.append({
                    "record_type": "WITHDRAWAL",
                    "datetime": dt,
                    "asset": w.get("coin", ""),
                    "amount": str(w.get("amount", "")),
                    "fee": str(w.get("transactionFee", "")),
                    "status": str(w.get("status", "")),
                    "reference": str(w.get("id", "")),
                })
        except Exception as e:
            logger.warning("Withdrawal history unavailable for tax export: %s", e)

    fname = f"vaultx_tax_{datetime.utcnow():%Y%m%d}.{format}"
    if format == "csv":
        return _csv_response(TAX_COLUMNS, rows, fname)
    return _pdf_response("VaultX Tax & Audit Export", TAX_COLUMNS, rows, fname)
