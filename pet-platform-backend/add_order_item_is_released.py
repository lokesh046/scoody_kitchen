import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

statements = [
    'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_released BOOLEAN NOT NULL DEFAULT FALSE;',
    "UPDATE order_items SET is_released = TRUE WHERE order_id IN (SELECT id FROM orders WHERE UPPER(status::text) = 'CANCELLED');"
]

print("Starting database schema updates for OrderItem is_released...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            print(f"Executing: {stmt}")
            result = conn.execute(text(stmt))
            conn.commit()
            print(f"Successfully applied. Rows affected: {result.rowcount}")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Schema update complete.")
