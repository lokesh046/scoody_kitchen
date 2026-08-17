"""Commerce ReAct Agent Node - Handles FastMCP commerce tools & HITL interrupts."""

import os
import re
from typing import Any
from mcp_client import mcp_client

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

ACTION_TOOLS = {"book_consultation", "cancel_order", "cancel_consultation"}


def commerce_agent_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph ReAct Agent node for commerce, orders, products, and vet bookings."""
    messages = state.get("messages", [])
    session_user_id = state.get("user_id") or 1
    user_query = messages[-1]["content"] if messages else ""
    query_lower = user_query.lower()

    # 1. Fetch FastMCP Tools via langchain-mcp-adapters
    mcp_tools = mcp_client.get_mcp_tools()
    tools_by_name = {t.name: t for t in mcp_tools}

    # 2. Human-In-The-Loop (HITL) Action Intent Verification
    if any(k in query_lower for k in ["cancel order", "cancel my order", "cancel consultation", "book consultation"]):
        action_approved = state.get("action_approved", False) or ("yes" in query_lower or "confirm" in query_lower)
        
        if not action_approved:
            reply = (
                "⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute this action? "
                "Please reply 'Yes, confirm' to proceed."
            )
            return {
                "messages": messages + [{"role": "assistant", "content": reply}],
                "requires_confirmation": True,
                "pending_action": "cancel_order" if "order" in query_lower else "book_consultation",
            }

    # 3. Direct MCP Tool Invocation Handling
    if "cancel" in query_lower:
        if "cancel_order" in tools_by_name:
            order_match = re.search(r"#?(\d+)", user_query)
            order_id = int(order_match.group(1)) if order_match else 101
            idempotency_key = f"idem_cancel_{session_user_id}_{order_id}"

            tool_fn = tools_by_name["cancel_order"]
            tool_res = tool_fn.invoke({
                "session_user_id": session_user_id,
                "order_id": order_id,
                "idempotency_key": idempotency_key,
            })
            reply = f"Order Cancellation Response:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Order Service"]}

    elif "order" in query_lower or "track" in query_lower or "status" in query_lower:
        if "get_order_status" in tools_by_name:
            order_match = re.search(r"#?(\d+)", user_query)
            order_id = int(order_match.group(1)) if order_match else 1
            
            tool_fn = tools_by_name["get_order_status"]
            tool_res = tool_fn.invoke({"session_user_id": session_user_id, "order_id": order_id})
            
            if isinstance(tool_res, dict) and tool_res.get("status") == "error":
                reply = f"Error retrieving order: {tool_res.get('error')}"
            else:
                reply = f"Here is your order status for Order #{order_id}:\n{tool_res}"
            
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Order Service"]}

    elif "product" in query_lower or "food" in query_lower or "search" in query_lower or "stock" in query_lower:
        if "search_products" in tools_by_name:
            tool_fn = tools_by_name["search_products"]
            tool_res = tool_fn.invoke({"search": user_query, "limit": 5})
            reply = f"Here are the matching products from our catalog:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Product Catalog"]}

    elif "slot" in query_lower or "doctor" in query_lower or "vet" in query_lower or "consultation" in query_lower:
        if "get_available_slots" in tools_by_name:
            tool_fn = tools_by_name["get_available_slots"]
            tool_res = tool_fn.invoke({})
            reply = f"Here are the available vet consultation slots:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Vet Service"]}

    # Fallback ReAct response
    reply = "I can assist with your orders, product catalog search, and vet consultation bookings. How can I help you today?"
    return {"messages": messages + [{"role": "assistant", "content": reply}]}
