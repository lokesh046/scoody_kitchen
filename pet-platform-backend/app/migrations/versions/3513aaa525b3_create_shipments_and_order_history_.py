"""create_shipments_and_order_history_tables

Revision ID: 3513aaa525b3
Revises: 09cdf7b28711
Create Date: 2026-08-16 20:10:30.803068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '3513aaa525b3'
down_revision: Union[str, Sequence[str], None] = '09cdf7b28711'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new enum values to existing PostgreSQL order_status type
    new_values = ['packed', 'in_transit', 'out_for_delivery', 'returned', 'delivery_failed']
    for val in new_values:
        op.execute(f"ALTER TYPE order_status ADD VALUE IF NOT EXISTS '{val}'")

    op.create_table(
        'processed_webhook_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('provider_event_id', sa.String(length=255), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_processed_webhook_events_id'), 'processed_webhook_events', ['id'], unique=False)
    op.create_index(op.f('ix_processed_webhook_events_provider_event_id'), 'processed_webhook_events', ['provider_event_id'], unique=True)

    order_status_enum = postgresql.ENUM(
        'pending', 'confirmed', 'processing', 'packed', 'shipped', 'in_transit',
        'out_for_delivery', 'delivered', 'returned', 'delivery_failed', 'cancelled', 'completed',
        name='order_status',
        create_type=False,
    )

    op.create_table(
        'order_status_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('status', order_status_enum, nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_status_history_id'), 'order_status_history', ['id'], unique=False)
    op.create_index(op.f('ix_order_status_history_order_id'), 'order_status_history', ['order_id'], unique=False)

    op.create_table(
        'shipments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('provider_shipment_id', sa.String(length=255), nullable=True),
        sa.Column('provider_tracker_id', sa.String(length=255), nullable=True),
        sa.Column('tracking_number', sa.String(length=255), nullable=False),
        sa.Column('carrier', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=100), nullable=False),
        sa.Column('estimated_delivery', sa.DateTime(timezone=True), nullable=True),
        sa.Column('shipped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shipments_id'), 'shipments', ['id'], unique=False)
    op.create_index(op.f('ix_shipments_order_id'), 'shipments', ['order_id'], unique=True)
    op.create_index(op.f('ix_shipments_provider_shipment_id'), 'shipments', ['provider_shipment_id'], unique=False)
    op.create_index(op.f('ix_shipments_provider_tracker_id'), 'shipments', ['provider_tracker_id'], unique=True)
    op.create_index(op.f('ix_shipments_tracking_number'), 'shipments', ['tracking_number'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_shipments_tracking_number'), table_name='shipments')
    op.drop_index(op.f('ix_shipments_provider_tracker_id'), table_name='shipments')
    op.drop_index(op.f('ix_shipments_provider_shipment_id'), table_name='shipments')
    op.drop_index(op.f('ix_shipments_order_id'), table_name='shipments')
    op.drop_index(op.f('ix_shipments_id'), table_name='shipments')
    op.drop_table('shipments')
    op.drop_index(op.f('ix_order_status_history_order_id'), table_name='order_status_history')
    op.drop_index(op.f('ix_order_status_history_id'), table_name='order_status_history')
    op.drop_table('order_status_history')
    op.drop_index(op.f('ix_processed_webhook_events_provider_event_id'), table_name='processed_webhook_events')
    op.drop_index(op.f('ix_processed_webhook_events_id'), table_name='processed_webhook_events')
    op.drop_table('processed_webhook_events')
