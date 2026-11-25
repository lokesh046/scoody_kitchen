"""defer_user_row_to_magic_link_verify

Stops creating a `user` row the moment someone requests a login code. A pending magic-link
signup now lives entirely on `magic_link_tokens` (email + first/last name), and the real
`user` row is only created once the code/link is actually verified. This keeps `user.id`
from burning through ids for OTP requests that never get verified (typos, bots, abandoned
sign-ins) -- today those are later deleted by cleanup_unverified_users and never reclaimed.

Purely additive: `user_id` becomes nullable and three new nullable columns are added.
Existing rows (user_id already set) are untouched and keep verifying exactly as before,
so a login already in flight at deploy time is unaffected.

Revision ID: 4e8e67134b70
Revises: e5f1b7c2d936
Create Date: 2026-11-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '4e8e67134b70'
down_revision: Union[str, Sequence[str], None] = 'e5f1b7c2d936'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('magic_link_tokens', 'user_id', existing_type=sa.Integer(), nullable=True)
    op.add_column('magic_link_tokens', sa.Column('email', sa.String(length=255), nullable=True))
    op.add_column('magic_link_tokens', sa.Column('pending_first_name', sa.String(length=50), nullable=True))
    op.add_column('magic_link_tokens', sa.Column('pending_last_name', sa.String(length=50), nullable=True))
    op.create_index('ix_magic_link_tokens_email', 'magic_link_tokens', ['email'])


def downgrade() -> None:
    op.drop_index('ix_magic_link_tokens_email', table_name='magic_link_tokens')
    op.drop_column('magic_link_tokens', 'pending_last_name')
    op.drop_column('magic_link_tokens', 'pending_first_name')
    op.drop_column('magic_link_tokens', 'email')
    op.alter_column('magic_link_tokens', 'user_id', existing_type=sa.Integer(), nullable=False)
