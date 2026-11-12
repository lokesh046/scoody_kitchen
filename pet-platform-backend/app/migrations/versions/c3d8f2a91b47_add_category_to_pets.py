"""add_category_to_pets

Stores a dog's category (Working, Hound, Sporting, Companion) on the pet so food and care can be suggested by
category. Existing dogs are filled in from their breed; pets whose breed isn't recognised stay empty.

Revision ID: c3d8f2a91b47
Revises: b9c4e1d7a203
Create Date: 2026-11-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.services.breed_category import category_for_breed

revision: str = 'c3d8f2a91b47'
down_revision: Union[str, Sequence[str], None] = 'b9c4e1d7a203'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pets', sa.Column('category', sa.String(20), nullable=True))
    op.create_index('ix_pets_category', 'pets', ['category'])
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, breed FROM pets WHERE lower(species) = 'dog' AND breed IS NOT NULL")).fetchall()
    for pet_id, breed in rows:
        category = category_for_breed(breed)
        if category:
            conn.execute(sa.text("UPDATE pets SET category = :c WHERE id = :i"), {"c": category, "i": pet_id})


def downgrade() -> None:
    op.drop_index('ix_pets_category', table_name='pets')
    op.drop_column('pets', 'category')
