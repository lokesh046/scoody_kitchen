"""add_fallback_behavior_to_feature_flags

Revision ID: d4f8b6c1a927
Revises: c8a1d5e73f9b
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f8b6c1a927'
down_revision: Union[str, Sequence[str], None] = 'c8a1d5e73f9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'feature_flags',
        sa.Column('fallback_behavior', sa.String(length=20), nullable=False, server_default='hide'),
    )


def downgrade() -> None:
    op.drop_column('feature_flags', 'fallback_behavior')
