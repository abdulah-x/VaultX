"""
Live Binance price ingestion (Phase 6 producer).

Connects to Binance's WebSocket trade stream for the symbols users actually
hold (plus a small default watchlist), and pushes each tick onto the
`price_ticks` Redis Stream via `core.redis_streams.redis_streams`. Does not
touch Postgres directly — that's the writer's job (`stream_writer.py`) — this
decoupling is the actual backpressure boundary between ingestion rate and DB
write rate.

Runs as a background asyncio task started from the backend's FastAPI startup
event (see `main.py`), replacing the old `realtime_prices.py` REST-polling
simulation.
"""
import asyncio
import logging
from datetime import datetime, timezone

from binance.client import AsyncClient
from binance.streams import BinanceSocketManager
from tenacity import retry, wait_exponential, retry_if_not_exception_type, before_sleep_log

from core.config import settings
from core.redis_streams import redis_streams
from database.connection import SessionLocal
from database.models import Asset, Holding

logger = logging.getLogger(__name__)

DEFAULT_WATCHLIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]
RECONNECT_DELAY_SECONDS = 5
MAX_RECONNECT_DELAY_SECONDS = 60

# python-binance 1.0.19's built-in STREAM_TESTNET_URL ("wss://testnet.binance.vision/")
# is wrong for market-data streams — that host serves the REST/WS-API only and 404s on
# stream paths. Testnet market data actually lives on a separate host. Confirmed by
# hand against both the single-symbol and combined-stream paths before wiring this in.
TESTNET_STREAM_URL = "wss://stream.testnet.binance.vision/"


def _get_watch_symbols() -> list[str]:
    """Symbols with an active holding, plus a small default watchlist."""
    db = SessionLocal()
    try:
        held = (
            db.query(Asset.symbol)
            .join(Holding, Holding.asset_id == Asset.id)
            .filter(Holding.total_quantity > 0)
            .distinct()
            .all()
        )
        held_symbols = {f"{symbol.upper()}USDT" for (symbol,) in held if symbol.upper() != "USDT"}
    finally:
        db.close()
    return sorted(held_symbols | set(DEFAULT_WATCHLIST))


async def _handle_tick(symbol: str, msg: dict) -> None:
    """Parse one Binance 24hrTicker message and push it onto the Redis stream."""
    if msg.get("e") == "error":
        logger.warning("Binance stream error for %s: %s", symbol, msg)
        return
    price = msg.get("c")  # 24hrTicker's last-traded price field
    event_time_ms = msg.get("E")
    if price is None or event_time_ms is None:
        return
    payload = {
        "symbol": symbol,
        "price": price,
        "timestamp": datetime.fromtimestamp(event_time_ms / 1000, tz=timezone.utc).isoformat(),
    }
    await redis_streams.publish_tick(payload)


@retry(
    # Never gives up (this task is meant to run for the app's lifetime) and
    # never retries a deliberate shutdown - only connection/stream failures.
    retry=retry_if_not_exception_type(asyncio.CancelledError),
    wait=wait_exponential(multiplier=1, min=RECONNECT_DELAY_SECONDS, max=MAX_RECONNECT_DELAY_SECONDS),
    before_sleep=before_sleep_log(logger, logging.ERROR),
    reraise=True,
)
async def _connect_and_stream() -> None:
    """One connect-subscribe-consume attempt; raises on any drop so tenacity reconnects with backoff."""
    client = None
    try:
        symbols = _get_watch_symbols()
        logger.info("Connecting to Binance WS for symbols: %s", symbols)
        client = await AsyncClient.create(
            settings.binance_api_key, settings.binance_secret_key, testnet=settings.binance_testnet
        )
        bsm = BinanceSocketManager(client)
        if settings.binance_testnet:
            bsm.STREAM_TESTNET_URL = TESTNET_STREAM_URL
        streams = [f"{s.lower()}@ticker" for s in symbols]
        async with bsm.multiplex_socket(streams) as stream:
            while True:
                msg = await stream.recv()
                data = msg.get("data", msg)
                symbol = data.get("s")
                if symbol:
                    await _handle_tick(symbol, data)
    finally:
        if client is not None:
            await client.close_connection()


async def stream_binance_ticks() -> None:
    """Long-running task: connect to Binance, resubscribe on drop, forever."""
    if not settings.binance_api_key or not settings.binance_secret_key:
        logger.warning("BINANCE_API_KEY/SECRET not configured - live price ingestion disabled")
        return

    await redis_streams.ensure_group()
    await _connect_and_stream()
