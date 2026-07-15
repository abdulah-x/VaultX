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
from typing import Dict, Any, List, Optional
from decimal import Decimal

from core.dependencies import get_current_active_user
from core.errors import ExternalAPIError, ValidationError
from database.models import User
from services.binance.client import BinanceClientManager, run_sync

router = APIRouter()


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
):
    """Place a real order against the configured Binance account (testnet by default)."""
    client = _get_client()
    result = await run_sync(client.create_order, **_order_kwargs(payload))
    return {
        "success": True,
        "order": result,
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
