"""enforce price_history dedup at the database level

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-07-27 00:00:00.000000

price_history had an index on (asset_id, timestamp) but nothing preventing a
duplicate row: the Streams consumer's PEL-reclaim path (claim_stale_pending in
stream_writer.py) hands back a tick to be retried whenever the writer crashed
between committing a batch and acking it -- the write had already succeeded,
so the "retry" silently re-inserts the same tick as a second row. Not a crash,
just growing chart/backtest noise (duplicate points at the same timestamp).

UNIQUE across (asset_id, timestamp) rather than a plain index -- satisfies
TimescaleDB's requirement that a unique constraint on a hypertable include the
partitioning column (timestamp already is). Confirmed zero existing duplicate
(asset_id, timestamp) pairs across ~279k rows before adding this.

TimescaleDB refuses ADD CONSTRAINT outright on a hypertable with compression
enabled ("operation not supported on hypertables that have compression
enabled") -- true both while any chunk is still compressed AND while the
hypertable-level `timescaledb.compress` setting from the Phase 6
retention/compression migration (b2d3e4f5a6c7) is on, independent of each
other (confirmed the hard way: decompressing every chunk alone still wasn't
enough while the hypertable setting stayed on). Compression is turned back on
with the exact same segmentby/orderby afterward; existing chunks are left
decompressed for the compression policy job to pick up again on its normal
7-day schedule rather than re-compressing everything synchronously inside
this migration.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "SELECT decompress_chunk(c, if_compressed => true) FROM show_chunks('price_history') c"
    )
    op.execute("ALTER TABLE price_history SET (timescaledb.compress = false)")

    op.drop_index('ix_price_history_asset_timestamp', table_name='price_history')
    op.create_unique_constraint(
        'uq_price_history_asset_timestamp',
        'price_history',
        ['asset_id', 'timestamp'],
    )

    op.execute(
        "ALTER TABLE price_history SET ("
        "  timescaledb.compress, "
        "  timescaledb.compress_segmentby = 'asset_id', "
        "  timescaledb.compress_orderby = 'timestamp DESC'"
        ")"
    )


def downgrade() -> None:
    op.drop_constraint('uq_price_history_asset_timestamp', 'price_history', type_='unique')
    op.create_index(
        'ix_price_history_asset_timestamp',
        'price_history',
        ['asset_id', 'timestamp'],
    )
