"""One-off schema migration for the blog feature — run once on the server.
Same raw-SQL CREATE TABLE IF NOT EXISTS pattern as create_faqs_table.py.
"""

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(300) NOT NULL,
        slug VARCHAR(300) NOT NULL UNIQUE,
        excerpt VARCHAR(300),
        content_html TEXT NOT NULL,
        primary_keyword VARCHAR(200),
        keywords TEXT,
        meta_description VARCHAR(200),
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);",
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);",
]

print("Starting database schema update for Blog...")
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
