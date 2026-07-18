#!/usr/bin/env python3
"""
Portfolio analytics endpoints (Phase 7) — Modern Portfolio Theory optimizer.

`GET /api/portfolio/optimize` compares the user's *current* allocation against
the risk/reward-optimal (max-Sharpe) allocation computed from real price
history, so they can see current-vs-optimal side by side. This is the analysis
layer no aggregation-only tracker offers.

All the math lives in `services/analytics/mpt.py` (shared with the advisor's
risk-metrics context); this router just scopes it to the caller's holdings.
"""
from decimal import Decimal
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from core.dependencies import get_current_active_user, get_db
from database.models import Asset, CurrentPrice, Holding, User
from services.analytics import mpt

router = APIRouter()


@router.get("/portfolio/optimize", response_model=Dict[str, Any])
async def optimize_portfolio(
    lookback_days: int = Query(90, ge=7, le=365, description="Days of price history to analyze"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
):
    """Current vs. MPT-optimal allocation for the user's held assets."""
    # Held assets (same Holding+Asset join used across pnl.py / advisor context).
    holdings_rows = (
        db.query(Holding, Asset.id, Asset.symbol, CurrentPrice.price_usd)
        .join(Asset, Holding.asset_id == Asset.id)
        .outerjoin(CurrentPrice, Asset.id == CurrentPrice.asset_id)
        .filter(Holding.user_id == current_user.id, Holding.total_quantity > 0)
        .all()
    )

    if not holdings_rows:
        return {
            "success": True,
            "based_on_days": 0,
            "current_weights": {},
            "optimal_weights": None,
            "note": "No holdings to optimize.",
        }

    # Current weights from live value (current_value_usd), not the possibly-stale
    # portfolio_percentage column.
    asset_ids = []
    current_value_by_symbol: Dict[str, Decimal] = {}
    for holding, asset_id, symbol, current_price in holdings_rows:
        asset_ids.append(asset_id)
        qty = holding.total_quantity or Decimal("0")
        price = Decimal(str(current_price)) if current_price is not None else (holding.current_price_usd or Decimal("0"))
        current_value_by_symbol[symbol] = qty * price

    total_value = sum(current_value_by_symbol.values()) or Decimal("0")
    if total_value > 0:
        current_weights = {s: float(v / total_value) for s, v in current_value_by_symbol.items()}
    else:
        # No priced value yet — fall back to equal weighting for the "current" side.
        n = len(current_value_by_symbol)
        current_weights = {s: 1.0 / n for s in current_value_by_symbol}

    # A single-asset portfolio has nothing to optimize.
    if len(asset_ids) < 2:
        only_symbol = next(iter(current_value_by_symbol))
        return {
            "success": True,
            "based_on_days": 0,
            "current_weights": {only_symbol: 1.0},
            "optimal_weights": {only_symbol: 1.0},
            "note": "Only one asset held — nothing to optimize.",
        }

    returns_df = mpt.get_daily_returns(db, asset_ids, lookback_days=lookback_days)

    if len(returns_df) < mpt.MIN_TRADING_DAYS:
        return {
            "success": True,
            "based_on_days": int(len(returns_df)),
            "current_weights": current_weights,
            "optimal_weights": None,
            "note": (
                f"Based on {len(returns_df)} day(s) of price history — need at least "
                f"{mpt.MIN_TRADING_DAYS} distinct trading days to optimize. "
                "Run the price backfill or let the live feed accumulate more history."
            ),
        }

    optimal_weights = mpt.optimize_weights(returns_df)
    current_stats = mpt.portfolio_stats(returns_df, current_weights)
    optimal_stats = mpt.portfolio_stats(returns_df, optimal_weights)

    return {
        "success": True,
        "based_on_days": int(len(returns_df)),
        "current_weights": current_weights,
        "optimal_weights": optimal_weights,
        "current_sharpe": current_stats["sharpe_ratio"],
        "optimal_sharpe": optimal_stats["sharpe_ratio"],
        "current_expected_annual_return": current_stats["expected_annual_return"],
        "optimal_expected_annual_return": optimal_stats["expected_annual_return"],
        "current_annual_volatility": current_stats["annual_volatility"],
        "optimal_annual_volatility": optimal_stats["annual_volatility"],
        "per_asset_volatility": mpt.annualized_volatility(returns_df),
        "note": None,
    }
