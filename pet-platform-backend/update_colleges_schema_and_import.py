import socket
# Force IPv4 resolution
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

import csv
from sqlalchemy import create_engine, text
from urllib.parse import urlparse, urlunparse
from app.core.config import settings

def main():
    # Deriving the connection URL dynamically safely
    url_parts = list(urlparse(settings.DATABASE_URL))
    if url_parts[2] == "/neondb":
        url_parts[2] = "/college_db"
    college_db_url = urlunparse(url_parts)
    CSV_PATH = "/media/ganesh/2EB4C64AB4C613ED/scooby_pets/tamilnadu_colleges_sorted.csv"

    print(f"Connecting to colleges database: {college_db_url.split('@')[-1]}")
    engine = create_engine(college_db_url)

    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            # 1. Update columns
            print("1. Updating columns on colleges table...")
            conn.execute(text("""
                ALTER TABLE colleges 
                ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;
            """))
            conn.execute(text("""
                ALTER TABLE colleges 
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
            """))
            print("Columns verified/updated successfully.")

            # 2. Re-create trigram index CONCURRENTLY
            print("2. Re-creating trigram index CONCURRENTLY on colleges(name)...")
            conn.execute(text("DROP INDEX IF EXISTS idx_colleges_name_trgm;"))
            conn.execute(text("""
                CREATE INDEX CONCURRENTLY idx_colleges_name_trgm 
                ON colleges USING GIN (name gin_trgm_ops);
            """))
            print("GIN trigram index re-created concurrently.")

            # 3. Import and normalize CSV
            print("3. Truncating and re-importing normalized data from CSV...")
            conn.execute(text("TRUNCATE TABLE colleges;"))

            insert_stmt = text("""
                INSERT INTO colleges (state, name, address_line1, address_line2, city, district, pin_code, is_active)
                VALUES (:state, :name, :address_line1, :address_line2, :city, :district, :pin_code, :is_active);
            """)

            records = []
            with open(CSV_PATH, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Normalize string casing to consistent Title Case
                    name = row.get("name", "").strip().title()
                    city = row.get("city", "").strip().title()
                    district = row.get("district", "").strip().title()
                    state = row.get("state", "").strip().title()
                    
                    records.append({
                        "state": state,
                        "name": name,
                        "address_line1": row.get("address_line1", "").strip(),
                        "address_line2": row.get("address_line2", "").strip(),
                        "city": city,
                        "district": district,
                        "pin_code": row.get("pin_code", "").strip(),
                        "is_active": True
                    })

            if records:
                conn.execute(insert_stmt, records)
                print(f"Successfully normalized and imported {len(records)} college records.")

            # 4. Verify results
            total_count = conn.execute(text("SELECT COUNT(*) FROM colleges;")).scalar()
            active_count = conn.execute(text("SELECT COUNT(*) FROM colleges WHERE is_active = true;")).scalar()
            print(f"Total row count: {total_count}")
            print(f"Active row count: {active_count}")

            print("Preview of first 5 normalized rows:")
            rows = conn.execute(text("""
                SELECT id, name, city, district, is_active, last_updated 
                FROM colleges 
                ORDER BY id LIMIT 5;
            """)).fetchall()
            for r in rows:
                print(f"ID={r[0]} | Name='{r[1]}' | City='{r[2]}' | District='{r[3]}' | Active={r[4]} | Updated={r[5]}")

    except Exception as e:
        print(f"Error executing database migration: {e}")

if __name__ == "__main__":
    main()
