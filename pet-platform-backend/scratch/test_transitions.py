import os
import sys

sys.path.append("/media/ganesh/2EB4C64AB4C613ED/scooby_pets/pet-platform-backend")

from app.models.order import OrderStatus
from app.services.order_service import validate_order_status_transition

try:
    print("Testing PENDING to CANCELLED...")
    validate_order_status_transition(OrderStatus.PENDING, OrderStatus.CANCELLED)
    print("SUCCESS")
    
    print("Testing CONFIRMED to CANCELLED...")
    validate_order_status_transition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)
    print("SUCCESS")

    print("Testing PROCESSING to CANCELLED...")
    validate_order_status_transition(OrderStatus.PROCESSING, OrderStatus.CANCELLED)
    print("SUCCESS")
except Exception as exc:
    print(f"FAILED: {exc}")
