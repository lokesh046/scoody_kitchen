"""One-off schema migration for account deletion: run once per environment.

Needs the table-owner database role (the app role cannot change tables), for example on the server:
    docker exec -e DATABASE_URL=postgresql://hearth_owner:<OWNER_PW>@hearth_pg_beta:5432/hearth \
        pet_platform_backend_beta python add_account_deletion.py
Same raw-SQL "IF NOT EXISTS" pattern as the other add_*/create_* scripts, so it is safe to run twice.
"""

from app.core.database import engine
from sqlalchemy import text

statements = [
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;',
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;',
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;',
    'CREATE INDEX IF NOT EXISTS ix_user_deletion_scheduled_for ON "user" (deletion_scheduled_for);',
    """
    CREATE TABLE IF NOT EXISTS deleted_account_archive (
        id SERIAL PRIMARY KEY,
        former_user_id INTEGER NOT NULL,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        payload BYTEA NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_deleted_account_archive_former_user_id ON deleted_account_archive (former_user_id);",
    "CREATE INDEX IF NOT EXISTS ix_deleted_account_archive_archived_at ON deleted_account_archive (archived_at);",
    "CREATE INDEX IF NOT EXISTS ix_deleted_account_archive_expires_at ON deleted_account_archive (expires_at);",
]

print("Starting database schema update for account deletion...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            conn.execute(text(stmt))
            conn.commit()
            print("Applied:", " ".join(stmt.split())[:90])
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Schema update complete.")
