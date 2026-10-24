"""add_image_url_to_categories

Revision ID: f3c7a8d91e52
Revises: e1a9c4f6b283
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3c7a8d91e52'
down_revision: Union[str, Sequence[str], None] = 'e1a9c4f6b283'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'categories',
        sa.Column('image_url', sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('categories', 'image_url')
