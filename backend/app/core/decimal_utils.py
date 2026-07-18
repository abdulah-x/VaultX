"""Shared helper for serializing Decimal-valued API responses without precision loss."""
from decimal import Decimal


def stringify_decimals(obj):
    """Recursively convert Decimal values to strings for JSON output.

    Monetary columns are stored as DECIMAL(20,8); casting them to float on the
    way out (float(value)) silently loses precision (e.g. 0.1+0.2 drift). Emitting
    them as strings preserves the exact stored value. Applied to the whole
    response at the end so internal math/sorting still runs on real Decimals.
    """
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, dict):
        return {k: stringify_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [stringify_decimals(v) for v in obj]
    return obj
