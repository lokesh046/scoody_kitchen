import sys
import os

# Add venv site-packages to path
venv_site = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".venv/lib/python3.13/site-packages")
sys.path.insert(0, venv_site)

import psycopg

db_url = "postgresql://neondb_owner:npg_qQG5WJ9wFiDK@ep-dawn-sky-azgnma9c-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=5"

try:
    conn = psycopg.connect(db_url)
    with conn.cursor() as cur:
        cur.execute("SELECT id, status, meeting_room_id, customer_id, doctor_id FROM consultations WHERE id = 19;")
        row = cur.fetchone()
        if row:
            print("FOUND CONSULTATION 19:")
            print(f"ID: {row[0]}")
            print(f"Status: {row[1]}")
            print(f"Meeting Room ID: {row[2]}")
            print(f"Customer ID: {row[3]}")
            print(f"Doctor ID: {row[4]}")
        else:
            print("CONSULTATION 19 NOT FOUND")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
