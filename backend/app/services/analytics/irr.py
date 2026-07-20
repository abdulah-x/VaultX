"""
Money-weighted return (XIRR) for a portfolio's dated cash flows.

Separate from mpt.py (which is time-series risk/return over price history); this
is the account-level "Growth Rate (IRR)" — the single annualized rate that makes
the net present value of every buy/sell (plus the current portfolio value as a
final synthetic inflow) equal zero. Uses scipy (already a dependency from
Phase 7) to root-find the rate.
"""
import logging
from datetime import datetime
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)


def annualized_xirr(cashflows: List[Tuple[datetime, float]]) -> Optional[float]:
    """Annualized money-weighted return from dated cash flows.

    Convention: money you put IN is negative (buys), money you take OUT is
    positive (sells, and the current portfolio value as a final inflow at
    "today"). Dates may be naive or aware as long as they're consistent.

    Returns the annualized rate as a decimal (0.12 == 12%), or None when it
    can't be computed: fewer than two flows, no sign change (e.g. only buys and
    a zero current value), all flows on the same day, or the solver failing to
    converge. Callers surface None as `null` rather than inventing a number.
    """
    if len(cashflows) < 2:
        return None

    amounts = [amt for _, amt in cashflows]
    # XIRR needs at least one outflow and one inflow, else there's no root.
    if not (any(a > 0 for a in amounts) and any(a < 0 for a in amounts)):
        return None

    t0 = min(d for d, _ in cashflows)
    years = [(d - t0).days / 365.0 for d, _ in cashflows]
    if all(y == 0 for y in years):
        return None  # everything on one day — can't annualize

    def npv(rate: float) -> float:
        return sum(amt / (1.0 + rate) ** yr for amt, yr in zip(amounts, years))

    # NPV -> +inf as rate -> -1 (future inflows blow up) and goes negative for
    # large rates (only the day-0 outflow survives), so a sign change — and thus
    # a root — is bracketed by [-0.999999, 100.0].
    try:
        from scipy.optimize import brentq
        return float(brentq(npv, -0.999999, 100.0, maxiter=200))
    except Exception:
        try:
            from scipy.optimize import newton
            return float(newton(npv, 0.1, maxiter=200))
        except Exception as e:
            logger.warning("XIRR did not converge: %s", e)
            return None
