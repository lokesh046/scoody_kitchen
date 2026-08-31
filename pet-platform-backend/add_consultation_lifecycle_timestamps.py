import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

statements = [
    'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE NULL;',
    'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE NULL;'
]

print("Starting database schema updates for Consultation lifecycle timestamps (started_at, ended_at)...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            print(f"Executing: {stmt}")
            conn.execute(text(stmt))
            conn.commit()
            print("Successfully applied column statement.")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Schema update complete.")
