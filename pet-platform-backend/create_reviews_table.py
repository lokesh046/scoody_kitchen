import sys
sys.path.insert(0, "/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend")
sys.path.insert(0, "/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend/.venv/lib/python3.13/site-packages")

import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS doctor_reviews (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL UNIQUE REFERENCES consultations(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor_id ON doctor_reviews (doctor_id);",
    "CREATE INDEX IF NOT EXISTS idx_doctor_reviews_customer_id ON doctor_reviews (customer_id);",
    """
    CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        comment TEXT,
        image_url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews (product_id);",
    "CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews (user_id);"
]

print("Starting database schema updates for Reviews...")
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
