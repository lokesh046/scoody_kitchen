from typing import Any
from tools._client import backend_get, backend_post


def tool_get_order_status(session_user_id: int, order_id: int) -> dict[str, Any]:
    """Get the current status, items, and details for an order.

    SECURITY RULE: session_user_id must match the owner of the order to
    prevent IDOR access — enforced by the backend itself, not just here.
    """
    return backend_get(f"/internal/orders/{order_id}", params={"acting_user_id": session_user_id})


def tool_get_order_tracking(session_user_id: int, order_id: int) -> dict[str, Any]:
    """Get tracking details and timeline for a customer's shipment.

    SECURITY RULE: session_user_id must match the owner of the order to
    prevent IDOR access — enforced by the backend itself, not just here.
    """
    return backend_get(f"/internal/orders/{order_id}/tracking", params={"acting_user_id": session_user_id})
