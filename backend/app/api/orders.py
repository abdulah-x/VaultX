#!/usr/bin/env python3
"""
Binance order lifecycle endpoints (testnet): validate, place, list, and cancel
real Binance orders, plus order/trade history straight from Binance itself.

These place REAL orders against whichever account BINANCE_API_KEY/SECRET
point at (testnet by default, per BINANCE_TESTNET). They do NOT write to
VaultX's own Trade/Holding tables -- use the existing portfolio sync / trade
import flow to pull filled orders into the app's own portfolio view.
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
import logging

from sqlalchemy.orm import Session

from core.dependencies import get_current_active_user, get_db
from core.errors import ExternalAPIError
from database.models import User, Trade, Holding
from services.binance.client import BinanceClientManager, run_sync
from api.trade_import import split_symbol
from api.portfolio_sync import get_or_create_asset

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_client():
    client_manager = BinanceClientManager()
    client = client_manager.get_client()
    if not client:
        raise ExternalAPIError(
            "Binance client not available (check API keys / emergency disable)."
        )
    return client


class OrderRequest(BaseModel):
    symbol: str
    side: str  # BUY / SELL
    order_type: str = Field("MARKET", description="MARKET or LIMIT")
    quantity: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = Field(None, description="Required for LIMIT orders")
    time_in_force: str = "GTC"

    @validator("symbol")
    def uppercase_symbol(cls, v):
        return v.upper()

    @validator("side")
    def validate_side(cls, v):
        v = v.upper()
        if v not in ("BUY", "SELL"):
            raise ValueError("side must be BUY or SELL")
        return v

    @validator("order_type")
    def validate_order_type(cls, v):
        v = v.upper()
        if v not in ("MARKET", "LIMIT"):
            raise ValueError("order_type must be MARKET or LIMIT")
        return v

    @validator("price", always=True)
    def require_price_for_limit(cls, v, values):
        if values.get("order_type") == "LIMIT" and v is None:
            raise ValueError("price is required for LIMIT orders")
        return v


def _order_kwargs(payload: OrderRequest) -> Dict[str, Any]:
    kwargs = {
        "symbol": payload.symbol,
        "side": payload.side,
        "type": payload.order_type,
        "quantity": str(payload.quantity),
    }
    if payload.order_type == "LIMIT":
        kwargs["price"] = str(payload.price)
        kwargs["timeInForce"] = payload.time_in_force
    return kwargs


def _record_fill(db: Session, user_id: int, order_result: Dict[str, Any]) -> Dict[str, Any]:
    """Record an executed order into VaultX's own Trade + Holding tables.

    Without this, placing an order through the app hits Binance but never
    updates the user's portfolio here, so the app's own view silently drifts
    from reality. Only records the filled portion (a resting LIMIT order that
    hasn't traded yet is a no-op until it fills). For a SELL, realized P&L is
    computed against the holding's current average cost.
    """
    executed_qty = Decimal(str(order_result.get("executedQty", "0")))
    if executed_qty <= 0:
        return {"recorded": False, "reason": "order not filled yet"}

    symbol = order_result["symbol"]
    side = order_result.get("side", "BUY")
    base_symbol, quote_symbol = split_symbol(symbol)
    cummulative_quote = Decimal(str(order_result.get("cummulativeQuoteQty", "0")))
    avg_price = (cummulative_quote / executed_qty) if executed_qty > 0 else Decimal("0")

    fills = order_result.get("fills") or []
    total_commission = sum((Decimal(str(f.get("commission", "0"))) for f in fills), Decimal("0"))
    commission_asset = fills[0].get("commissionAsset") if fills else None
    first_trade_id = str(fills[0].get("tradeId")) if fills and fills[0].get("tradeId") is not None else None

    transact_ms = order_result.get("transactTime") or order_result.get("workingTime")
    executed_at = datetime.utcfromtimestamp(transact_ms / 1000) if transact_ms else datetime.utcnow()

    base_asset = get_or_create_asset(db, base_symbol)
    quote_asset = get_or_create_asset(db, quote_symbol)

    holding = (
        db.query(Holding)
        .filter(Holding.user_id == user_id, Holding.asset_id == base_asset.id)
        .first()
    )
    realized_pnl = None

    if side == "BUY":
        if holding is None:
            holding = Holding(
                user_id=user_id, asset_id=base_asset.id,
                total_quantity=Decimal("0"), available_quantity=Decimal("0"),
                locked_quantity=Decimal("0"), average_cost_usd=Decimal("0"),
                total_cost_usd=Decimal("0"),
            )
            db.add(holding)
            db.flush()
            if holding.first_acquired_at is None:
                holding.first_acquired_at = executed_at
        old_qty = holding.total_quantity or Decimal("0")
        old_cost = holding.total_cost_usd or Decimal("0")
        new_qty = old_qty + executed_qty
        new_cost = old_cost + cummulative_quote
        holding.total_quantity = new_qty
        holding.available_quantity = new_qty
        holding.total_cost_usd = new_cost
        holding.average_cost_usd = (new_cost / new_qty) if new_qty > 0 else Decimal("0")
    else:  # SELL
        avg_cost = (holding.average_cost_usd if holding else Decimal("0")) or Decimal("0")
        realized_pnl = (avg_price - avg_cost) * executed_qty
        if holding is not None:
            old_qty = holding.total_quantity or Decimal("0")
            new_qty = old_qty - executed_qty
            if new_qty < 0:
                new_qty = Decimal("0")
            holding.total_quantity = new_qty
            holding.available_quantity = new_qty
            # Cost basis follows the remaining quantity at the unchanged avg cost.
            holding.total_cost_usd = avg_cost * new_qty
            holding.realized_pnl_usd = (holding.realized_pnl_usd or Decimal("0")) + realized_pnl

    if holding is not None:
        holding.last_transaction_at = executed_at

    trade = Trade(
        user_id=user_id,
        binance_order_id=str(order_result.get("orderId", "")),
        binance_trade_id=first_trade_id,
        symbol=symbol,
        base_asset_id=base_asset.id,
        quote_asset_id=quote_asset.id,
        side=side,
        order_type=order_result.get("type", "MARKET"),
        quantity=executed_qty,
        price=avg_price,
        quote_quantity=cummulative_quote,
        commission=total_commission,
        commission_asset=commission_asset,
        status=order_result.get("status", "FILLED"),
        executed_at=executed_at,
        realized_pnl_usd=realized_pnl,
        import_source="order_endpoint",
    )
    db.add(trade)
    db.commit()

    return {
        "recorded": True,
        "trade_id": trade.id,
        "executed_qty": str(executed_qty),
        "avg_price": str(avg_price),
        "realized_pnl_usd": str(realized_pnl) if realized_pnl is not None else None,
    }


@router.post("/orders/test", response_model=Dict[str, Any])
async def validate_order(
    payload: OrderRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Dry-run order validation -- checks the order against exchange rules without executing it."""
    client = _get_client()
    await run_sync(client.create_test_order, **_order_kwargs(payload))
    return {
        "success": True,
        "valid": True,
        "message": "Order passes exchange validation (not executed).",
        "order": payload.dict(),
    }


@router.post("/orders", response_model=Dict[str, Any])
async def place_order(
    payload: OrderRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Place a real order against the configured Binance account (testnet by default).

    On a fill, the trade is also recorded into VaultX's own Trade/Holding tables
    so the app's portfolio view stays in sync. Recording is best-effort: the
    order has already executed on Binance, so a bookkeeping error is reported in
    `portfolio_update` rather than raised (which would wrongly imply the order failed).
    """
    client = _get_client()
    result = await run_sync(client.create_order, **_order_kwargs(payload))

    try:
        portfolio_update = _record_fill(db, current_user.id, result)
    except Exception as e:
        db.rollback()
        logger.error("Failed to record order fill for user %s: %s", current_user.id, e)
        portfolio_update = {"recorded": False, "error": str(e)}

    return {
        "success": True,
        "order": result,
        "portfolio_update": portfolio_update,
    }


@router.get("/orders/open", response_model=Dict[str, Any])
async def get_open_orders(
    symbol: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
):
    """Currently open (unfilled) orders."""
    client = _get_client()
    kwargs = {"symbol": symbol.upper()} if symbol else {}
    orders = await run_sync(client.get_open_orders, **kwargs)
    return {
        "success": True,
        "orders": orders,
        "count": len(orders),
    }


@router.delete("/orders/{symbol}/{order_id}", response_model=Dict[str, Any])
async def cancel_order(
    symbol: str,
    order_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Cancel an open order."""
    client = _get_client()
    result = await run_sync(client.cancel_order, symbol=symbol.upper(), orderId=order_id)
    return {
        "success": True,
        "order": result,
    }


@router.get("/orders/history", response_model=Dict[str, Any])
async def get_order_history(
    symbol: str = Query(..., description="Order history requires a symbol"),
    limit: int = Query(50, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
):
    """Full order history (all statuses) for a symbol, straight from Binance."""
    client = _get_client()
    orders = await run_sync(client.get_all_orders, symbol=symbol.upper(), limit=limit)
    return {
        "success": True,
        "symbol": symbol.upper(),
        "orders": orders,
        "count": len(orders),
    }


@router.get("/orders/trades", response_model=Dict[str, Any])
async def get_trade_fills(
    symbol: str = Query(..., description="Trade history requires a symbol"),
    limit: int = Query(50, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
):
    """Executed trade fills for a symbol, straight from Binance (not VaultX's own Trade table)."""
    client = _get_client()
    trades = await run_sync(client.get_my_trades, symbol=symbol.upper(), limit=limit)
    return {
        "success": True,
        "symbol": symbol.upper(),
        "trades": trades,
        "count": len(trades),
    }
