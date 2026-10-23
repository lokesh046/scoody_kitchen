"""add_parent_category_id_to_categories

Revision ID: e1a9c4f6b283
Revises: d4f8b6c1a927
Create Date: 2026-10-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a9c4f6b283'
down_revision: Union[str, Sequence[str], None] = 'd4f8b6c1a927'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable + no server_default: every existing category keeps
    # parent_category_id = NULL, i.e. stays a top-level category exactly
    # as before. Nothing about existing data or the flat /product?category_id
    # filtering changes.
    op.add_column(
        'categories',
        sa.Column('parent_category_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_categories_parent_category_id',
        'categories', 'categories',
        ['parent_category_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_categories_parent_category_id',
        'categories',
        ['parent_category_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_categories_parent_category_id', table_name='categories')
    op.drop_constraint('fk_categories_parent_category_id', 'categories', type_='foreignkey')
    op.drop_column('categories', 'parent_category_id')
