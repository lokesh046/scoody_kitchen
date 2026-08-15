"""add_fulltext_gin_indexes

Revision ID: d4b3609ee3c8
Revises: 95d5e3236013
Create Date: 2026-08-14 10:29:42.679745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4b3609ee3c8'
down_revision: Union[str, Sequence[str], None] = '95d5e3236013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_product_fulltext 
        ON product 
        USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_doctors_fulltext 
        ON doctors 
        USING gin(to_tsvector('english', coalesce(specialization, '') || ' ' || coalesce(qualification, '') || ' ' || coalesce(bio, '')));
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_product_fulltext;")
    op.execute("DROP INDEX IF EXISTS ix_doctors_fulltext;")
