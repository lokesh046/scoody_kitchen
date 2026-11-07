"""create_vaccination_tables

Vaccine rulebook (per species), owner-recorded doses, and a sent-reminder log. Seeds the
draft dog and cat rules.

Revision ID: b9c4e1d7a203
Revises: a7b2d9c3e514
Create Date: 2026-11-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.services.vaccine_rules_seed import SEED_RULES

revision: str = 'b9c4e1d7a203'
down_revision: Union[str, Sequence[str], None] = 'a7b2d9c3e514'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    schedules = op.create_table(
        'vaccine_schedules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('species', sa.String(30), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('category', sa.String(20), nullable=False, server_default='core'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('first_dose_weeks', sa.Integer(), nullable=False),
        sa.Column('series_doses', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('series_interval_weeks', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('booster_months', sa.Integer(), nullable=False, server_default='12'),
        sa.Column('repeat_months', sa.Integer(), nullable=False, server_default='12'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('vet_reviewed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint('species', 'code', name='uq_vaccine_schedule_species_code'),
    )
    op.create_index('ix_vaccine_schedules_id', 'vaccine_schedules', ['id'])
    op.create_index('ix_vaccine_schedules_species', 'vaccine_schedules', ['species'])

    op.create_table(
        'pet_vaccinations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('pet_id', sa.Integer(), sa.ForeignKey('pets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vaccine_code', sa.String(40), nullable=False),
        sa.Column('date_given', sa.Date(), nullable=False),
        sa.Column('clinic_name', sa.String(150), nullable=True),
        sa.Column('batch_number', sa.String(60), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_pet_vaccinations_id', 'pet_vaccinations', ['id'])
    op.create_index('ix_pet_vaccinations_pet_id', 'pet_vaccinations', ['pet_id'])

    op.create_table(
        'vaccination_reminders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('pet_id', sa.Integer(), sa.ForeignKey('pets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vaccine_code', sa.String(40), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('kind', sa.String(10), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('pet_id', 'vaccine_code', 'due_date', 'kind', name='uq_vaccination_reminder'),
    )
    op.create_index('ix_vaccination_reminders_pet_id', 'vaccination_reminders', ['pet_id'])

    op.bulk_insert(schedules, [
        {
            'species': sp, 'code': code, 'name': name, 'category': cat, 'description': desc,
            'first_dose_weeks': fw, 'series_doses': sd, 'series_interval_weeks': si,
            'booster_months': bm, 'repeat_months': rm, 'sort_order': i, 'is_active': True, 'vet_reviewed': False,
        }
        for i, (sp, code, name, cat, desc, fw, sd, si, bm, rm) in enumerate(SEED_RULES)
    ])


def downgrade() -> None:
    op.drop_table('vaccination_reminders')
    op.drop_table('pet_vaccinations')
    op.drop_table('vaccine_schedules')
