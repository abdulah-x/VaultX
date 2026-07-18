"""price_history retention + compression policy

Revision ID: b2d3e4f5a6c7
Revises: a1c2b3d4e5f6
Create Date: 2026-07-18 00:00:00.000000

`price_history` is a real tick-level hypertable now (previous revision) and
the live ingestion pipeline has been writing to it continuously since Phase 6
- with no retention or compression policy, it grows unbounded forever. This
adds:
  - compression for chunks older than 7 days (ticks that old are read far
    less often, and compress well since price_usd is mostly-monotonic within
    a chunk)
  - a retention policy dropping chunks older than 365 days, since the app's
    own analytics (MPT optimizer, advisor risk metrics) only ever look back
    90 days at most (see services/analytics/mpt.py)
Both thresholds are conservative starting points, not tuned against real
production volume - safe to adjust via a future migration once real disk
usage is observed.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b2d3e4f5a6c7'
down_revision = 'a1c2b3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE price_history SET ("
        "  timescaledb.compress, "
        "  timescaledb.compress_segmentby = 'asset_id', "
        "  timescaledb.compress_orderby = 'timestamp DESC'"
        ")"
    )
    op.execute("SELECT add_compression_policy('price_history', INTERVAL '7 days', if_not_exists => TRUE)")
    op.execute("SELECT add_retention_policy('price_history', INTERVAL '365 days', if_not_exists => TRUE)")


def downgrade() -> None:
    op.execute("SELECT remove_retention_policy('price_history', if_exists => TRUE)")
    op.execute("SELECT remove_compression_policy('price_history', if_exists => TRUE)")
    op.execute("ALTER TABLE price_history SET (timescaledb.compress = false)")
