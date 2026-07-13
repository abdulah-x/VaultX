"""
Redis Streams -> TimescaleDB writer (Phase 6 consumer).

Reads batches of price ticks from the `price_ticks` Redis Stream (produced by
`live_stream.py`), bulk-inserts them into the `price_history` hypertable, and
upserts `CurrentPrice` so existing read paths (pnl.py, the advisor context
builder, /prices/current) get live data with no changes on their side. Runs
as its own `stream-writer` docker-compose service, independent of the API
worker process/count.
"""
import asyncio
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.redis_streams import redis_streams
from database.connection import SessionLocal
from database.models import Asset, CurrentPrice, PriceHistory

logger = logging.getLogger(__name__)

CONSUMER_NAME = "stream-writer-1"
BATCH_COUNT = 100
BLOCK_MS = 1000


def _base_symbol(pair_symbol: str) -> str:
    """"BTCUSDT" -> "BTC". Watch symbols are always <BASE>USDT pairs."""
    return pair_symbol[:-4] if pair_symbol.endswith("USDT") else pair_symbol


def _load_asset_map(db) -> dict:
    return {symbol: asset_id for asset_id, symbol in db.query(Asset.id, Asset.symbol).all()}


async def _write_batch(entries: list) -> list:
    """Bulk-insert ticks into price_history and upsert CurrentPrice. Returns the ids to ack."""
    if not entries:
        return []

    db = SessionLocal()
    try:
        asset_map = _load_asset_map(db)
        history_rows = []
        latest_price_by_asset = {}

        for _message_id, payload in entries:
            base_symbol = _base_symbol(payload["symbol"])
            asset_id = asset_map.get(base_symbol)
            if asset_id is None:
                continue  # unknown asset (not yet seeded) - skip rather than guess
            try:
                price = Decimal(str(payload["price"]))
            except InvalidOperation:
                continue
            ts = datetime.fromisoformat(payload["timestamp"])

            history_rows.append({"asset_id": asset_id, "price_usd": price, "timestamp": ts})

            current = latest_price_by_asset.get(asset_id)
            if current is None or ts > current[1]:
                latest_price_by_asset[asset_id] = (price, ts)

        if history_rows:
            db.execute(insert(PriceHistory), history_rows)

        for asset_id, (price, ts) in latest_price_by_asset.items():
            stmt = pg_insert(CurrentPrice).values(
                asset_id=asset_id, price_usd=price, data_source="binance", last_updated=ts
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=[CurrentPrice.asset_id],
                set_={"price_usd": stmt.excluded.price_usd, "last_updated": stmt.excluded.last_updated},
            )
            db.execute(stmt)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return [message_id for message_id, _ in entries]


async def run_stream_writer() -> None:
    await redis_streams.ensure_group()
    logger.info("Stream writer started, consumer=%s", CONSUMER_NAME)
    while True:
        try:
            entries = await redis_streams.read_batch(CONSUMER_NAME, count=BATCH_COUNT, block_ms=BLOCK_MS)
            if not entries:
                continue
            acked_ids = await _write_batch(entries)
            await redis_streams.ack(acked_ids)
            logger.info("Wrote %d ticks", len(acked_ids))
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("Stream writer batch failed: %s", e)
            await asyncio.sleep(1)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_stream_writer())
