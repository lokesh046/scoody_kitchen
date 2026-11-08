"""vaccine_rules_match_vet_sheets

Brings the dog and cat rules in line with the vet-reference spreadsheets (4 puppy DHPP doses, the 26-week
booster, rabies at about 13 weeks, ...) and adds goat, cattle and buffalo. Adds booster_weeks (a booster set
in weeks, like the 26-week one); booster_months / repeat_months may now be 0 for once-in-a-lifetime vaccines.
All of these rules stay "draft" (vet_reviewed = false) until a platform vet signs them off.

Revision ID: e5f1b7c2d936
Revises: d4e9a1b6c258
Create Date: 2026-11-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e5f1b7c2d936'
down_revision: Union[str, Sequence[str], None] = 'd4e9a1b6c258'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLS = ("first_dose_weeks", "series_doses", "series_interval_weeks", "booster_months", "repeat_months", "booster_weeks")

# (species, code): new values for dog and cat, and the values they had before (for downgrade)
UPDATED = {
    ("dog", "dhppi"):         ((7, 4, 3, 12, 36, 10), (6, 3, 3, 12, 36, None)),
    ("dog", "rabies"):        ((13, 1, 0, 12, 12, None), (12, 1, 0, 12, 12, None)),
    ("dog", "leptospirosis"): ((10, 2, 3, 12, 12, None), (12, 2, 3, 12, 12, None)),
    ("cat", "fvrcp"):         ((8, 3, 4, 12, 36, 10), (8, 3, 4, 12, 36, None)),
    ("cat", "felv"):          ((8, 2, 4, 12, 24, None), (8, 2, 4, 12, 12, None)),
}

# (code, name, category, description, first_dose_weeks, series_doses, series_interval_weeks, booster_months, repeat_months)
GOAT = [
    ("fmd", "FMD (foot-and-mouth disease)", "core",
     "Free in government campaigns. First dose at 3 months, a booster 3-4 weeks later, then every 6 months.", 13, 2, 3, 6, 6),
    ("hs", "HS (haemorrhagic septicaemia)", "core",
     "First dose at 3-5 months with a booster 3-4 weeks later, then yearly before the monsoon.", 13, 2, 3, 12, 12),
    ("enterotoxaemia", "Enterotoxaemia (ET)", "core",
     "Overeating disease. First dose at 4 months, a booster 3-4 weeks later, then yearly before the monsoon.", 17, 2, 3, 12, 12),
    ("ppr", "PPR (goat plague)", "core",
     "Peste des petits ruminants. First dose at 4 months, then yearly. Free in government campaigns.", 17, 1, 0, 12, 12),
    ("goat_pox", "Goat pox", "core",
     "First dose at 4 months, then yearly. A combined PPR + goat pox vaccine is available.", 17, 1, 0, 12, 12),
    ("anthrax", "Anthrax (endemic areas only)", "non_core",
     "Only where your vet reports anthrax. Yearly, or every 6 months where exposure continues.", 13, 1, 0, 12, 12),
    ("orf", "ORF (contagious ecthyma)", "non_core",
     "Optional, from 4 months. Repeat every 6 months where orf is common.", 17, 1, 0, 6, 6),
]
CATTLE = [
    ("fmd", "FMD (foot-and-mouth disease)", "core",
     "Free under the National Animal Disease Control Programme. First dose at 4 months, a booster 1 month later, then every 6 months.", 17, 2, 4, 6, 6),
    ("lsd", "Lumpy skin disease (LSD)", "core",
     "Yearly mass vaccination since 2021-22. Follow your state department's campaign dates.", 52, 1, 0, 12, 12),
    ("hs", "HS (haemorrhagic septicaemia)", "core",
     "From 6 months, then yearly before the monsoon (May-June).", 26, 1, 0, 12, 12),
    ("bq", "BQ (black quarter)", "core",
     "From 6 months, then yearly before the monsoon (May-June).", 26, 1, 0, 12, 12),
    ("theileriosis", "Theileriosis (tick fever)", "non_core",
     "For crossbred and exotic cattle only, at 3 months. Once in a lifetime.", 13, 1, 0, 0, 0),
    ("anthrax", "Anthrax (endemic areas only)", "non_core",
     "Only where your vet reports anthrax. Yearly.", 17, 1, 0, 12, 12),
    ("brucellosis", "Brucellosis (female calves only)", "non_core",
     "Female calves at 4-8 months. Once in a lifetime. Free in government campaigns.", 26, 1, 0, 0, 0),
]
NEW = [("goat", GOAT), ("cattle", CATTLE), ("buffalo", CATTLE)]

schedules = sa.table(
    "vaccine_schedules",
    sa.column("species", sa.String), sa.column("code", sa.String), sa.column("name", sa.String),
    sa.column("category", sa.String), sa.column("description", sa.Text),
    sa.column("first_dose_weeks", sa.Integer), sa.column("series_doses", sa.Integer),
    sa.column("series_interval_weeks", sa.Integer), sa.column("booster_months", sa.Integer),
    sa.column("repeat_months", sa.Integer), sa.column("booster_weeks", sa.Integer),
    sa.column("sort_order", sa.Integer), sa.column("is_active", sa.Boolean), sa.column("vet_reviewed", sa.Boolean),
)


def upgrade() -> None:
    op.add_column('vaccine_schedules', sa.Column('booster_weeks', sa.Integer(), nullable=True))

    for (species, code), (new, _old) in UPDATED.items():
        op.execute(
            schedules.update()
            .where(sa.and_(schedules.c.species == species, schedules.c.code == code))
            .values(dict(zip(COLS, new)))
        )

    bind = op.get_bind()
    for species, rules in NEW:
        have = {r[0] for r in bind.execute(sa.select(schedules.c.code).where(schedules.c.species == species))}
        rows = [
            {"species": species, "code": c, "name": n, "category": cat, "description": d,
             "first_dose_weeks": fw, "series_doses": sd, "series_interval_weeks": si,
             "booster_months": bm, "repeat_months": rm, "booster_weeks": None,
             "sort_order": i, "is_active": True, "vet_reviewed": False}
            for i, (c, n, cat, d, fw, sd, si, bm, rm) in enumerate(rules) if c not in have
        ]
        if rows:
            op.bulk_insert(schedules, rows)


def downgrade() -> None:
    for species, _rules in NEW:
        op.execute(schedules.delete().where(schedules.c.species == species))
    for (species, code), (_new, old) in UPDATED.items():
        op.execute(
            schedules.update()
            .where(sa.and_(schedules.c.species == species, schedules.c.code == code))
            .values(dict(zip(COLS, old)))
        )
    op.drop_column('vaccine_schedules', 'booster_weeks')
