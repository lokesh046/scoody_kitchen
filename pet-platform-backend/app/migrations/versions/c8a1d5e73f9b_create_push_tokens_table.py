"""create_push_tokens_table

Revision ID: c8a1d5e73f9b
Revises: b7e4f1a92c3d
Create Date: 2026-09-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8a1d5e73f9b'
down_revision: Union[str, Sequence[str], None] = 'b7e4f1a92c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('push_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('expo_push_token', sa.String(length=255), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('expo_push_token')
    )
    op.create_index(op.f('ix_push_tokens_expo_push_token'), 'push_tokens', ['expo_push_token'], unique=True)
    op.create_index(op.f('ix_push_tokens_id'), 'push_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_push_tokens_user_id'), 'push_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_push_tokens_user_id'), table_name='push_tokens')
    op.drop_index(op.f('ix_push_tokens_id'), table_name='push_tokens')
    op.drop_index(op.f('ix_push_tokens_expo_push_token'), table_name='push_tokens')
    op.drop_table('push_tokens')
