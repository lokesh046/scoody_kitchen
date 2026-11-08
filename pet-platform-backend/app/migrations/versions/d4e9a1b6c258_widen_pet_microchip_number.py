"""widen_pet_microchip_number

Microchip numbers may now be up to 30 digits (the column held 15).

Revision ID: d4e9a1b6c258
Revises: c3d8f2a91b47
Create Date: 2026-11-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd4e9a1b6c258'
down_revision: Union[str, Sequence[str], None] = 'c3d8f2a91b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('pets', 'microchip_number', existing_type=sa.String(15), type_=sa.String(30), existing_nullable=True)


def downgrade() -> None:
    op.alter_column('pets', 'microchip_number', existing_type=sa.String(30), type_=sa.String(15), existing_nullable=True)
