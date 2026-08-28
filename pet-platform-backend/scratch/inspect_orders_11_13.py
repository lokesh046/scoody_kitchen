import os
import sys

sys.path.append("/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend")

from app.core.database import SessionLocal
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory

db = SessionLocal()
try:
    for order_id in [11, 13]:
        order = db.get(Order, order_id)
        if order:
            print(f"\n--- Order #{order.id} ---")
            print(f"User ID: {order.user_id} | User Name: {order.user_name} | User Email: {order.user_email}")
            print(f"Status: {order.status} | Total Amount: {order.total_amount}")
            print("Status History:")
            history = db.query(OrderStatusHistory).filter(OrderStatusHistory.order_id == order.id).all()
            for h in history:
                print(f"  - Status: {h.status} | Desc: {h.description} | Time: {h.created_at}")
        else:
            print(f"Order #{order_id} does not exist in the database.")
finally:
    db.close()
