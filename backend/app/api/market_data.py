#!/usr/bin/env python3
"""
Live Binance market data endpoints: order book depth, recent public trades,
klines/candlesticks, 24hr ticker stats, and symbol trading rules.

All Binance calls are offloaded via run_sync (services.binance.client) since
python-binance is fully synchronous -- calling it directly here would block
the event loop, same as every other router that talks to Binance.
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, List, Optional

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


@router.get("/market/orderbook/{symbol}", response_model=Dict[str, Any])
async def get_order_book(
    symbol: str,
    limit: int = Query(20, ge=5, le=1000, description="Depth levels per side"),
    current_user: User = Depends(get_current_active_user),
):
    """Live order book depth (bids/asks) for a symbol."""
    client = _get_client()
    depth = await run_sync(client.get_order_book, symbol=symbol.upper(), limit=limit)
    return {
        "success": True,
        "symbol": symbol.upper(),
        "last_update_id": depth.get("lastUpdateId"),
        "bids": depth.get("bids", []),
        "asks": depth.get("asks", []),
    }


@router.get("/market/trades/{symbol}", response_model=Dict[str, Any])
async def get_recent_trades(
    symbol: str,
    limit: int = Query(20, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
):
    """Recent public trades for a symbol (not the current user's own trades)."""
    client = _get_client()
    trades = await run_sync(client.get_recent_trades, symbol=symbol.upper(), limit=limit)
    return {
        "success": True,
        "symbol": symbol.upper(),
        "trades": trades,
        "count": len(trades),
    }


@router.get("/market/klines/{symbol}", response_model=Dict[str, Any])
async def get_klines(
    symbol: str,
    interval: str = Query("1h", description="e.g. 1m, 5m, 1h, 4h, 1d"),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
):
    """Candlestick data for a symbol."""
    client = _get_client()
    raw = await run_sync(client.get_klines, symbol=symbol.upper(), interval=interval, limit=limit)
    candles = [
        {
            "open_time": k[0],
            "open": k[1],
            "high": k[2],
            "low": k[3],
            "close": k[4],
            "volume": k[5],
            "close_time": k[6],
            "trades": k[8],
        }
        for k in raw
    ]
    return {
        "success": True,
        "symbol": symbol.upper(),
        "interval": interval,
        "candles": candles,
    }


@router.get("/market/ticker/{symbol}", response_model=Dict[str, Any])
async def get_24h_ticker(
    symbol: str,
    current_user: User = Depends(get_current_active_user),
):
    """24hr price change stats for a symbol."""
    client = _get_client()
    ticker = await run_sync(client.get_ticker, symbol=symbol.upper())
    return {
        "success": True,
        "symbol": symbol.upper(),
        "last_price": ticker.get("lastPrice"),
        "price_change": ticker.get("priceChange"),
        "price_change_percent": ticker.get("priceChangePercent"),
        "high_price": ticker.get("highPrice"),
        "low_price": ticker.get("lowPrice"),
        "volume": ticker.get("volume"),
        "quote_volume": ticker.get("quoteVolume"),
        "trade_count": ticker.get("count"),
    }


@router.get("/market/symbol-info/{symbol}", response_model=Dict[str, Any])
async def get_symbol_trading_rules(
    symbol: str,
    current_user: User = Depends(get_current_active_user),
):
    """Exchange trading rules for a symbol (tick size, lot size, min notional, etc.)."""
    client = _get_client()
    info = await run_sync(client.get_symbol_info, symbol.upper())
    if not info:
        raise ValidationError(f"Unknown symbol: {symbol.upper()}")

    filters = {f["filterType"]: {k: v for k, v in f.items() if k != "filterType"} for f in info.get("filters", [])}
    return {
        "success": True,
        "symbol": info.get("symbol"),
        "status": info.get("status"),
        "base_asset": info.get("baseAsset"),
        "quote_asset": info.get("quoteAsset"),
        "filters": filters,
    }
