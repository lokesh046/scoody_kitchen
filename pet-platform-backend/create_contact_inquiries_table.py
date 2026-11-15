"""One-off schema migration for the Contact page (Get in touch) - run once on the server.
Same raw-SQL CREATE TABLE IF NOT EXISTS pattern as create_newsletter_table.py.
"""

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS contact_inquiries (
        id SERIAL PRIMARY KEY,
        reason VARCHAR(30) NOT NULL,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        notes TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_contact_inquiries_reason ON contact_inquiries (reason);",
    "CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at ON contact_inquiries (created_at);",
]

print("Starting database schema update for contact inquiries...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            conn.execute(text(stmt))
            conn.commit()
            print("Applied.")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Schema update complete.")
