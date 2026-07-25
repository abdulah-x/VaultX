"""add missing FK indexes, enforce one holding per user+asset

Revision ID: e5f6a7b8c9d0
Revises: d4f5a6b7c8e9
Create Date: 2026-07-25 00:00:00.000000

Found by a full database audit (not guessed): trades.base_asset_id and
trades.quote_asset_id are FKs to assets(id) with no backing index -- any
per-asset trade query (advisor context, P&L, the FIFO/moving-average
replay added this session) does a sequential scan of the whole trades
table. Same gap on audit_logs.user_id, which only gets worse since audit
rows are append-only and never pruned.

Also promotes the existing ix_holdings_user_asset index to a real UNIQUE
constraint. The app has always assumed one Holding row per (user_id,
asset_id) -- portfolio_sync upserts on that basis -- but nothing in the
database enforced it, so a race between two concurrent syncs could insert
a silent duplicate and corrupt portfolio totals with no error at all.
Confirmed zero existing duplicate (user_id, asset_id) pairs before adding
this, so the migration cannot fail on current data.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4f5a6b7c8e9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_trades_base_asset_id', 'trades', ['base_asset_id'])
    op.create_index('ix_trades_quote_asset_id', 'trades', ['quote_asset_id'])
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])

    # Promote the existing non-unique composite index to an enforced
    # constraint rather than adding a second index alongside it.
    op.drop_index('ix_holdings_user_asset', table_name='holdings')
    op.create_unique_constraint(
        'uq_holdings_user_asset', 'holdings', ['user_id', 'asset_id']
    )


def downgrade() -> None:
    op.drop_constraint('uq_holdings_user_asset', 'holdings', type_='unique')
    op.create_index('ix_holdings_user_asset', 'holdings', ['user_id', 'asset_id'])

    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_index('ix_trades_quote_asset_id', table_name='trades')
    op.drop_index('ix_trades_base_asset_id', table_name='trades')
