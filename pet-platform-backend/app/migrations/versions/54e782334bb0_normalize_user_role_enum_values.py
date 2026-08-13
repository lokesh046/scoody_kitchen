"""normalize user role enum values

Revision ID: 54e782334bb0
Revises: 0eaa8884e27d
Create Date: 2026-08-12 10:20:09.635279

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '54e782334bb0'
down_revision: Union[str, Sequence[str], None] = '0eaa8884e27d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

from alembic import op


def upgrade() -> None:
    op.execute(
        """
        ALTER TYPE user_role
        RENAME VALUE 'CUSTOMER' TO 'customer'
        """
    )

    op.execute(
        """
        ALTER TYPE user_role
        RENAME VALUE 'ADMIN' TO 'admin'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TYPE user_role
        RENAME VALUE 'customer' TO 'CUSTOMER'
        """
    )

    op.execute(
        """
        ALTER TYPE user_role
        RENAME VALUE 'admin' TO 'ADMIN'
        """
    )