import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

statements = [
    "ALTER TABLE product ADD COLUMN IF NOT EXISTS in_slider BOOLEAN DEFAULT FALSE;"
]

print("Starting database schema updates...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            print(f"Executing: {stmt}")
            conn.execute(text(stmt))
            conn.commit()
            print("Successfully applied.")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Schema update complete.")
