"""
Real-time Price Updates Service
WebSocket-based real-time price streaming, backed by the Phase 6 pipeline:
Binance WS (`data_pipeline/live_stream.py`) -> Redis Stream `price_ticks` ->
this router's consumer -> connected WebSocket clients. Also written into
`price_history`/`CurrentPrice` by `data_pipeline/stream_writer.py`.

State (subscriptions, latest prices) used to live only in this process's
in-memory dicts, which broke under multiple workers and reset on restart.
Ticks now arrive from Redis, which is shared — each worker runs its own
consumer-group member and fans ticks out to its own local WebSocket
connections; only the connection list itself stays per-process (a WebSocket
is inherently tied to the worker that accepted it).
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Set
import asyncio
import json
import logging
import os
from datetime import datetime

from core.dependencies import get_db, get_current_active_user
from core.auth import auth_manager
from core.redis_streams import redis_streams
from database.models import User, Holding, Asset, CurrentPrice

router = APIRouter()
logger = logging.getLogger(__name__)


class RealTimePriceManager:
    """Manage real-time price updates and WebSocket connections for this worker."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_subscriptions: Dict[int, Set[str]] = {}
        self.price_cache: Dict[str, Dict] = {}
        self.redis_listener_task: asyncio.Task = None

    async def connect_user(self, websocket: WebSocket, user_id: int, user_token: str):
        """Connect a user to real-time price updates"""
        await websocket.accept()
        connection_id = f"{user_id}_{user_token[:8]}"
        self.active_connections[connection_id] = websocket

        if user_id not in self.user_subscriptions:
            self.user_subscriptions[user_id] = set()

        logger.info(f"✅ User {user_id} connected for real-time prices")

        return connection_id

    async def disconnect_user(self, connection_id: str, user_id: int):
        """Disconnect a user from real-time updates"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]

        if user_id in self.user_subscriptions and len(self.user_subscriptions[user_id]) == 0:
            del self.user_subscriptions[user_id]

        logger.info(f"❌ User {user_id} disconnected from real-time prices")

    async def subscribe_to_symbols(self, user_id: int, symbols: List[str]):
        """Subscribe user to specific symbols for price updates"""
        if user_id not in self.user_subscriptions:
            self.user_subscriptions[user_id] = set()

        for symbol in symbols:
            self.user_subscriptions[user_id].add(symbol.upper())

        logger.info(f"📈 User {user_id} subscribed to {len(symbols)} symbols")

    async def get_portfolio_symbols(self, user_id: int, db: Session) -> List[str]:
        """Get symbols from user's portfolio for automatic subscription"""
        # Join Asset to read the ticker symbol; filter on the real quantity column.
        holdings = (
            db.query(Asset.symbol)
            .join(Holding, Holding.asset_id == Asset.id)
            .filter(
                Holding.user_id == user_id,
                Holding.total_quantity > 0,
            )
            .all()
        )

        symbols = []
        for (asset_symbol,) in holdings:
            symbols.append(f"{asset_symbol}USDT")

        return list(set(symbols))  # Remove duplicates

    def start_redis_listener(self):
        """Start this worker's Redis Streams consumer, once."""
        if self.redis_listener_task is None or self.redis_listener_task.done():
            self.redis_listener_task = asyncio.create_task(self._redis_listener_loop())

    async def _redis_listener_loop(self):
        """Consume price_ticks and fan matching updates out to local WebSocket clients."""
        consumer_name = f"realtime-prices-{os.getpid()}"
        await redis_streams.ensure_group()
        logger.info(f"🔌 Started Redis tick listener as consumer '{consumer_name}'")

        while True:
            try:
                entries = await redis_streams.read_batch(consumer_name, count=100, block_ms=2000)
                acked_ids = []
                for message_id, payload in entries:
                    symbol = payload.get("symbol")
                    if not symbol:
                        acked_ids.append(message_id)
                        continue

                    price_data = {
                        "symbol": symbol,
                        "price": float(payload["price"]),
                        "timestamp": payload.get("timestamp", datetime.utcnow().isoformat()),
                    }
                    self.price_cache[symbol] = price_data
                    await self._broadcast_price_update(symbol, price_data)
                    acked_ids.append(message_id)

                await redis_streams.ack(acked_ids)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"❌ Redis tick listener error: {e}")
                await asyncio.sleep(2)

    async def _broadcast_price_update(self, symbol: str, price_data: Dict):
        """Broadcast price update to this worker's subscribed connections"""
        message = {
            "type": "price_update",
            "data": price_data
        }

        disconnected_connections = []

        for connection_id, websocket in self.active_connections.items():
            try:
                # Check if any user is subscribed to this symbol
                user_id = int(connection_id.split('_')[0])
                if user_id in self.user_subscriptions and symbol in self.user_subscriptions[user_id]:
                    await websocket.send_text(json.dumps(message))

            except Exception as e:
                logger.warning(f"⚠️ Failed to send price update to {connection_id}: {e}")
                disconnected_connections.append(connection_id)

        # Clean up disconnected connections
        for conn_id in disconnected_connections:
            if conn_id in self.active_connections:
                del self.active_connections[conn_id]

    async def get_current_prices(self, symbols: List[str], db: Session) -> Dict[str, Dict]:
        """Get current prices for symbols — from the in-memory tick cache first,
        falling back to the DB's CurrentPrice (kept live by the stream writer)."""
        result = {}
        base_symbols = {s: s[:-4] if s.endswith("USDT") else s for s in symbols}
        missing = []

        for symbol in symbols:
            if symbol in self.price_cache:
                result[symbol] = self.price_cache[symbol]
            else:
                missing.append(symbol)

        if missing:
            missing_bases = {base_symbols[s] for s in missing}
            rows = (
                db.query(Asset.symbol, CurrentPrice.price_usd, CurrentPrice.last_updated)
                .join(CurrentPrice, CurrentPrice.asset_id == Asset.id)
                .filter(Asset.symbol.in_(missing_bases))
                .all()
            )
            price_by_base = {symbol: (price, updated) for symbol, price, updated in rows}
            for symbol in missing:
                base = base_symbols[symbol]
                if base in price_by_base:
                    price, updated = price_by_base[base]
                    result[symbol] = {
                        "symbol": symbol,
                        "price": float(price),
                        "timestamp": updated.isoformat() if updated else datetime.utcnow().isoformat(),
                    }

        return result


# Global price manager instance (per-worker)
price_manager = RealTimePriceManager()


@router.websocket("/prices/stream")
async def websocket_price_stream(
    websocket: WebSocket,
    token: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time price streaming
    Usage: ws://localhost:8000/api/prices/stream?token=YOUR_JWT_TOKEN
    """
    connection_id = None
    user_id = None

    # Authenticate the connection from the JWT before accepting it. An invalid,
    # expired, wrong-type, or missing-subject token is rejected with policy-violation.
    try:
        payload = auth_manager.verify_token(token)
        if payload.get("type") and payload.get("type") != "access":
            raise ValueError("non-access token")
        user_id = int(payload["sub"])
    except Exception as e:
        logger.warning(f"⚠️ Rejected price-stream WebSocket: {e}")
        await websocket.close(code=1008)  # policy violation
        return

    try:
        price_manager.start_redis_listener()
        connection_id = await price_manager.connect_user(websocket, user_id, token)

        # Get user's portfolio symbols and subscribe
        portfolio_symbols = await price_manager.get_portfolio_symbols(user_id, db)
        if portfolio_symbols:
            await price_manager.subscribe_to_symbols(user_id, portfolio_symbols)

        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "message": "Connected to real-time price stream",
            "subscribed_symbols": portfolio_symbols
        }))

        # Keep connection alive and handle client messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                if message.get("type") == "subscribe":
                    symbols = message.get("symbols", [])
                    await price_manager.subscribe_to_symbols(user_id, symbols)

                    await websocket.send_text(json.dumps({
                        "type": "subscription_confirmed",
                        "symbols": symbols
                    }))

                elif message.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"❌ WebSocket message error: {e}")
                break

    except Exception as e:
        logger.error(f"❌ WebSocket connection error: {e}")

    finally:
        if connection_id and user_id:
            await price_manager.disconnect_user(connection_id, user_id)

@router.get("/prices/current", response_model=Dict[str, Any])
async def get_current_prices(
    symbols: str = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current prices for specified symbols or user's portfolio
    """
    try:
        if symbols:
            symbol_list = [s.strip().upper() for s in symbols.split(',')]
        else:
            # Get from user's portfolio
            symbol_list = await price_manager.get_portfolio_symbols(current_user.id, db)

        if not symbol_list:
            return {
                "success": True,
                "message": "No symbols to get prices for",
                "prices": {}
            }

        prices = await price_manager.get_current_prices(symbol_list, db)

        return {
            "success": True,
            "prices": prices,
            "symbols_requested": symbol_list,
            "symbols_found": len(prices),
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get prices: {str(e)}")

@router.get("/prices/stream/status", response_model=Dict[str, Any])
async def get_stream_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get real-time streaming status
    """
    listener_running = price_manager.redis_listener_task is not None and not price_manager.redis_listener_task.done()
    return {
        "success": True,
        "status": {
            "streaming_active": listener_running,
            "active_connections": len(price_manager.active_connections),
            "subscribed_users": len(price_manager.user_subscriptions),
            "cached_prices": len(price_manager.price_cache),
            "user_subscriptions": len(price_manager.user_subscriptions.get(current_user.id, set()))
        }
    }

@router.post("/prices/portfolio-watch", response_model=Dict[str, Any])
async def start_portfolio_price_watch(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Start price watching for user's entire portfolio
    """
    try:
        # Get user's portfolio symbols
        portfolio_symbols = await price_manager.get_portfolio_symbols(current_user.id, db)

        if not portfolio_symbols:
            return {
                "success": False,
                "message": "No portfolio assets found to watch",
                "symbols": []
            }

        # Subscribe to price updates
        price_manager.start_redis_listener()
        await price_manager.subscribe_to_symbols(current_user.id, portfolio_symbols)

        return {
            "success": True,
            "message": f"Started price watching for {len(portfolio_symbols)} symbols",
            "symbols": portfolio_symbols,
            "websocket_url": "/api/prices/stream"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start price watch: {str(e)}")
