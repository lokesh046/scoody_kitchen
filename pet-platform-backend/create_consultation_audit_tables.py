import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

statements = [
    """
    CREATE TABLE IF NOT EXISTS consultation_sessions (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        room_id VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP WITH TIME ZONE NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_consultation_sessions_consultation_id ON consultation_sessions(consultation_id);",
    "CREATE INDEX IF NOT EXISTS idx_consultation_sessions_room_id ON consultation_sessions(room_id);",
    """
    CREATE TABLE IF NOT EXISTS consultation_participants (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES consultation_sessions(id) ON DELETE CASCADE,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'participant',
        joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        left_at TIMESTAMP WITH TIME ZONE NULL,
        duration_seconds INTEGER NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_consultation_participants_session_id ON consultation_participants(session_id);",
    "CREATE INDEX IF NOT EXISTS idx_consultation_participants_consultation_id ON consultation_participants(consultation_id);",
    "CREATE INDEX IF NOT EXISTS idx_consultation_participants_user_id ON consultation_participants(user_id);"
]

print("Starting database schema updates for Consultation Sessions and Participants audit tables...")
with engine.connect() as conn:
    for stmt in statements:
        try:
            conn.execute(text(stmt))
            conn.commit()
            print("Successfully executed statement.")
        except Exception as e:
            print(f"Error during execution: {e}")
            conn.rollback()

print("Schema update complete.")
