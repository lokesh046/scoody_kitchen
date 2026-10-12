"""One-off schema migration for the FAQ feature — run once on the server.
Follows the same raw-SQL CREATE TABLE IF NOT EXISTS pattern as
create_reviews_table.py rather than an ORM migration tool, matching this
project's existing convention for adding new tables.
"""

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        question VARCHAR(300) NOT NULL,
        answer TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_faqs_display_order ON faqs (display_order);",
]

print("Starting database schema update for FAQs...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            print("Executing statement...")
            conn.execute(text(stmt))
            conn.commit()
            print("Successfully applied.")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Schema update complete.")
