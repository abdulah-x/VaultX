"""add is_maker to trades

Revision ID: c3e4f5a6b7d8
Revises: b2d3e4f5a6c7
Create Date: 2026-07-20 00:00:00.000000

Adds a nullable maker/taker flag to trades so the fee-breakdown endpoint can
split maker vs taker fees. Nullable because order-endpoint fills and pre-existing
rows don't carry it — they read as "unknown" until re-imported from trade history.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3e4f5a6b7d8'
down_revision = 'b2d3e4f5a6c7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('trades', sa.Column('is_maker', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('trades', 'is_maker')
