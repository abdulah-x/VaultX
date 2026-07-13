"""
Async Redis Streams client for the price-ingestion pipeline (Phase 6).

Separate from `core/redis_client.py`, which is a synchronous client purpose-built
for token blacklisting/OTP storage and reads REDIS_URL directly via os.getenv.
This client is async (redis.asyncio, already shipped by redis>=4.2 — no new
dependency) and is shared by the WebSocket ingestion producer
(`data_pipeline/live_stream.py`) and the TimescaleDB stream writer
(`data_pipeline/stream_writer.py`). It exists to decouple ingestion rate from
DB write rate (backpressure) via a Redis Stream consumer group.
"""
import json
import logging
from typing import Optional

import redis.asyncio as aioredis

from core.config import settings

logger = logging.getLogger(__name__)

PRICE_TICKS_STREAM = "price_ticks"
PRICE_WRITER_GROUP = "price_writer_group"


class RedisStreamsClient:
    """Lazy-init async Redis client wrapping the price-ticks stream."""

    def __init__(self):
        self._client: Optional[aioredis.Redis] = None

    async def get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(settings.redis_url, decode_responses=True)
        return self._client

    async def ensure_group(self, stream: str = PRICE_TICKS_STREAM, group: str = PRICE_WRITER_GROUP) -> None:
        """Create the consumer group if it doesn't exist yet (idempotent)."""
        client = await self.get_client()
        try:
            await client.xgroup_create(stream, group, id="0", mkstream=True)
        except aioredis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

    async def publish_tick(self, payload: dict, stream: str = PRICE_TICKS_STREAM) -> None:
        """Producer side: push one price tick onto the stream."""
        client = await self.get_client()
        await client.xadd(stream, {"data": json.dumps(payload)})

    async def read_batch(
        self,
        consumer_name: str,
        count: int = 100,
        block_ms: int = 1000,
        stream: str = PRICE_TICKS_STREAM,
        group: str = PRICE_WRITER_GROUP,
    ) -> list[tuple[str, dict]]:
        """Consumer side: read up to `count` new ticks, blocking up to block_ms."""
        client = await self.get_client()
        response = await client.xreadgroup(group, consumer_name, {stream: ">"}, count=count, block=block_ms)
        entries = []
        for _stream_name, messages in response or []:
            for message_id, fields in messages:
                entries.append((message_id, json.loads(fields["data"])))
        return entries

    async def ack(
        self, message_ids: list[str], stream: str = PRICE_TICKS_STREAM, group: str = PRICE_WRITER_GROUP
    ) -> None:
        if not message_ids:
            return
        client = await self.get_client()
        await client.xack(stream, group, *message_ids)


redis_streams = RedisStreamsClient()
