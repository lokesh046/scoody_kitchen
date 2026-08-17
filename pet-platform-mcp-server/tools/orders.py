import sys
import os
from typing import Any
from pydantic import BaseModel, Field

# Ensure pet-platform-backend is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../pet-platform-backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import SessionLocal
from app.services.order_service import get_order_by_id
from app.services.shipping_service import get_tracking_details
from app.models.user import User
from app.models.enums import UserRole


def tool_get_order_status(session_user_id: int, order_id: int) -> dict[str, Any]:
    """Get the current status, items, and details for an order.
    
    SECURITY RULE: session_user_id must match the owner of the order to prevent IDOR access.
    """
    db = SessionLocal()
    try:
        order = get_order_by_id(db, order_id)
        if not order:
            return {"error": f"Order #{order_id} not found."}
        
        # IDOR Security Check
        if order.user_id != session_user_id:
            raise ValueError(f"Access Denied: Order #{order_id} does not belong to user {session_user_id}")
        
        items = [
            {
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price) if item.unit_price is not None else 0.0,
            }
            for item in getattr(order, "items", [])
        ]
        
        status_val = order.status.value if hasattr(order.status, "value") else str(order.status)
        return {
            "order_id": order.id,
            "status": status_val,
            "total_amount": float(order.total_amount) if getattr(order, "total_amount", None) is not None else 0.0,
            "created_at": str(order.created_at) if getattr(order, "created_at", None) is not None else None,
            "items": items,
        }
    finally:
        db.close()


def tool_get_order_tracking(session_user_id: int, order_id: int) -> dict[str, Any]:
    """Get tracking details and timeline for a customer's shipment.
    
    SECURITY RULE: session_user_id must match the owner of the order to prevent IDOR access.
    """
    db = SessionLocal()
    try:
        dummy_user = User(id=session_user_id, role=UserRole.CUSTOMER)
        return get_tracking_details(db, order_id=order_id, current_user=dummy_user)
    except ValueError as exc:
        return {"error": str(exc)}
    finally:
        db.close()
