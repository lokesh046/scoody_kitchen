import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

import os
from sqlalchemy import create_engine, MetaData, text
from app.core.config import settings

# Get DATABASE_URL
database_url = settings.DATABASE_URL
# Convert standard postgresql scheme to sqlaclhemy postgresql+psycopg
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

print("Connecting to database...")
engine = create_engine(database_url)
meta = MetaData()
meta.reflect(bind=engine)

print("Syncing PostgreSQL sequences...")
with engine.connect() as conn:
    for table in meta.sorted_tables:
        if 'id' in table.columns:
            res = conn.execute(text(f"SELECT MAX(id) FROM \"{table.name}\"")).scalar()
            if res is not None:
                # Find the sequence name associated with the id column
                seq_name = f"{table.name}_id_seq"
                try:
                    conn.execute(text(f"SELECT setval('{seq_name}', {res})"))
                    print(f"  - Reset sequence '{seq_name}' to {res}.")
                except Exception as e:
                    # Fallback to pg_get_serial_sequence
                    try:
                        conn.rollback()
                        real_seq = conn.execute(text(f"SELECT pg_get_serial_sequence('\"{table.name}\"', 'id')")).scalar()
                        if real_seq:
                            conn.execute(text(f"SELECT setval('{real_seq}', {res})"))
                            print(f"  - Reset sequence '{real_seq}' to {res}.")
                    except Exception as ex:
                        print(f"  - Could not reset sequence for table '{table.name}': {ex}")
            conn.commit()

print("Sequence synchronization complete!")
