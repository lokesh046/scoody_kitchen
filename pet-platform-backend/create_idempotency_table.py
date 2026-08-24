import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS idempotency_keys (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) NOT NULL,
        user_id INTEGER NOT NULL,
        response TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_user_key UNIQUE (user_id, key)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_key ON idempotency_keys (user_id, key);"
]

print("Starting database schema updates for Idempotency Keys...")
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
