"""Commerce ReAct Agent Node powered by ChatLiteLLM native tool binding & HITL confirmation interrupts."""

import os
import re
from typing import Any
from mcp_client import mcp_client
from utils.guardrails import redact_pii_text
from utils.llm_gateway import get_llm_with_fallback

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


async def commerce_agent_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph Commerce ReAct Agent node using ChatLiteLLM native tool binding."""
    messages = state.get("messages", [])
    session_user_id = state.get("user_id")
    if session_user_id is None:
        raise ValueError("Authentication context missing: session_user_id is required to perform commerce operations.")
    user_query = messages[-1]["content"] if messages else ""
    query_lower = user_query.lower()

    # 1. Fetch FastMCP Tools via langchain-mcp-adapters (real MCP/SSE — see
    # mcp_client.py). If the MCP server is unreachable, this now raises
    # rather than silently degrading to in-process calls, so we handle that
    # explicitly here with a clear message to the user instead of a 500.
    try:
        mcp_tools = mcp_client.get_mcp_tools()
    except RuntimeError:
        reply = (
            "I'm having trouble reaching our order/booking system right now. "
            "Please try again in a moment, or contact support directly."
        )
        return {"messages": messages + [{"role": "assistant", "content": reply}]}

    tools_by_name = {t.name: t for t in mcp_tools}
    session_id = state.get("session_id")

    # 2. Check for Pending HITL Action from previous turn
    pending_action = state.get("pending_action")
    pending_args = state.get("pending_action_args") or {}

    from memory.redis_memory import session_memory

    if session_id:
        redis_pending = session_memory.get_pending_action(session_id)
        if redis_pending:
            pending_action = redis_pending.get("action")
            pending_args = redis_pending.get("args") or {}

    if not pending_action:
        for msg in reversed(messages[:-1]):
            if msg.get("role") != "assistant":
                continue
            content = msg.get("content", "")
            if "⚠️ CONFIRMATION REQUIRED" in content:
                match = re.search(r"action\s+'([^']+)'\s+for\s+order\s+#(\d+)", content)
                if match:
                    pending_action = match.group(1)
                    pending_args = {"order_id": int(match.group(2))}
                    break
                match_c = re.search(r"action\s+'([^']+)'\s+for\s+doctor\s+#(\d+)", content)
                if match_c:
                    pending_action = match_c.group(1)
                    pending_args = {"doctor_id": int(match_c.group(2)), "pet_id": 1}
                    break

    # 3. Handle HITL Action Approval on Customer Confirmation
    if any(confirm_word in query_lower for confirm_word in ["yes", "confirm", "proceed", "sure", "ok"]):
        if pending_action == "cancel_order" and "cancel_order" in tools_by_name:
            target_order_id = pending_args.get("order_id", 101)
            idempotency_key = f"idem_cancel_{session_user_id}_{target_order_id}"

            tool_fn = tools_by_name["cancel_order"]
            tool_res = tool_fn.invoke({
                "session_user_id": session_user_id,
                "order_id": target_order_id,
                "idempotency_key": idempotency_key,
            })
            reply = f"Order Cancellation Response:\n{tool_res}"
            if session_id:
                session_memory.clear_pending_action(session_id)
            return {
                "messages": messages + [{"role": "assistant", "content": reply}],
                "sources": ["Scooby Order Service"],
                "pending_action": None,
                "pending_action_args": None,
            }

        elif pending_action == "book_consultation" and "book_consultation" in tools_by_name:
            doctor_id = pending_args.get("doctor_id", 1)
            pet_id = pending_args.get("pet_id", 1)
            sched_iso = pending_args.get("scheduled_at_iso", "2026-08-20T10:00:00Z")
            reason = pending_args.get("reason", "Veterinary Checkup")
            idempotency_key = f"idem_book_{session_user_id}_{doctor_id}_{pet_id}"

            tool_fn = tools_by_name["book_consultation"]
            tool_res = tool_fn.invoke({
                "session_user_id": session_user_id,
                "doctor_id": doctor_id,
                "pet_id": pet_id,
                "scheduled_at_iso": sched_iso,
                "reason": reason,
                "idempotency_key": idempotency_key,
            })
            reply = f"Vet Booking Response:\n{tool_res}"
            if session_id:
                session_memory.clear_pending_action(session_id)
            return {
                "messages": messages + [{"role": "assistant", "content": reply}],
                "sources": ["Scooby Vet Booking Service"],
                "pending_action": None,
                "pending_action_args": None,
            }

    # 4. State-changing Action HITL Confirmation Triggering
    if "cancel" in query_lower and ("order" in query_lower or "cancellation" in query_lower):
        order_match = re.search(r"#?(\d+)", user_query)
        target_order_id = int(order_match.group(1)) if order_match else 101
        
        reply = (
            f"⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute action 'cancel_order' for order #{target_order_id}? "
            f"This will release reserved stock back to inventory. Please reply 'Yes, confirm' to proceed."
        )
        if session_id:
            session_memory.set_pending_action(session_id, "cancel_order", {"order_id": target_order_id})
        return {
            "messages": messages + [{"role": "assistant", "content": reply}],
            "requires_confirmation": True,
            "pending_action": "cancel_order",
            "pending_action_args": {"order_id": target_order_id},
        }

    if "book" in query_lower and ("vet" in query_lower or "doctor" in query_lower or "consultation" in query_lower):
        doc_match = re.search(r"doctor\s+#?(\d+)", query_lower) or re.search(r"doc\s+#?(\d+)", query_lower)
        doctor_id = int(doc_match.group(1)) if doc_match else 1
        pet_match = re.search(r"pet\s+#?(\d+)", query_lower)
        pet_id = int(pet_match.group(1)) if pet_match else 1

        args = {
            "doctor_id": doctor_id,
            "pet_id": pet_id,
            "scheduled_at_iso": "2026-08-20T10:00:00Z",
            "reason": "Vet Consultation",
        }
        if session_id:
            session_memory.set_pending_action(session_id, "book_consultation", args)
        reply = (
            f"⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute action 'book_consultation' for doctor #{doctor_id} and pet #{pet_id}? "
            f"Please reply 'Yes, confirm' to proceed."
        )
        return {
            "messages": messages + [{"role": "assistant", "content": reply}],
            "requires_confirmation": True,
            "pending_action": "book_consultation",
            "pending_action_args": args,
        }

    # 5. Native ChatLiteLLM Tool Binding Execution Loop
    if GEMINI_API_KEY and mcp_tools:
        try:
            llm = get_llm_with_fallback(model_name="gemini/gemini-2.5-flash", temperature=0.1)
            if hasattr(llm, "bind_tools"):
                llm_with_tools = llm.bind_tools(mcp_tools)
                ai_msg = await llm_with_tools.ainvoke(user_query)

                # Check if LLM generated tool calls natively
                if hasattr(ai_msg, "tool_calls") and ai_msg.tool_calls:
                    for call in ai_msg.tool_calls:
                        t_name = call.get("name")
                        t_args = call.get("args") or {}
                        if t_name in tools_by_name:
                            # Inject session_user_id authoritatively
                            t_args["session_user_id"] = session_user_id
                            tool_res = tools_by_name[t_name].invoke(t_args)
                            sanitized_res = redact_pii_text(str(tool_res))
                            reply = f"Response from {t_name}:\n{sanitized_res}"
                            return {
                                "messages": messages + [{"role": "assistant", "content": reply}],
                                "sources": ["Scooby FastMCP Tool Engine"],
                            }

                if hasattr(ai_msg, "content") and ai_msg.content:
                    return {"messages": messages + [{"role": "assistant", "content": ai_msg.content}]}
        except Exception:
            pass

    # Direct tool invocation fallback
    if "order" in query_lower or "status" in query_lower:
        if "get_order_status" in tools_by_name:
            order_match = re.search(r"#?(\d+)", user_query)
            order_id = int(order_match.group(1)) if order_match else 1
            tool_res = tools_by_name["get_order_status"].invoke({"session_user_id": session_user_id, "order_id": order_id})
            reply = f"Here is your order status for Order #{order_id}:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Order Service"]}

    elif "product" in query_lower or "search" in query_lower:
        if "search_products" in tools_by_name:
            tool_res = tools_by_name["search_products"].invoke({"search": user_query, "limit": 5})
            reply = f"Here are matching products:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Product Catalog"]}

    elif "slot" in query_lower or "vet" in query_lower:
        if "get_available_slots" in tools_by_name:
            tool_res = tools_by_name["get_available_slots"].invoke({})
            reply = f"Here are available vet consultation slots:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Vet Service"]}

    reply = "I can assist with your orders, product catalog search, and vet consultation bookings. How can I help you today?"
    return {"messages": messages + [{"role": "assistant", "content": reply}]}
