"""Adds the optional microchip number to pets. Safe to run more than once.

Run as the table owner (same as add_account_deletion.py):
  docker exec -e DATABASE_URL=postgresql://hearth_owner:<OWNER_PW>@hearth_pg_beta:5432/hearth \
    pet_platform_backend_beta python add_pet_microchip.py
"""
from sqlalchemy import text

from app.core.database import engine

STATEMENTS = [
    "ALTER TABLE pets ADD COLUMN IF NOT EXISTS microchip_number VARCHAR(15) DEFAULT NULL;",
]

print("Adding pets.microchip_number ...")
with engine.begin() as conn:
    for stmt in STATEMENTS:
        print(f"Executing: {stmt}")
        conn.execute(text(stmt))
print("Done.")
