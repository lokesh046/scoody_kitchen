"""add_page_to_faqs_and_placement_to_banners

Lets the admin choose which page a FAQ belongs to (home, shop, pets, vet) and where a
banner is used (home carousel, a landing-page hero, or a home toolkit card). Existing
rows become 'home', which is exactly where they have always appeared.

Revision ID: a7b2d9c3e514
Revises: f3c7a8d91e52
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b2d9c3e514'
down_revision: Union[str, Sequence[str], None] = 'f3c7a8d91e52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column in {c['name'] for c in inspector.get_columns(table)}


def upgrade() -> None:
    if not _has_column('faqs', 'page'):
        op.add_column(
            'faqs',
            sa.Column('page', sa.String(length=20), nullable=False, server_default='home'),
        )
    if not _has_column('banners', 'placement'):
        op.add_column(
            'banners',
            sa.Column('placement', sa.String(length=30), nullable=False, server_default='home'),
        )


def downgrade() -> None:
    if _has_column('banners', 'placement'):
        op.drop_column('banners', 'placement')
    if _has_column('faqs', 'page'):
        op.drop_column('faqs', 'page')
