"""
Builds the "RAG" context for the portfolio advisor: the current user's own
holdings, realized P&L, and recent trades, read straight from stored DB
columns (no live Binance calls - fast, deterministic, no rate-limit risk).

Every query below is filtered by user_id, so it is structurally impossible
for one user's context to include another user's rows.
"""
from decimal import Decimal
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Asset, CurrentPrice, Holding, Trade
from services.analytics import mpt

RECENT_TRADES_LIMIT = 20


def _fmt(value) -> str:
    if value is None:
        return "0"
    return str(Decimal(str(value)))


def build_portfolio_context(db: Session, user_id: int) -> tuple[str, List[str]]:
    """Returns (context_text, referenced_symbols)."""

    holdings_rows = (
        db.query(Holding, Asset.symbol, CurrentPrice.price_usd)
        .join(Asset, Holding.asset_id == Asset.id)
        .outerjoin(CurrentPrice, Asset.id == CurrentPrice.asset_id)
        .filter(Holding.user_id == user_id, Holding.total_quantity > 0)
        .all()
    )

    if not holdings_rows:
        return (
            "The user currently has no holdings recorded in their portfolio.",
            [],
        )

    asset_ids = [holding.asset_id for holding, _symbol, _price in holdings_rows]
    realized_rows = (
        db.query(Trade.base_asset_id, func.sum(Trade.realized_pnl_usd))
        .filter(
            Trade.user_id == user_id,
            Trade.realized_pnl_usd.isnot(None),
            Trade.base_asset_id.in_(asset_ids),
        )
        .group_by(Trade.base_asset_id)
        .all()
    )
    realized_by_asset = {asset_id: total for asset_id, total in realized_rows}

    recent_trades = (
        db.query(Trade)
        .filter(Trade.user_id == user_id)
        .order_by(Trade.executed_at.desc())
        .limit(RECENT_TRADES_LIMIT)
        .all()
    )

    symbols: List[str] = []
    total_value = Decimal("0")
    total_cost = Decimal("0")
    lines = ["User's current holdings:"]

    for holding, symbol, current_price in holdings_rows:
        symbols.append(symbol)
        qty = holding.total_quantity or Decimal("0")
        avg_cost = holding.average_cost_usd or Decimal("0")
        price = Decimal(str(current_price)) if current_price is not None else (holding.current_price_usd or Decimal("0"))
        value = qty * price
        cost_basis = qty * avg_cost
        unrealized_pct = holding.unrealized_pnl_percentage
        realized = realized_by_asset.get(holding.asset_id, Decimal("0")) or Decimal("0")

        total_value += value
        total_cost += cost_basis

        lines.append(
            f"- {symbol}: qty={_fmt(qty)}, avg_buy_price=${_fmt(avg_cost)}, "
            f"current_price=${_fmt(price)}, current_value=${_fmt(value)}, "
            f"unrealized_pnl_pct={_fmt(unrealized_pct)}%, realized_pnl=${_fmt(realized)}"
        )

    total_unrealized = total_value - total_cost
    lines.append(
        f"Portfolio total: value=${_fmt(total_value)}, cost_basis=${_fmt(total_cost)}, "
        f"unrealized_pnl=${_fmt(total_unrealized)}"
    )

    # Risk metrics (Phase 7): volatility per asset + a portfolio-level Sharpe
    # ratio, computed from real price history. If we don't have enough distinct
    # trading days yet, say so plainly rather than inventing numbers — same
    # "be honest about missing data" pattern as the zero-holdings case above.
    lines.append("\nRisk metrics:")
    returns_df = mpt.get_daily_returns(db, asset_ids)
    if len(returns_df) < mpt.MIN_TRADING_DAYS:
        lines.append(
            "- Not enough price history yet to compute volatility/Sharpe "
            "(need at least a couple of distinct trading days)."
        )
    else:
        if total_value > 0:
            current_weights = {}
            for holding, symbol, current_price in holdings_rows:
                qty = holding.total_quantity or Decimal("0")
                price = Decimal(str(current_price)) if current_price is not None else (holding.current_price_usd or Decimal("0"))
                current_weights[symbol] = float((qty * price) / total_value)
        else:
            n = len(holdings_rows)
            current_weights = {symbol: 1.0 / n for _h, symbol, _p in holdings_rows}

        vol = mpt.annualized_volatility(returns_df)
        stats = mpt.portfolio_stats(returns_df, current_weights)
        lines.append(f"- Based on {len(returns_df)} days of price history.")
        for symbol, v in vol.items():
            lines.append(f"- {symbol}: annualized_volatility={v:.2%}")
        lines.append(
            f"- Portfolio (current allocation): expected_annual_return={stats['expected_annual_return']:.2%}, "
            f"annual_volatility={stats['annual_volatility']:.2%}, sharpe_ratio={stats['sharpe_ratio']:.2f}"
        )

    if recent_trades:
        lines.append(f"\nMost recent trades (up to {RECENT_TRADES_LIMIT}):")
        for trade in recent_trades:
            lines.append(
                f"- {trade.executed_at.isoformat()}: {trade.side} {_fmt(trade.quantity)} "
                f"{trade.symbol} @ ${_fmt(trade.price)}"
            )
    else:
        lines.append("\nNo trade history recorded.")

    return "\n".join(lines), symbols
