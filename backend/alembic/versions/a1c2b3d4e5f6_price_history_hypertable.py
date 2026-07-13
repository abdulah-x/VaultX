"""price_history hypertable

Revision ID: a1c2b3d4e5f6
Revises: 8eaa5ed99d23
Create Date: 2026-07-10 00:00:00.000000

`price_history` has been empty and unused since it was introduced in the
baseline migration (nothing in the codebase ever wrote to it). This revision
reshapes it from a daily-snapshot table (`snapshot_date`/`snapshot_type`)
into a real tick-level time-series table (`timestamp`) and converts it into
a TimescaleDB hypertable, which is the storage Phase 6's price-ingestion
pipeline writes into.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1c2b3d4e5f6'
down_revision = '8eaa5ed99d23'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old daily-snapshot columns (table has zero rows, safe to reshape).
    op.execute("DROP INDEX IF EXISTS ix_price_history_snapshot_date")
    op.drop_column('price_history', 'snapshot_date')
    op.drop_column('price_history', 'snapshot_type')

    # Add the real event-time column that the ingestion pipeline will write.
    op.add_column(
        'price_history',
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.alter_column('price_history', 'timestamp', server_default=None)

    # TimescaleDB requires the partitioning column to be part of every
    # unique/primary-key constraint, so replace the id-only PK with a
    # composite (id, timestamp) PK.
    op.execute("ALTER TABLE price_history DROP CONSTRAINT price_history_pkey")
    op.execute("ALTER TABLE price_history ADD PRIMARY KEY (id, timestamp)")

    op.create_index(
        'ix_price_history_asset_timestamp', 'price_history', ['asset_id', 'timestamp'], unique=False
    )

    # Convert to a hypertable — not a native Alembic op, needs raw SQL.
    op.execute(
        "SELECT create_hypertable('price_history', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE)"
    )


def downgrade() -> None:
    # Reverting a hypertable back into a plain table isn't a supported
    # Timescale operation; this only reverts the column/PK shape, which is
    # sufficient since the table has never held real rows outside dev/test.
    op.drop_index('ix_price_history_asset_timestamp', table_name='price_history')
    op.execute("ALTER TABLE price_history DROP CONSTRAINT price_history_pkey")
    op.execute("ALTER TABLE price_history ADD PRIMARY KEY (id)")
    op.drop_column('price_history', 'timestamp')
    op.add_column(
        'price_history',
        sa.Column('snapshot_date', sa.Date(), nullable=False, server_default=sa.func.current_date()),
    )
    op.alter_column('price_history', 'snapshot_date', server_default=None)
    op.add_column(
        'price_history', sa.Column('snapshot_type', sa.String(20), nullable=True, server_default='daily')
    )
    op.create_index('ix_price_history_snapshot_date', 'price_history', ['snapshot_date'], unique=False)
