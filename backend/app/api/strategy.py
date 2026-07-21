#!/usr/bin/env python3
"""
Auto-Invest Plan Builder — DCA strategy backtesting endpoints.

`GET /api/strategy/dca-backtest` simulates a recurring fixed-size buy for one
symbol over real stored price history, alongside a lump-sum baseline for the same
total capital. `GET /api/strategy/dca-presets` does the same across a grid of
cadences for every asset the caller actually holds, ranked — the "recommended
preset" surface.

The math lives in `services/analytics/dca.py`; price series come from
`services/analytics/mpt.py::get_daily_prices` (shared with the MPT optimizer).
This router only scopes it to the caller and shapes the response.
"""
from decimal import Decimal
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from core.decimal_utils import stringify_decimals
from core.dependencies import get_current_active_user, get_db
from core.errors import ValidationError
from database.models import Asset, Holding, User
from services.analytics import dca, mpt

router = APIRouter()

DISCLAIMER = (
    "This is a backtest over historical price data, not a prediction. Past performance "
    "does not indicate future results. Not financial advice."
)


def _insufficient_note(days: int) -> str:
    return (
        f"Based on {days} day(s) of stored price history — need at least "
        f"{mpt.MIN_TRADING_DAYS} distinct days to simulate. Run the price backfill "
        "or let the live feed accumulate more history."
    )


@router.get("/strategy/dca-backtest", response_model=Dict[str, Any])
async def dca_backtest(
    symbol: str = Query(..., description="Trading symbol, e.g. BTCUSDT"),
    contribution: Decimal = Query(Decimal("100"), gt=0, description="USD amount per recurring buy"),
    frequency: str = Query("weekly", description="daily | weekly | biweekly | monthly"),
    lookback_days: int = Query(90, ge=7, le=365, description="Days of price history to simulate over"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
):
    """Backtest a recurring-buy plan for one symbol, vs. a lump-sum baseline."""
    if frequency not in dca.FREQUENCIES:
        raise ValidationError(
            f"Unknown frequency '{frequency}'. Valid options: {', '.join(dca.FREQUENCIES)}"
        )

    symbol = symbol.upper()
    asset = db.query(Asset).filter(Asset.symbol == symbol).first()
    if not asset:
        raise ValidationError(f"Unknown symbol: {symbol}")

    prices = mpt.get_daily_prices(db, [asset.id], lookback_days=lookback_days)

    if prices.empty or symbol not in prices.columns or len(prices) < mpt.MIN_TRADING_DAYS:
        return {
            "success": True,
            "symbol": symbol,
            "based_on_days": int(len(prices)),
            "dca": None,
            "lump_sum": None,
            "note": _insufficient_note(int(len(prices))),
            "disclaimer": DISCLAIMER,
        }

    series = prices[symbol]
    dca_result = dca.simulate_dca(series, contribution, frequency)

    if not dca_result:
        return {
            "success": True,
            "symbol": symbol,
            "based_on_days": int(len(prices)),
            "dca": None,
            "lump_sum": None,
            "note": _insufficient_note(int(len(prices))),
            "disclaimer": DISCLAIMER,
        }

    # Capital-matched baseline: the same total the DCA plan actually deployed.
    lump_sum_result = dca.simulate_lump_sum(series, dca_result["total_invested"])

    return stringify_decimals({
        "success": True,
        "symbol": symbol,
        "based_on_days": int(len(prices)),
        "lookback_days": lookback_days,
        "dca": dca_result,
        "lump_sum": lump_sum_result,
        "note": None,
        "disclaimer": DISCLAIMER,
    })


@router.get("/strategy/dca-presets", response_model=Dict[str, Any])
async def dca_presets(
    contribution: Decimal = Query(Decimal("100"), gt=0, description="USD amount per recurring buy"),
    lookback_days: int = Query(90, ge=7, le=365, description="Days of price history to simulate over"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
):
    """Rank every DCA cadence across the caller's held assets and recommend a preset."""
    # Held assets — same Holding+Asset join used across pnl.py / portfolio_analytics.py.
    holdings_rows = (
        db.query(Asset.id, Asset.symbol)
        .join(Holding, Holding.asset_id == Asset.id)
        .filter(Holding.user_id == current_user.id, Holding.total_quantity > 0)
        .all()
    )

    if not holdings_rows:
        return {
            "success": True,
            "assets": [],
            "note": "No holdings to build a plan for.",
            "disclaimer": DISCLAIMER,
        }

    asset_ids = [asset_id for asset_id, _ in holdings_rows]
    prices = mpt.get_daily_prices(db, asset_ids, lookback_days=lookback_days)
    based_on_days = int(len(prices))

    assets = []
    for _asset_id, symbol in holdings_rows:
        if prices.empty or symbol not in prices.columns or based_on_days < mpt.MIN_TRADING_DAYS:
            assets.append({
                "symbol": symbol,
                "presets": [],
                "recommended": None,
                "note": _insufficient_note(based_on_days),
            })
            continue

        ranked = dca.rank_presets(prices[symbol], contribution)
        assets.append({
            "symbol": symbol,
            "presets": ranked,
            "recommended": ranked[0] if ranked else None,
            "note": None,
        })

    return stringify_decimals({
        "success": True,
        "based_on_days": based_on_days,
        "lookback_days": lookback_days,
        "contribution_per_buy": contribution,
        "assets": assets,
        "note": None,
        "disclaimer": DISCLAIMER,
    })
