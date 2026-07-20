"""
Trade-history statistics — FIFO holding-time analysis.

Complements the win-rate/realized-P&L stats already in pnl.py. This computes how
long positions are held on average, by matching each SELL against the oldest open
BUY lots for that symbol (same FIFO idea as advanced_pnl.py's trade-based P&L).
"""
from collections import defaultdict, deque
from typing import Dict, Optional


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
