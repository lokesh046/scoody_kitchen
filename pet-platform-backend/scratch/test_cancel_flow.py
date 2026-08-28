import os
import sys

sys.path.append("/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend")

from app.core.database import SessionLocal
from app.models.order import Order, OrderStatus
from app.services.order_service import cancel_order

db = SessionLocal()
try:
    # Find any order in PROCESSING state to test
    order = db.query(Order).filter(Order.status == OrderStatus.PROCESSING).first()
    if not order:
        # If no order, let's create a temporary processing order for testing
        print("No processing order found. Finding any order to test...")
        order = db.query(Order).first()
        if order:
            old_status = order.status
            order.status = OrderStatus.PROCESSING
            db.commit()
            print(f"Temporarily set Order #{order.id} status to PROCESSING.")
        else:
            print("No orders exist in the database at all.")
            sys.exit(0)
    
    print(f"Attempting to cancel Order #{order.id} (Status: {order.status})...")
    cancelled_order = cancel_order(db, order)
    print(f"SUCCESS! New Status: {cancelled_order.status}")
    db.rollback() # Rollback so we don't modify database permanently
    print("Database transaction rolled back successfully.")
except Exception as exc:
    db.rollback()
    print(f"FAILED: {exc}")
finally:
    db.close()
