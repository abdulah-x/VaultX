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
from decimal import Decimal
import statistics

from core.dependencies import get_current_active_user
from core.errors import ExternalAPIError, ValidationError
from core.decimal_utils import stringify_decimals
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


def _analyze_side(levels: List, buckets: int, wall_sigma: float) -> Dict[str, Any]:
    """Aggregate one order-book side into total volume, a volume-by-price profile,
    and 'walls' — levels whose size is far above the side's average."""
    parsed = [(Decimal(str(p)), Decimal(str(q))) for p, q in levels]
    if not parsed:
        return {"total_volume": Decimal('0'), "levels": 0, "walls": [], "profile": []}

    qtys = [float(q) for _, q in parsed]
    total = sum((q for _, q in parsed), Decimal('0'))
    mean = statistics.mean(qtys)
    std = statistics.pstdev(qtys) if len(qtys) > 1 else 0.0
    threshold = mean + wall_sigma * std

    walls = sorted(
        [{"price": p, "quantity": q} for p, q in parsed if threshold > 0 and float(q) > threshold],
        key=lambda w: w["quantity"], reverse=True,
    )[:10]

    # Volume-by-price histogram across the side's price range.
    prices = [float(p) for p, _ in parsed]
    lo, hi = min(prices), max(prices)
    profile = []
    if hi > lo:
        width = (hi - lo) / buckets
        sums = [Decimal('0')] * buckets
        for p, q in parsed:
            idx = min(int((float(p) - lo) / width), buckets - 1)
            sums[idx] += q
        profile = [
            {
                "price_low": Decimal(str(round(lo + i * width, 8))),
                "price_high": Decimal(str(round(lo + (i + 1) * width, 8))),
                "volume": sums[i],
            }
            for i in range(buckets)
        ]

    return {"total_volume": total, "levels": len(parsed), "walls": walls, "profile": profile}


@router.get("/market/volume-profile/{symbol}", response_model=Dict[str, Any])
async def get_volume_profile(
    symbol: str,
    limit: int = Query(500, ge=50, le=1000, description="Depth levels per side to analyze"),
    buckets: int = Query(10, ge=2, le=50, description="Price buckets for the volume profile"),
    wall_sigma: float = Query(2.0, ge=1.0, le=5.0, description="Std-devs above mean to flag a wall"),
    current_user: User = Depends(get_current_active_user),
):
    """Aggregate live order-book depth into a volume-by-price profile and flag
    buy walls (large bids = support) and sell walls (large asks = resistance)."""
    client = _get_client()
    depth = await run_sync(client.get_order_book, symbol=symbol.upper(), limit=limit)

    bids = _analyze_side(depth.get("bids", []), buckets, wall_sigma)
    asks = _analyze_side(depth.get("asks", []), buckets, wall_sigma)

    best_bid = Decimal(str(depth["bids"][0][0])) if depth.get("bids") else None
    best_ask = Decimal(str(depth["asks"][0][0])) if depth.get("asks") else None
    mid = ((best_bid + best_ask) / 2) if (best_bid is not None and best_ask is not None) else None
    spread = (best_ask - best_bid) if (best_bid is not None and best_ask is not None) else None

    return stringify_decimals({
        "success": True,
        "symbol": symbol.upper(),
        "mid_price": mid,
        "spread": spread,
        "buy_walls": bids["walls"],
        "sell_walls": asks["walls"],
        "bids": {"total_volume": bids["total_volume"], "levels": bids["levels"], "profile": bids["profile"]},
        "asks": {"total_volume": asks["total_volume"], "levels": asks["levels"], "profile": asks["profile"]},
    })
