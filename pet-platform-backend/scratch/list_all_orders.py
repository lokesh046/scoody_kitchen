import os
import sys

sys.path.append("/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend")

from app.core.database import SessionLocal
from app.models.order import Order

db = SessionLocal()
try:
    orders = db.query(Order).order_by(Order.id).all()
    print("--- Existing Orders ---")
    for o in orders:
        print(f"Order ID: {o.id} | User ID: {o.user_id} | Status: {o.status} | Total: {o.total_amount}")
finally:
    db.close()
