"""
Dollar-Cost Averaging (DCA) backtester — the math behind the Auto-Invest Plan Builder.

Given a series of daily closes from `price_history` (via `mpt.get_daily_prices`),
simulate what a recurring fixed-size buy would actually have produced over that
window, and compare it against deploying the same total capital in one lump sum
on day one.

Everything here is a pure function over a pandas Series — no DB, no I/O — so the
router stays thin and the math is unit-testable in isolation (same split as
`mpt.py` vs `api/portfolio_analytics.py`).

Honesty note: this is a *backtest*, not a forecast. The lump-sum baseline is
reported even when it wins, which in a rising window it usually does. DCA's real
selling point is a lower variance of outcomes, not a higher expected return.
"""
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# Contribution cadence, in days between buys.
FREQUENCIES: Dict[str, int] = {
    "daily": 1,
    "weekly": 7,
    "biweekly": 14,
    "monthly": 30,
}

# Recurring-buy presets are ranked over this cadence set.
PRESET_FREQUENCIES: List[str] = ["daily", "weekly", "biweekly", "monthly"]


def _to_decimal(value: Any) -> Decimal:
    """pandas hands back numpy floats; go through str so we don't inherit binary noise."""
    return Decimal(str(value))


def _percent(numerator: Decimal, denominator: Decimal) -> Decimal:
    if denominator == 0:
        return Decimal("0")
    return (numerator / denominator) * Decimal("100")


def simulate_dca(
    prices: pd.Series,
    contribution: Decimal,
    frequency: str = "weekly",
) -> Optional[Dict[str, Any]]:
    """Simulate buying `contribution` worth of an asset every `frequency` interval.

    `prices` is a day-indexed Series of closing prices (ascending). Returns None if
    the series is too short or the frequency is unknown — callers surface that as a
    graceful note rather than an error.
    """
    if frequency not in FREQUENCIES:
        return None

    prices = prices.dropna().sort_index()
    if len(prices) < 2:
        return None

    step = FREQUENCIES[frequency]

    units = Decimal("0")
    invested = Decimal("0")
    buys: List[Dict[str, Any]] = []

    # Buy on day 0, then every `step` days thereafter. Positional stepping (rather
    # than calendar arithmetic) means gaps in coverage don't silently skip a buy.
    for position in range(0, len(prices), step):
        price = _to_decimal(prices.iloc[position])
        if price <= 0:
            continue
        units += contribution / price
        invested += contribution
        buys.append({"date": str(prices.index[position]), "price": price})

    if invested == 0:
        return None

    final_price = _to_decimal(prices.iloc[-1])
    final_value = units * final_price
    profit = final_value - invested

    return {
        "frequency": frequency,
        "contribution_per_buy": contribution,
        "contributions_count": len(buys),
        "total_invested": invested,
        "units_accumulated": units,
        "average_cost_basis": invested / units,
        "final_price": final_price,
        "final_value": final_value,
        "profit_usd": profit,
        "roi_percent": _percent(profit, invested),
        "first_buy": buys[0]["date"],
        "last_buy": buys[-1]["date"],
    }


def simulate_lump_sum(prices: pd.Series, total_amount: Decimal) -> Optional[Dict[str, Any]]:
    """The baseline: deploy `total_amount` entirely at the first close in the window."""
    prices = prices.dropna().sort_index()
    if len(prices) < 2:
        return None

    entry_price = _to_decimal(prices.iloc[0])
    if entry_price <= 0:
        return None

    units = total_amount / entry_price
    final_price = _to_decimal(prices.iloc[-1])
    final_value = units * final_price
    profit = final_value - total_amount

    return {
        "strategy": "lump_sum",
        "total_invested": total_amount,
        "units_accumulated": units,
        "average_cost_basis": entry_price,
        "entry_price": entry_price,
        "final_price": final_price,
        "final_value": final_value,
        "profit_usd": profit,
        "roi_percent": _percent(profit, total_amount),
    }


def rank_presets(prices: pd.Series, contribution: Decimal) -> List[Dict[str, Any]]:
    """Run every preset cadence over the same window, best ROI first.

    Note the cadences are *not* capital-matched — a daily plan at the same
    per-buy contribution deploys far more total capital than a monthly one. Each
    result carries its own `total_invested` so the comparison stays readable, and
    `roi_percent` is the like-for-like figure to rank on.
    """
    results = []
    for frequency in PRESET_FREQUENCIES:
        result = simulate_dca(prices, contribution, frequency)
        if result:
            results.append(result)

    return sorted(results, key=lambda r: r["roi_percent"], reverse=True)
