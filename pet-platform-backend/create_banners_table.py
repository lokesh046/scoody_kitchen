import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS banners (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NULL,
        subtitle VARCHAR(500) NULL,
        image_url VARCHAR(500) NOT NULL,
        link_url VARCHAR(500) NULL,
        display_order INTEGER DEFAULT 0 NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
    );
    """
]

print("Starting banners table database migration...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            print(f"Executing: {stmt.strip()}")
            conn.execute(text(stmt))
            conn.commit()
            print("Successfully executed.")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Banners table migration complete.")
