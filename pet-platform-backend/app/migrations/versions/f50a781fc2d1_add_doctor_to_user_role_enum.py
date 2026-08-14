"""add_doctor_to_user_role_enum

Revision ID: f50a781fc2d1
Revises: 2a58e2ad6433
Create Date: 2026-08-13 21:00:49.544690

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f50a781fc2d1'
down_revision: Union[str, Sequence[str], None] = '2a58e2ad6433'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'doctor'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
