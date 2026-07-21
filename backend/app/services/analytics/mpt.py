"""
Modern Portfolio Theory (MPT) analytics — the shared math behind both the
`/api/portfolio/optimize` endpoint and the advisor's risk-metrics context.

Everything here is derived from the `price_history` hypertable (Phase 6): we
turn stored daily closes into a per-asset daily-return series, then compute
volatility, Sharpe ratio, and the risk/reward-optimal weight mix. Built once
and reused so the two callers can't drift apart.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from sqlalchemy.orm import Session

from database.models import Asset, PriceHistory

logger = logging.getLogger(__name__)

# Need at least two distinct trading days to compute a single daily return; a
# covariance matrix needs more, but below this we can't do anything at all.
MIN_TRADING_DAYS = 2

# Standard finance conventions.
TRADING_DAYS_PER_YEAR = 252
RISK_FREE_RATE = 0.0  # crypto has no meaningful risk-free rate; keep it simple.


def get_daily_prices(db: Session, asset_ids: List[int], lookback_days: int = 90) -> pd.DataFrame:
    """Wide DataFrame of daily closing prices: one column per asset symbol, one row per day.

    Buckets `price_history` to a single closing price per asset per calendar day and
    pivots to (day x symbol). Shared by the returns/covariance math below and by the
    DCA backtester in `dca.py`, which needs the raw price levels rather than returns.
    """
    if not asset_ids:
        return pd.DataFrame()

    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    rows = (
        db.query(PriceHistory.asset_id, PriceHistory.timestamp, PriceHistory.price_usd, Asset.symbol)
        .join(Asset, PriceHistory.asset_id == Asset.id)
        .filter(PriceHistory.asset_id.in_(asset_ids), PriceHistory.timestamp >= cutoff)
        .all()
    )

    if not rows:
        return pd.DataFrame()

    frame = pd.DataFrame(
        [
            {"symbol": symbol, "day": ts.date(), "price": float(price)}
            for _asset_id, ts, price, symbol in rows
        ]
    )

    # One closing price per asset per day (last tick of the day wins), then pivot wide.
    daily_close = frame.sort_values("day").groupby(["symbol", "day"])["price"].last().reset_index()
    wide = daily_close.pivot(index="day", columns="symbol", values="price").sort_index()

    # Forward-fill gaps so a missing day for one asset doesn't nuke every row,
    # then drop any leading rows still incomplete before the first common day.
    wide = wide.ffill().dropna()

    return wide


def get_daily_returns(db: Session, asset_ids: List[int], lookback_days: int = 90) -> pd.DataFrame:
    """Wide DataFrame of daily returns (one column per asset symbol, one row per day).

    Returns an empty/short frame if coverage is thin — callers must check `len(df)`
    against MIN_TRADING_DAYS rather than assume a usable covariance matrix.
    """
    prices = get_daily_prices(db, asset_ids, lookback_days=lookback_days)
    if prices.empty:
        return prices
    return prices.pct_change().dropna()


def annualized_volatility(returns_df: pd.DataFrame) -> Dict[str, float]:
    """Per-asset annualized volatility (daily std scaled by sqrt(252))."""
    if returns_df.empty:
        return {}
    vol = returns_df.std() * np.sqrt(TRADING_DAYS_PER_YEAR)
    return {symbol: float(v) for symbol, v in vol.items()}


def portfolio_stats(returns_df: pd.DataFrame, weights: Dict[str, float]) -> Dict[str, float]:
    """Annualized return, volatility, and Sharpe ratio for a given weight mix.

    Used both to score the optimizer's result and to score the user's *current*
    allocation for a side-by-side comparison.
    """
    if returns_df.empty:
        return {"expected_annual_return": 0.0, "annual_volatility": 0.0, "sharpe_ratio": 0.0}

    symbols = list(returns_df.columns)
    w = np.array([weights.get(s, 0.0) for s in symbols])
    total = w.sum()
    if total > 0:
        w = w / total  # normalize so weights sum to 1

    mean_daily = returns_df.mean().values
    cov_daily = returns_df.cov().values

    expected_return = float(np.dot(w, mean_daily) * TRADING_DAYS_PER_YEAR)
    variance = float(np.dot(w, np.dot(cov_daily, w)) * TRADING_DAYS_PER_YEAR)
    volatility = float(np.sqrt(variance)) if variance > 0 else 0.0
    sharpe = (expected_return - RISK_FREE_RATE) / volatility if volatility > 0 else 0.0

    return {
        "expected_annual_return": expected_return,
        "annual_volatility": volatility,
        "sharpe_ratio": float(sharpe),
    }


def optimize_weights(returns_df: pd.DataFrame) -> Dict[str, float]:
    """Find the weight mix that maximizes the Sharpe ratio (bounded [0,1], sum=1).

    scipy only minimizes, so we minimize the negative Sharpe. Falls back to an
    equal-weight mix if the solver fails to converge.
    """
    symbols = list(returns_df.columns)
    n = len(symbols)
    if n == 0:
        return {}
    if n == 1:
        return {symbols[0]: 1.0}

    mean_daily = returns_df.mean().values
    cov_daily = returns_df.cov().values

    def negative_sharpe(w: np.ndarray) -> float:
        exp_return = np.dot(w, mean_daily) * TRADING_DAYS_PER_YEAR
        variance = np.dot(w, np.dot(cov_daily, w)) * TRADING_DAYS_PER_YEAR
        vol = np.sqrt(variance)
        if vol <= 0:
            return 0.0
        return -(exp_return - RISK_FREE_RATE) / vol

    constraints = ({"type": "eq", "fun": lambda w: np.sum(w) - 1.0},)
    bounds = tuple((0.0, 1.0) for _ in range(n))
    initial = np.array([1.0 / n] * n)

    result = minimize(
        negative_sharpe, initial, method="SLSQP", bounds=bounds, constraints=constraints
    )

    if not result.success:
        logger.warning("MPT optimizer did not converge: %s — falling back to equal weights", result.message)
        return {symbol: 1.0 / n for symbol in symbols}

    weights = {symbol: float(round(w, 6)) for symbol, w in zip(symbols, result.x)}
    return weights
