"""add_consultation_link_and_read_tracking_to_support_tickets

Revision ID: b7e4f1a92c3d
Revises: a3f7c9d21b48
Create Date: 2026-09-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e4f1a92c3d'
down_revision: Union[str, Sequence[str], None] = 'a3f7c9d21b48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE support_ticket_category ADD VALUE IF NOT EXISTS 'consultation_issue'")

    op.add_column('support_tickets', sa.Column('consultation_id', sa.Integer(), nullable=True))
    op.add_column('support_tickets', sa.Column('customer_last_read_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('support_tickets', sa.Column('admin_last_read_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_support_tickets_consultation_id'), 'support_tickets', ['consultation_id'], unique=False)
    op.create_foreign_key(
        'fk_support_tickets_consultation_id_consultations',
        'support_tickets', 'consultations',
        ['consultation_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_support_tickets_consultation_id_consultations', 'support_tickets', type_='foreignkey')
    op.drop_index(op.f('ix_support_tickets_consultation_id'), table_name='support_tickets')
    op.drop_column('support_tickets', 'admin_last_read_at')
    op.drop_column('support_tickets', 'customer_last_read_at')
    op.drop_column('support_tickets', 'consultation_id')
    # Removing 'consultation_issue' from the enum type is intentionally not
    # reversed — Postgres requires recreating the entire enum type to drop a
    # value, and any existing rows using it would need migrating first. Same
    # convention as f50a781fc2d1_add_doctor_to_user_role_enum.py.
