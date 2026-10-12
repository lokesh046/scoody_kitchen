"""One-off schema migration adding cover_image_url to blog_posts — run once on the server."""

from app.core.database import engine
from sqlalchemy import text

statements = [
    "ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);",
]

print("Starting database schema update for blog cover image...")
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
