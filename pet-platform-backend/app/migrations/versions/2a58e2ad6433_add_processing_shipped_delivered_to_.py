"""add_processing_shipped_delivered_to_order_status

Revision ID: 2a58e2ad6433
Revises: 01818dc39daa
Create Date: 2026-08-13 20:01:40.027543

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a58e2ad6433'
down_revision: Union[str, Sequence[str], None] = '01818dc39daa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'processing'")
    op.execute("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'shipped'")
    op.execute("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivered'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
