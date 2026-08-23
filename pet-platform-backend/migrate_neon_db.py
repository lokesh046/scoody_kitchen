import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

import sys
from sqlalchemy import create_engine, MetaData

if len(sys.argv) < 2:
    print("Error: Please provide the new database URL as an argument.")
    print("Usage: ./.venv/bin/python migrate_neon_db.py 'postgresql://...'")
    sys.exit(1)

OLD_DB_URL = "postgresql+psycopg://neondb_owner:npg_y36pogqnBOhG@ep-weathered-pond-ayideagn-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"
NEW_DB_URL = sys.argv[1]

# Convert standard postgresql scheme to sqlaclhemy postgresql+psycopg
if NEW_DB_URL.startswith("postgresql://"):
    NEW_DB_URL = NEW_DB_URL.replace("postgresql://", "postgresql+psycopg://", 1)

print("Connecting to source database (US region)...")
old_engine = create_engine(OLD_DB_URL)
old_meta = MetaData()
old_meta.reflect(bind=old_engine)

print("Connecting to target database (Singapore region)...")
new_engine = create_engine(NEW_DB_URL)

# Reflect & generate all tables
from app.core.database import Base
print("Creating schemas and tables in target database...")
Base.metadata.create_all(bind=new_engine)

print("Migrating records in order of dependency...")
for table in old_meta.sorted_tables:
    print(f"Reading table: {table.name}...")
    with old_engine.connect() as old_conn:
        rows = old_conn.execute(table.select()).fetchall()
    
    if not rows:
        print(f"Table {table.name} is empty. Skipping.")
        continue

    insert_data = [dict(row._mapping) for row in rows]
    
    # Ensure table exists in target database (handles dynamic metadata tables like alembic_version)
    table.create(bind=new_engine, checkfirst=True)

    with new_engine.connect() as new_conn:
        # Truncate new table if exists to prevent duplicate keys
        new_conn.execute(table.delete())
        # Insert all rows
        new_conn.execute(table.insert(), insert_data)
        new_conn.commit()
    print(f"Successfully migrated {len(rows)} records for {table.name}.")

print("Database region migration complete!")
