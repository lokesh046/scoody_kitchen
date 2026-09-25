"""create_support_tickets_and_messages_tables

Revision ID: a3f7c9d21b48
Revises: 0fdad9913702
Create Date: 2026-09-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f7c9d21b48'
down_revision: Union[str, Sequence[str], None] = '0fdad9913702'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('support_tickets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('customer_id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=True),
    sa.Column('subject', sa.String(length=200), nullable=False),
    sa.Column('category', sa.Enum('order_issue', 'product_issue', 'payment', 'account', 'other', name='support_ticket_category'), nullable=False),
    sa.Column('status', sa.Enum('open', 'in_progress', 'resolved', 'closed', name='support_ticket_status'), nullable=False),
    sa.Column('assigned_admin_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['assigned_admin_id'], ['user.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['customer_id'], ['user.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_support_tickets_assigned_admin_id'), 'support_tickets', ['assigned_admin_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_category'), 'support_tickets', ['category'], unique=False)
    op.create_index(op.f('ix_support_tickets_created_at'), 'support_tickets', ['created_at'], unique=False)
    op.create_index(op.f('ix_support_tickets_customer_id'), 'support_tickets', ['customer_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_id'), 'support_tickets', ['id'], unique=False)
    op.create_index(op.f('ix_support_tickets_order_id'), 'support_tickets', ['order_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_status'), 'support_tickets', ['status'], unique=False)

    op.create_table('support_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ticket_id', sa.Integer(), nullable=False),
    sa.Column('sender_id', sa.Integer(), nullable=False),
    sa.Column('is_staff_reply', sa.Boolean(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['sender_id'], ['user.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_support_messages_created_at'), 'support_messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_support_messages_id'), 'support_messages', ['id'], unique=False)
    op.create_index(op.f('ix_support_messages_sender_id'), 'support_messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_support_messages_ticket_id'), 'support_messages', ['ticket_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_support_messages_ticket_id'), table_name='support_messages')
    op.drop_index(op.f('ix_support_messages_sender_id'), table_name='support_messages')
    op.drop_index(op.f('ix_support_messages_id'), table_name='support_messages')
    op.drop_index(op.f('ix_support_messages_created_at'), table_name='support_messages')
    op.drop_table('support_messages')

    op.drop_index(op.f('ix_support_tickets_status'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_order_id'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_id'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_customer_id'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_created_at'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_category'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_assigned_admin_id'), table_name='support_tickets')
    op.drop_table('support_tickets')
    sa.Enum(name='support_ticket_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='support_ticket_category').drop(op.get_bind(), checkfirst=True)
