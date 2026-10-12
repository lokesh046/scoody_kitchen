"""One-off schema migration for the newsletter feature — run once on the server.
Same raw-SQL CREATE TABLE IF NOT EXISTS pattern as create_faqs_table.py / create_blog_table.py.
"""

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        source VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers (email);",
]

print("Starting database schema update for newsletter...")
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
