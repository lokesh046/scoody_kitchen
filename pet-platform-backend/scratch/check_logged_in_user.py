import os
import sys

sys.path.append("/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend")

from app.core.database import SessionLocal
from app.models.user import User

db = SessionLocal()
try:
    users = db.query(User).all()
    print("--- Database Users List ---")
    for u in users:
        print(f"ID: {u.id} | Email: {u.email} | Phone: {u.phone} | Phone Verified: {u.is_phone_verified} | Role: {u.role}")
finally:
    db.close()
