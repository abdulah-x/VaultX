"""enforce trade dedup at the database level

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-26 00:00:00.000000

Found by a concurrency audit (not guessed): trade_import.py's dedup logic
was check-then-insert with no locking and no DB-level backing -- two
concurrent /trades/import calls for the same user (a double-click, or a
retry after a client timeout) could both see "no existing trade" for the
same binance_trade_id and both insert. A duplicate Trade row then also
duplicates in recompute_realized_pnl's chronological replay, corrupting
every subsequent trade's average cost for that symbol.

UNIQUE across (user_id, symbol, binance_trade_id) rather than just
binance_trade_id, matching the existing dedup filter in
trade_import.py::_import_trades_to_db -- Binance trade IDs are only unique
per symbol (confirmed by an earlier fix), so BTCUSDT #123 and ETHUSDT #123
are legitimately different trades. Postgres treats NULL as distinct from
every other value in a UNIQUE index, so order-endpoint fills (which can
have a null binance_trade_id when no fill data was returned) are
unaffected. Confirmed zero existing violating rows before adding this.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_trades_user_symbol_binance_trade_id',
        'trades',
        ['user_id', 'symbol', 'binance_trade_id'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_trades_user_symbol_binance_trade_id', 'trades', type_='unique')
