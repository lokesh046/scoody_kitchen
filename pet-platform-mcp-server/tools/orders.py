from typing import Any
from tools._client import backend_get, backend_post
from tools._auth import verify_mcp_call_token


def tool_get_order_status(mcp_call_token: str, order_id: int) -> dict[str, Any]:
    """Get the current status, items, and details for an order.

    SECURITY RULE: verify user ownership via mcp_call_token.
    """
    session_user_id = verify_mcp_call_token(mcp_call_token)
    return backend_get(f"/internal/orders/{order_id}", params={"acting_user_id": session_user_id})


def tool_get_order_tracking(mcp_call_token: str, order_id: int) -> dict[str, Any]:
    """Get tracking details and timeline for a customer's shipment.

    SECURITY RULE: verify user ownership via mcp_call_token.
    """
    session_user_id = verify_mcp_call_token(mcp_call_token)
    return backend_get(f"/internal/orders/{order_id}/tracking", params={"acting_user_id": session_user_id})


def tool_get_my_orders(
    mcp_call_token: str,
    limit: int = 10,
) -> dict[str, Any]:
    """Get all past and current orders for the logged-in customer.

    SECURITY RULE: verify user ownership via mcp_call_token.
    """
    session_user_id = verify_mcp_call_token(mcp_call_token)
    res = backend_get("/internal/orders", params={"acting_user_id": session_user_id, "limit": limit})
    if res.get("ok") is True:
        data = res.get("data")
        if isinstance(data, list):
            res["data"] = {"orders": data}
    return res
