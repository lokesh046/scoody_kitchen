"""add user role enum

Revision ID: 0eaa8884e27d
Revises: 6dc92141028d
Create Date: 2026-08-11 22:47:32.299696

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0eaa8884e27d'
down_revision: Union[str, Sequence[str], None] = '6dc92141028d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    user_role_enum = postgresql.ENUM(
        "CUSTOMER",
        "ADMIN",
        name="user_role",
    )

    # 1. Create the PostgreSQL enum type
    user_role_enum.create(
        op.get_bind(),
        checkfirst=True,
    )

    # 2. Convert existing VARCHAR values to the enum
    op.execute(
        """
        ALTER TABLE "user"
        ALTER COLUMN role
        TYPE user_role
        USING UPPER(role)::user_role
        """
    )


def downgrade() -> None:
    # Convert enum back to VARCHAR
    op.execute(
        """
        ALTER TABLE "user"
        ALTER COLUMN role
        TYPE VARCHAR(20)
        USING LOWER(role::text)
        """
    )

    # Remove enum type
    op.execute(
        """
        DROP TYPE user_role
        """
    )
