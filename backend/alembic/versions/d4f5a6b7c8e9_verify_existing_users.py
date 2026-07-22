"""Mark pre-existing users as email-verified.

Email verification is now enforced by `get_current_active_user`, which every
feature route depends on. Accounts created before that change have
is_verified = false and were never asked to verify, so without this backfill
they would be locked out of an app they could previously use.

Only accounts that already exist at migration time are grandfathered in. New
registrations still start unverified and must complete the OTP flow.

Revision ID: d4f5a6b7c8e9
Revises: c3e4f5a6b7d8
"""
from alembic import op

revision = 'd4f5a6b7c8e9'
down_revision = 'c3e4f5a6b7d8'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE users SET is_verified = true WHERE is_verified = false")


def downgrade():
    # Deliberately not reversed: we can't tell which users were verified by this
    # backfill and which verified legitimately afterwards, and guessing wrong
    # would lock real users out. Leaving them verified is the safe direction.
    pass
