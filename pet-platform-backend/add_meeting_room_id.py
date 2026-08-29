import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text
import uuid

statements = [
    'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS meeting_room_id VARCHAR(100) NULL;'
]

print("Starting database schema updates for Consultations virtual meeting rooms...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            print(f"Executing: {stmt}")
            conn.execute(text(stmt))
            conn.commit()
            print("Successfully applied column.")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

    # Populate existing rows with random meeting_room_ids
    try:
        print("Populating existing consultations with unique meeting room IDs...")
        res = conn.execute(text("SELECT id FROM consultations WHERE meeting_room_id IS NULL;"))
        rows = res.fetchall()
        for row in rows:
            cid = row[0]
            new_room_id = str(uuid.uuid4())
            conn.execute(text(f"UPDATE consultations SET meeting_room_id = '{new_room_id}' WHERE id = {cid};"))
            print(f"Set room ID '{new_room_id}' for consultation #{cid}")
        conn.commit()
        print("Successfully updated existing records.")
    except Exception as e:
        print(f"Error populating meeting room IDs: {e}")
        conn.rollback()

print("Schema update complete.")
