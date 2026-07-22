"""
Trade-history statistics — holding time, win rate, and fee breakdown.

The three things you want to know about your own trading: how long you hold, how
often you're right, and what it costs you. Each is a pure function over a list of
Trade rows so `/api/trades/analysis` can present them together, and so the
`pnl.py` and `/trades/fees` surfaces can reuse the same math rather than
maintaining a second copy of it.

Money stays Decimal throughout; callers stringify at the response boundary via
`core.decimal_utils.stringify_decimals`.
"""
from collections import defaultdict, deque
from decimal import Decimal
from typing import Dict, Optional

# Fees are charged in whatever asset Binance picked; these are treated as $1.
STABLECOINS = {"USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP"}

# Binance discounts spot fees ~25% when they're paid in BNB.
BNB_DISCOUNT_RATE = Decimal("0.25")


def average_holding_times(trades) -> Dict:
    """Average holding duration in days, per symbol and overall.

    FIFO: each SELL consumes the oldest open BUY lots for its symbol; each matched
    sub-lot contributes (sell_time - buy_time) weighted by the matched quantity.
    Only realized (closed) quantity produces a holding time — quantity still held
    open is ignored. `overall_avg_days` is null when nothing has been sold yet.

    Expects trade objects with `.symbol`, `.side`, `.quantity`, `.executed_at`.
    Durations are plain floats (time, not money) so they're exempt from the
    Decimal-string money convention.
    """
    by_symbol = defaultdict(list)
    for t in trades:
        by_symbol[t.symbol].append(t)

    per_symbol: Dict[str, float] = {}
    total_weighted_days = 0.0
    total_matched_qty = 0.0

    for symbol, symbol_trades in by_symbol.items():
        ordered = sorted(symbol_trades, key=lambda x: x.executed_at)
        open_lots = deque()  # each entry: [remaining_qty, buy_time]
        sym_weighted = 0.0
        sym_qty = 0.0

        for t in ordered:
            qty = float(t.quantity or 0)
            if t.side == "BUY":
                open_lots.append([qty, t.executed_at])
            elif t.side == "SELL":
                remaining = qty
                while remaining > 1e-12 and open_lots:
                    lot = open_lots[0]
                    matched = min(remaining, lot[0])
                    days = (t.executed_at - lot[1]).total_seconds() / 86400.0
                    sym_weighted += days * matched
                    sym_qty += matched
                    lot[0] -= matched
                    remaining -= matched
                    if lot[0] <= 1e-12:
                        open_lots.popleft()

        if sym_qty > 0:
            per_symbol[symbol] = round(sym_weighted / sym_qty, 4)
            total_weighted_days += sym_weighted
            total_matched_qty += sym_qty

    overall: Optional[float] = (
        round(total_weighted_days / total_matched_qty, 4) if total_matched_qty > 0 else None
    )
    return {"per_symbol": per_symbol, "overall_avg_days": overall}


def win_rate(trades) -> Dict:
    """Win rate and average win/loss over trades that have a realized P&L.

    Only closed positions count: a trade with `realized_pnl_usd` of None hasn't
    been matched to a disposal yet, and scoring it as a loss would understate the
    win rate. Break-even trades (exactly 0) are counted as neither win nor loss
    but stay in `realized_trades`, so the three buckets sum to the total.
    """
    realized = [t for t in trades if t.realized_pnl_usd is not None]
    wins = [t for t in realized if t.realized_pnl_usd > 0]
    losses = [t for t in realized if t.realized_pnl_usd < 0]

    total_win = sum((t.realized_pnl_usd for t in wins), Decimal("0"))
    total_loss = sum((t.realized_pnl_usd for t in losses), Decimal("0"))

    rate = (Decimal(len(wins)) / Decimal(len(realized)) * 100) if realized else None

    # How much you make when right vs. lose when wrong — a win rate alone can
    # hide many small wins funding a few large losses.
    avg_win = (total_win / len(wins)) if wins else Decimal("0")
    avg_loss = (total_loss / len(losses)) if losses else Decimal("0")
    profit_factor = (total_win / abs(total_loss)) if total_loss < 0 else None

    return {
        "realized_trades": len(realized),
        "unrealized_trades": len(trades) - len(realized),
        "wins": len(wins),
        "losses": len(losses),
        "breakeven": len(realized) - len(wins) - len(losses),
        "win_rate_percent": rate,
        "total_realized_pnl_usd": total_win + total_loss,
        "average_win_usd": avg_win,
        "average_loss_usd": avg_loss,
        "profit_factor": profit_factor,
    }


def fee_breakdown(trades, price_by_symbol: Dict[str, Decimal]) -> Dict:
    """Total fees with a maker/taker split, grouped by the asset they were paid in.

    `price_by_symbol` maps a commission asset to its USD price; stablecoins are
    assumed to be $1 and don't need an entry. A fee in an asset with no known
    price is still counted in `by_asset` (the amount is real) but excluded from
    USD totals, and the asset is named in `unpriced_assets` so the omission is
    visible rather than silently understating the total.

    Trades with no maker/taker flag land in `unknown_maker_taker_usd` instead of
    being guessed into one bucket.
    """
    maker_usd = Decimal("0")
    taker_usd = Decimal("0")
    unknown_usd = Decimal("0")
    total_usd = Decimal("0")
    bnb_fees_usd = Decimal("0")
    by_asset: Dict[str, Dict] = {}
    unpriced_assets = set()

    for t in trades:
        commission = t.commission or Decimal("0")
        if commission == 0:
            continue

        asset = t.commission_asset or "UNKNOWN"
        entry = by_asset.setdefault(
            asset, {"amount": Decimal("0"), "usd_value": Decimal("0"), "count": 0}
        )
        entry["amount"] += commission
        entry["count"] += 1

        if asset in STABLECOINS:
            usd = commission
        else:
            price = price_by_symbol.get(asset)
            if price is None:
                unpriced_assets.add(asset)
                continue
            usd = commission * price

        entry["usd_value"] += usd
        total_usd += usd

        if t.is_maker is True:
            maker_usd += usd
        elif t.is_maker is False:
            taker_usd += usd
        else:
            unknown_usd += usd

        if asset == "BNB":
            bnb_fees_usd += usd

    # You paid (1 - 0.25) of the undiscounted fee, so the saving relative to what
    # you actually paid is 0.25/0.75 of it.
    bnb_savings_usd = bnb_fees_usd * (BNB_DISCOUNT_RATE / (1 - BNB_DISCOUNT_RATE))

    return {
        "total_usd": total_usd,
        "maker_usd": maker_usd,
        "taker_usd": taker_usd,
        "unknown_maker_taker_usd": unknown_usd,
        "by_asset": by_asset,
        "bnb": {
            "fees_paid_usd": bnb_fees_usd,
            "estimated_savings_usd": bnb_savings_usd,
            "note": "Estimated ~25% BNB fee discount vs paying in the quote asset.",
        },
        "unpriced_assets": sorted(unpriced_assets),
    }
