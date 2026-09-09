"""Commerce ReAct Agent Node powered by ChatLiteLLM native tool binding & HITL confirmation interrupts."""

import json
import os
import re
from typing import Any
from langchain_core.runnables import RunnableConfig
from mcp_client import mcp_client
from utils.guardrails import redact_pii_text
from utils.llm_gateway import get_llm_with_fallback
from utils.mcp_auth import mint_mcp_call_token
from schemas.mcp_results import (
    CancelOrderData,
    ConsultationActionData,
    ProductSearchData,
    parse_mcp_result,
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

# Tool-layer allowlist of state-changing (side-effecting) actions.
# ANY tool in this set must go through the HITL confirmation flow, no matter
# which code path wants to call it — keyword-triggered regex matching,
# native LLM tool-calling, or anything added in the future. This is checked
# again right before invocation (see _requires_confirmation gate below) so a
# missed keyword pattern, a differently-phrased request, or a prompt
# injection that gets the model to emit a tool_call for one of these can
# never bypass confirmation just because it didn't match the regex triggers.
STATE_CHANGING_TOOLS = {"cancel_order", "book_consultation", "cancel_consultation"}


def _default_pending_args(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Normalize/label args for a state-changing tool so the confirmation
    prompt and the eventual re-invocation carry exactly what's needed."""
    return dict(args)


def _confirmation_prompt(tool_name: str, args: dict[str, Any], confirmation_id: str | None = None) -> str:
    id_part = f" (ID: {confirmation_id})" if confirmation_id else ""
    if tool_name == "cancel_order":
        return (
            f"⚠️ CONFIRMATION REQUIRED{id_part}: Are you sure you want to execute action 'cancel_order' "
            f"for order #{args.get('order_id')}? This will release reserved stock back to inventory. "
            f"Please reply 'Yes, confirm' to proceed."
        )
    if tool_name == "book_consultation":
        doc_part = args.get("doctor_name") or (f"#{args.get('doctor_id')}" if args.get("doctor_id") else "None")
        pet_part = args.get("pet_name") or (f"#{args.get('pet_id')}" if args.get("pet_id") else "None")
        return (
            f"⚠️ CONFIRMATION REQUIRED{id_part}: Are you sure you want to execute action 'book_consultation' "
            f"for doctor {doc_part} and pet {pet_part}? "
            f"Please reply 'Yes, confirm' to proceed."
        )
    if tool_name == "cancel_consultation":
        return (
            f"⚠️ CONFIRMATION REQUIRED{id_part}: Are you sure you want to execute action 'cancel_consultation' "
            f"for consultation #{args.get('consultation_id')}? "
            f"Please reply 'Yes, confirm' to proceed."
        )
    return (
        f"⚠️ CONFIRMATION REQUIRED{id_part}: Are you sure you want to execute action '{tool_name}'? "
        f"Please reply 'Yes, confirm' to proceed."
    )


# Whole-word affirmation/negation vocabulary for HITL confirmation replies.
# Word-boundary matched (not substring) so "ok" doesn't fire inside "book",
# "cookie", "look", etc. Negation always wins over affirmation, so "no",
# "don't confirm", "wait", "actually no" etc. never trigger the action.
_AFFIRM_WORDS = {"yes", "yeah", "yep", "yup", "confirm", "confirmed", "proceed", "sure", "ok", "okay"}
_NEGATION_PATTERNS = [
    r"\bno\b", r"\bnot\b", r"\bdon'?t\b", r"\bdo not\b", r"\bwait\b",
    r"\bstop\b", r"\bcancel that\b", r"\bnever ?mind\b", r"\bactually\b",
]


def _is_affirmative_reply(text: str) -> bool:
    """True only if the message is a clean whole-word affirmation with no negation present."""
    if any(re.search(pattern, text) for pattern in _NEGATION_PATTERNS):
        return False
    return any(re.search(rf"\b{re.escape(word)}\b", text) for word in _AFFIRM_WORDS)


_ACTION_DATA_MODELS = {
    "cancel_order": CancelOrderData,
    "book_consultation": ConsultationActionData,
    "cancel_consultation": ConsultationActionData,
}


def format_action_response(action: str, tool_res: Any) -> str:
    if not tool_res:
        return "An error occurred: no response from service."

    data_model = _ACTION_DATA_MODELS.get(action)
    if data_model is None:
        # No typed contract defined for this action — fall back to a plain
        # string rather than guessing at a shape we don't know.
        return f"Action completed successfully: {tool_res}"

    data, error = parse_mcp_result(tool_res, data_model)
    if error:
        return f"Sorry, action failed: {error.message}."

    if action == "cancel_order":
        assert isinstance(data, CancelOrderData)
        return f"Success! Order #{data.order_id} has been successfully cancelled and its items have been returned to warehouse stock."

    if action == "book_consultation":
        assert isinstance(data, ConsultationActionData)
        status = data.status or "pending"
        c_id_str = f" (ID: #{data.consultation_id})" if data.consultation_id else ""
        return f"Success! Your consultation booking has been created and is currently **{status}**{c_id_str}."

    if action == "cancel_consultation":
        assert isinstance(data, ConsultationActionData)
        return f"Success! Consultation #{data.consultation_id} has been successfully cancelled."

    return f"Action completed successfully: {data}"


def _extract_products(tool_res: Any) -> list[dict[str, Any]]:
    """Pull a clean {id, name, price, image_url, in_stock} list out of a
    search_products tool result, so the chat UI can render tappable product
    cards instead of the user having to read prices out of prose.

    Goes through the shared MCP contract validator instead of guessing at
    the shape by hand — this is exactly the function that shipped with a
    silent bug (reading tool_res["products"] instead of the actual
    tool_res["data"]["products"]) because nothing checked the assumption."""
    data, error = parse_mcp_result(tool_res, ProductSearchData)
    if error:
        return []

    assert isinstance(data, ProductSearchData)
    return [
        {
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "image_url": p.image_url,
            "in_stock": p.in_stock,
        }
        for p in data.products
    ]


def _unwrap_envelope(tool_res: Any) -> tuple[dict[str, Any] | None, str | None]:
    """Best-effort unwrap of the {ok, data, error, request_id} MCP envelope
    for the keyword-based "last resort" fallback branches below. These only
    run when the main AI tool-calling loop itself raised an exception — so
    this must never leak that raw envelope to the user the way it silently
    did before (every one of these branches used to do
    `f"...{tool_res}"`, printing the whole {ok, data, error, request_id}
    dict verbatim). Returns (data_dict, None) on success, or (None,
    error_message) otherwise — never raises."""
    raw = tool_res
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return None, "I couldn't read the response from that service."
    if not isinstance(raw, dict):
        return None, "I couldn't read the response from that service."
    if not raw.get("ok"):
        err = (raw.get("error") or {}).get("message", "an unknown error occurred")
        return None, err
    data = raw.get("data")
    if not isinstance(data, dict):
        return None, "That request succeeded but returned no usable data."
    return data, None


def _format_items_generic(items: list[Any]) -> str:
    """Plain 'key: value' bullet per item — used for fallback list
    branches (slots, pets) where the exact field names aren't pinned down
    by a typed contract yet. Still far better than dumping the raw
    envelope; not meant to replace a proper typed model long-term."""
    lines = []
    for item in items:
        if not isinstance(item, dict):
            lines.append(f"- {item}")
            continue
        parts = [f"{k}: {v}" for k, v in item.items() if v is not None]
        lines.append("- " + ", ".join(parts) if parts else "- (no details available)")
    return "\n".join(lines)


from utils.tool_executor import execute_tool


async def commerce_agent_node(state: dict[str, Any], config: RunnableConfig | None = None) -> dict[str, Any]:
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
        mcp_tools = await mcp_client.get_mcp_tools()
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
    active_conf_id = None
    ticket = None

    if session_id:
        active_conf_id = await session_memory.aget_active_session_ticket_id(session_id)
        if active_conf_id:
            ticket = await session_memory.aget_pending_action_by_id(active_conf_id)

    if ticket:
        if ticket.get("user_id") == session_user_id:
            pending_action = ticket.get("action")
            pending_args = ticket.get("arguments") or {}
        else:
            active_conf_id = None
            ticket = None

    # Handle explicit rejection
    if active_conf_id and session_id and any(re.search(pattern, query_lower) for pattern in _NEGATION_PATTERNS):
        await session_memory.aconsume_pending_action(active_conf_id, session_id)
        reply = "Okay, I've canceled the pending request."
        return {
            "messages": [{"role": "assistant", "content": reply}],
            "pending_action": None,
            "pending_action_args": None,
        }

    # 3. Handle HITL Action Approval on Customer Confirmation
    if pending_action and _is_affirmative_reply(query_lower):
        # Consume the ticket immediately to prevent double execution (replay protection)
        if active_conf_id and session_id:
            await session_memory.aconsume_pending_action(active_conf_id, session_id)

        # Support both bare and tool_ prefixed action names, stripping any server name prefixes
        clean_action = pending_action.split("__")[-1]
        normalized_action = clean_action.replace("tool_", "")
        prefixed_action = f"tool_{normalized_action}"
        
        tool_fn = tools_by_name.get(pending_action)
        if not tool_fn:
            if normalized_action in tools_by_name:
                tool_fn = tools_by_name[normalized_action]
            elif prefixed_action in tools_by_name:
                tool_fn = tools_by_name[prefixed_action]

        if tool_fn:
            if normalized_action == "cancel_order":
                target_order_id = pending_args.get("order_id")
                if target_order_id is None:
                    reply = "Error: Order ID is required to cancel an order. Please specify the order number."
                    if session_id:
                        await session_memory.aclear_pending_action(session_id)
                    return {
                        "messages": messages + [{"role": "assistant", "content": reply}],
                        "pending_action": None,
                        "pending_action_args": None,
                    }
                idempotency_key = f"idem_cancel_{session_user_id}_{target_order_id}"

                call_args = {
                    "order_id": target_order_id,
                    "idempotency_key": idempotency_key,
                }
                if "mcp_call_token" in tool_fn.args:
                    call_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
                else:
                    call_args["session_user_id"] = session_user_id

                tool_res = await execute_tool(tool_fn, call_args, context={"is_hitl_approved": True})
                reply = format_action_response("cancel_order", tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby Order Service"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

            elif normalized_action == "book_consultation":
                call_args = dict(pending_args)
                if "mcp_call_token" in tool_fn.args:
                    call_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
                    call_args.pop("session_user_id", None)
                else:
                    call_args["session_user_id"] = session_user_id
                
                # Check for missing required inputs
                missing_fields = []
                if "doctor_id" not in call_args and "doctor_name" not in call_args:
                    missing_fields.append("doctor name or ID")
                if "pet_id" not in call_args and "pet_name" not in call_args:
                    missing_fields.append("pet name or ID")
                if "scheduled_at_iso" not in call_args:
                    missing_fields.append("appointment date and time")
                if "reason" not in call_args:
                    missing_fields.append("reason for consultation")
                
                if missing_fields:
                    reply = f"To book a consultation, please provide: {', '.join(missing_fields)}."
                    if session_id:
                        await session_memory.aclear_pending_action(session_id)
                    return {
                        "messages": [{"role": "assistant", "content": reply}],
                        "pending_action": None,
                        "pending_action_args": None,
                    }

                # Validate scheduled date is in the future
                sched_str = call_args.get("scheduled_at_iso")
                if not sched_str:
                    reply = "The appointment date and time are required before booking."
                    if session_id:
                        await session_memory.aclear_pending_action(session_id)
                    return {
                        "messages": messages + [{"role": "assistant", "content": reply}],
                        "pending_action": None,
                        "pending_action_args": None,
                    }
                try:
                    from datetime import datetime, timezone
                    dt = datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    else:
                        dt = dt.astimezone(timezone.utc)
                    
                    if dt <= datetime.now(timezone.utc):
                        reply = "To book a consultation, the appointment date and time must be in the future, not in the past."
                        if session_id:
                            await session_memory.aclear_pending_action(session_id)
                        return {
                            "messages": [{"role": "assistant", "content": reply}],
                            "pending_action": None,
                            "pending_action_args": None,
                        }
                except (ValueError, TypeError):
                    reply = "I couldn't understand the appointment date and time. Please provide a valid appointment date and time."
                    if session_id:
                        await session_memory.aclear_pending_action(session_id)
                    return {
                        "messages": [{"role": "assistant", "content": reply}],
                        "pending_action": None,
                        "pending_action_args": None,
                    }
                
                tool_res = await execute_tool(tool_fn, call_args, context={"is_hitl_approved": True})
                reply = format_action_response("book_consultation", tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby Vet Booking Service"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

            elif normalized_action == "cancel_consultation":
                consultation_id = pending_args.get("consultation_id")
                if consultation_id is None:
                    reply = "Error: Consultation ID is required to cancel a booking. Please specify the consultation number."
                    if session_id:
                        await session_memory.aclear_pending_action(session_id)
                    return {
                        "messages": messages + [{"role": "assistant", "content": reply}],
                        "pending_action": None,
                        "pending_action_args": None,
                    }
                idempotency_key = f"idem_cancel_consult_{session_user_id}_{consultation_id}"

                call_args = {
                    "consultation_id": consultation_id,
                    "idempotency_key": idempotency_key,
                }
                if "mcp_call_token" in tool_fn.args:
                    call_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
                else:
                    call_args["session_user_id"] = session_user_id

                tool_res = await execute_tool(tool_fn, call_args, context={"is_hitl_approved": True})
                reply = format_action_response("cancel_consultation", tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby Vet Booking Service"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

            elif clean_action in STATE_CHANGING_TOOLS or pending_action in STATE_CHANGING_TOOLS or prefixed_action in STATE_CHANGING_TOOLS:
                # Generic fallback for any other state-changing tool that reaches
                # this point (e.g. added later) — still requires this same
                # confirm-then-invoke path, never a direct call.
                call_args: dict[str, Any] = dict(pending_args)
                if "mcp_call_token" in tool_fn.args:
                    call_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
                    call_args.pop("session_user_id", None)
                else:
                    call_args["session_user_id"] = session_user_id
                call_args.setdefault(
                    "idempotency_key",
                    f"idem_{pending_action}_{session_user_id}_{'_'.join(str(v) for v in pending_args.values())}",
                )
                tool_res = await execute_tool(tool_fn, call_args, context={"is_hitl_approved": True})
                reply = format_action_response(normalized_action, tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby FastMCP Tool Engine"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

    # 4. Native ChatLiteLLM Tool Binding Execution Loop
    if GEMINI_API_KEY and mcp_tools:
        try:
            llm = get_llm_with_fallback(model_name="gemini/gemini-3.5-flash-lite", temperature=0.1)
            
            def bind_tools_to_runnable(runnable, tools):
                if hasattr(runnable, "runnable") and hasattr(runnable, "fallbacks"):
                    bound_primary = runnable.runnable.bind_tools(tools)
                    bound_fallbacks = [fb.bind_tools(tools) for fb in runnable.fallbacks]
                    return bound_primary.with_fallbacks(bound_fallbacks)
                elif hasattr(runnable, "bind_tools"):
                    return runnable.bind_tools(tools)
                return runnable

            llm_with_tools = bind_tools_to_runnable(llm, mcp_tools)
            if llm_with_tools:
                from langchain_core.messages import SystemMessage, HumanMessage, BaseMessage, ToolMessage
                from datetime import datetime, timezone
                current_time_str = datetime.now(timezone.utc).isoformat()
                messages_input: list[BaseMessage] = [
                    SystemMessage(content=(
                        "You are Scooby Kitchen's AI Commerce Assistant. "
                        "Answer customer requests about products, orders, and bookings. "
                        f"Current Date and Time: {current_time_str}\n"
                        "To book a consultation: You MUST call 'tool_book_consultation' directly using 'pet_name' and 'doctor_name' arguments when the user provides names instead of IDs. Do NOT look up IDs first, and do NOT ask for confirmation or generate the confirmation prompt yourself; the system will automatically intercept your tool call and present the confirmation gate to the user."
                        "\nWhenever the customer asks about products, recipes, the catalog, or 'what do you have/sell' — even vaguely — you MUST call 'tool_search_products' to fetch real results before answering. Never describe or invent products from memory; always look them up first."
                        "\nCRITICAL: Tools may list a 'mcp_call_token' or 'session_user_id' argument — these are internal security fields the system fills in automatically right before the tool runs. You never have a value for them and must NEVER ask the customer to provide one, mention them by name, or treat them as missing information. Just call the tool; only ask the customer for arguments that are genuinely about their own request (e.g. an order number, a pet name, a date)."
                        "\nCRITICAL: Keep your response short, concise, and clear (maximum 3 sentences or a few brief bullet points)."
                    )),
                    HumanMessage(content=user_query)
                ]

                # Products surfaced by any search_products calls made during the
                # loop below, so the final reply can carry tappable product
                # cards alongside the AI's natural-language text.
                collected_products: list[dict[str, Any]] = []

                # ReAct Execution Loop (max 5 steps to resolve multi-step tool calls)
                for _ in range(5):
                    # Stream instead of a single blocking ainvoke() call so the
                    # graph's astream_events() picks up on_chat_model_stream
                    # events and the client sees the final answer's tokens as
                    # they're generated. Tool-call turns typically carry no
                    # visible content, so this only changes behavior on the
                    # final, user-facing turn. AIMessageChunk supports `+` to
                    # merge streamed deltas (content and tool_calls) into one
                    # complete message, same shape as the old ainvoke() result.
                    # Merge in the ambient callbacks explicitly rather than
                    # relying on .with_config() to inherit them — verified
                    # it doesn't reliably propagate callbacks from the
                    # parent graph invocation (the per-request token cost
                    # tracker was silently missing every commerce_agent call).
                    stream_config = {"tags": ["agent_response"], "callbacks": (config or {}).get("callbacks")}
                    ai_msg = None
                    async for chunk in llm_with_tools.astream(messages_input, config=stream_config):
                        ai_msg = chunk if ai_msg is None else ai_msg + chunk

                    if ai_msg is None:
                        reply = "Sorry, I didn't get a response from the AI service. Please try again."
                        return {
                            "messages": [{"role": "assistant", "content": reply}],
                            "pending_action": None,
                            "pending_action_args": None,
                        }

                    if not hasattr(ai_msg, "tool_calls") or not ai_msg.tool_calls:
                        reply = ai_msg.content if hasattr(ai_msg, "content") else str(ai_msg)
                        if isinstance(reply, list):
                            text_parts = []
                            for block in reply:
                                if isinstance(block, str):
                                    text_parts.append(block)
                                elif isinstance(block, dict):
                                    text_parts.append(block.get("text", block.get("content", "")))
                                elif hasattr(block, "text"):
                                    text_parts.append(getattr(block, "text", ""))
                            reply = "".join(text_parts).strip()
                        return {
                            "messages": [{"role": "assistant", "content": reply}],
                            "pending_action": None,
                            "pending_action_args": None,
                            "products": collected_products,
                        }

                    # Track the tool calls we made
                    messages_input.append(ai_msg)

                    # Execute all tools requested in this step
                    for call in ai_msg.tool_calls:
                        t_name = call.get("name")
                        t_args = call.get("args") or {}
                        if t_name not in tools_by_name:
                            # If a tool_call's name doesn't match anything we
                            # know (renamed/hallucinated tool, naming
                            # mismatch), it MUST still get a response here.
                            # Gemini 3.5+ rejects the next request outright
                            # ("does not support model prefilling... final
                            # turn must be a user message or a function
                            # response") if a tool_call from the assistant's
                            # last turn is left unanswered — this used to be
                            # silently ignored, leaving the conversation in
                            # exactly that broken state.
                            messages_input.append(ToolMessage(
                                content=f"Error: tool '{t_name}' is not available.",
                                tool_call_id=call.get("id", ""),
                            ))
                            continue
                        if t_name in tools_by_name:
                            # SAFETY GATE: state-changing tools must go through HITL confirmation
                            clean_t_name = t_name.split("__")[-1]
                            normalized_t_name = clean_t_name.replace("tool_", "")
                            if normalized_t_name in STATE_CHANGING_TOOLS or clean_t_name in STATE_CHANGING_TOOLS or t_name in STATE_CHANGING_TOOLS:
                                confirm_args = _default_pending_args(normalized_t_name, t_args)
                                confirm_args.pop("session_user_id", None)
                                confirm_args.pop("mcp_call_token", None)

                                if normalized_t_name == "book_consultation":
                                    sched_str = confirm_args.get("scheduled_at_iso")
                                    if not sched_str:
                                        reply = "The appointment date and time are required before booking."
                                        return {
                                            "messages": [{"role": "assistant", "content": reply}],
                                            "pending_action": None,
                                            "pending_action_args": None,
                                        }
                                    try:
                                        dt = datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
                                        if dt.tzinfo is None:
                                            dt = dt.replace(tzinfo=timezone.utc)
                                        else:
                                            dt = dt.astimezone(timezone.utc)

                                        if dt <= datetime.now(timezone.utc):
                                            reply = "To book a consultation, the appointment date and time must be in the future, not in the past."
                                            return {
                                                "messages": [{"role": "assistant", "content": reply}],
                                                "pending_action": None,
                                                "pending_action_args": None,
                                            }
                                    except (ValueError, TypeError):
                                        reply = "I couldn't understand the appointment date and time. Please provide a valid appointment date and time."
                                        return {
                                            "messages": [{"role": "assistant", "content": reply}],
                                            "pending_action": None,
                                            "pending_action_args": None,
                                        }

                                confirmation_id = None
                                if session_id:
                                    confirmation_id = await session_memory.acreate_pending_action(
                                        user_id=session_user_id,
                                        session_id=session_id,
                                        action=t_name,
                                        args=confirm_args
                                    )
                                reply = _confirmation_prompt(normalized_t_name, confirm_args, confirmation_id)
                                return {
                                    "messages": [{"role": "assistant", "content": reply}],
                                    "requires_confirmation": True,
                                    "pending_action": t_name,
                                    "pending_action_args": confirm_args,
                                }

                            # For read or approved write tools: inject mcp_call_token on-demand
                            if "mcp_call_token" in tools_by_name[t_name].args:
                                t_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
                                t_args.pop("session_user_id", None)
                            elif "session_user_id" in tools_by_name[t_name].args:
                                t_args["session_user_id"] = session_user_id

                            try:
                                tool_res = await execute_tool(tools_by_name[t_name], t_args)
                            except PermissionError as pe:
                                reply = f"This action requires confirmation. Please reply 'yes' to proceed. Details: {pe}"
                                return {
                                    "messages": [{"role": "assistant", "content": reply}],
                                }

                            if normalized_t_name == "search_products":
                                collected_products.extend(_extract_products(tool_res))

                            sanitized_res = redact_pii_text(str(tool_res))
                            messages_input.append(ToolMessage(content=sanitized_res, tool_call_id=call.get("id", "")))

                reply = "I completed the background tasks but couldn't formulate a final summary. How else can I help?"
                return {
                    "messages": [{"role": "assistant", "content": reply}],
                    "products": collected_products,
                }
        except Exception as e:
            print(f"❌ [Commerce Agent Exception] Tool calling loop failed: {e}", flush=True)
            import traceback
            traceback.print_exc()

    # Fallback State-changing Action HITL Confirmation Triggering
    if "cancel" in query_lower and ("order" in query_lower or "cancellation" in query_lower):
        order_match = re.search(r"#?(\d+)", user_query)
        if not order_match:
            reply = "To cancel an order, please specify the order number (e.g. 'cancel order #105')."
            return {"messages": [{"role": "assistant", "content": reply}]}
        target_order_id = int(order_match.group(1))
        
        args = {"order_id": target_order_id}
        confirmation_id = None
        if session_id:
            confirmation_id = await session_memory.acreate_pending_action(
                user_id=session_user_id,
                session_id=session_id,
                action="cancel_order",
                args=args
            )
        reply = _confirmation_prompt("cancel_order", args, confirmation_id)
        return {
            "messages": [{"role": "assistant", "content": reply}],
            "requires_confirmation": True,
            "pending_action": "cancel_order",
            "pending_action_args": args,
        }

    if "cancel" in query_lower and ("consultation" in query_lower or "booking" in query_lower or "appointment" in query_lower):
        consult_match = re.search(r"#?(\d+)", user_query)
        if not consult_match:
            reply = "To cancel a consultation, please specify the consultation ID (e.g. 'cancel consultation #5')."
            return {"messages": [{"role": "assistant", "content": reply}]}
        consultation_id = int(consult_match.group(1))
        
        args = {"consultation_id": consultation_id}
        confirmation_id = None
        if session_id:
            confirmation_id = await session_memory.acreate_pending_action(
                user_id=session_user_id,
                session_id=session_id,
                action="cancel_consultation",
                args=args
            )
        reply = _confirmation_prompt("cancel_consultation", args, confirmation_id)
        return {
            "messages": [{"role": "assistant", "content": reply}],
            "requires_confirmation": True,
            "pending_action": "cancel_consultation",
            "pending_action_args": args,
        }

    if "book" in query_lower and ("vet" in query_lower or "doctor" in query_lower or "consultation" in query_lower):
        doc_match = re.search(r"doctor\s+#?(\d+)", query_lower) or re.search(r"doc\s+#?(\d+)", query_lower)
        doctor_id = int(doc_match.group(1)) if doc_match else None
        pet_match = re.search(r"pet\s+#?(\d+)", query_lower)
        pet_id = int(pet_match.group(1)) if pet_match else None
        
        # Try to parse ISO date/time (e.g. 2026-08-31T10:00:00Z or similar)
        date_match = re.search(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?)", user_query)
        scheduled_at_iso = date_match.group(1) if date_match else None

        # Try to parse reason after "because" or "reason"
        reason_match = re.search(r"(?:because|reason is|for)\s+([^.]+)", query_lower)
        reason = reason_match.group(1).strip() if reason_match else None

        missing_fields = []
        if not doctor_id:
            missing_fields.append("doctor ID (e.g. 'doctor #2')")
        if not pet_id:
            missing_fields.append("pet ID (e.g. 'pet #10')")
        if not scheduled_at_iso:
            missing_fields.append("appointment date and time in ISO format (e.g. '2026-08-31T10:00:00Z')")
        if not reason:
            missing_fields.append("reason for visit (e.g. 'because he has an itch')")
            
        if missing_fields:
            reply = f"To book a consultation using the fallback router, please provide: {', '.join(missing_fields)}."
            return {"messages": [{"role": "assistant", "content": reply}]}

        args = {
            "doctor_id": doctor_id,
            "pet_id": pet_id,
            "scheduled_at_iso": scheduled_at_iso,
            "reason": reason,
        }
        confirmation_id = None
        if session_id:
            confirmation_id = await session_memory.acreate_pending_action(
                user_id=session_user_id,
                session_id=session_id,
                action="book_consultation",
                args=args
            )
        reply = _confirmation_prompt("book_consultation", args, confirmation_id)
        return {
            "messages": [{"role": "assistant", "content": reply}],
            "requires_confirmation": True,
            "pending_action": "book_consultation",
            "pending_action_args": args,
        }

    # Direct tool invocation fallback
    if "order" in query_lower or "status" in query_lower:
        order_match = re.search(r"#?(\d+)", user_query)
        if order_match:
            t_key = "tool_get_order_status" if "tool_get_order_status" in tools_by_name else "get_order_status"
            if t_key in tools_by_name:
                order_id = int(order_match.group(1))
                t_args: dict[str, Any] = {"order_id": order_id}
                if "mcp_call_token" in tools_by_name[t_key].args:
                    t_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
                else:
                    t_args["session_user_id"] = session_user_id
                tool_res = await execute_tool(tools_by_name[t_key], t_args)
                data, err = _unwrap_envelope(tool_res)
                if err:
                    reply = f"Sorry, I couldn't retrieve order #{order_id}: {err}."
                else:
                    assert data is not None
                    reply = (
                        f"Order #{data.get('order_id', order_id)} is currently "
                        f"**{data.get('status', 'unknown')}** — Total: ${data.get('total_amount', 'N/A')}."
                    )
                return {"messages": [{"role": "assistant", "content": reply}], "sources": ["Scooby Order Service"]}
        else:
            t_key = "tool_get_my_orders" if "tool_get_my_orders" in tools_by_name else "get_my_orders"
            if t_key in tools_by_name:
                t_args: dict[str, Any] = {"limit": 10}
                if "mcp_call_token" in tools_by_name[t_key].args:
                    t_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
                else:
                    t_args["session_user_id"] = session_user_id
                tool_res = await execute_tool(tools_by_name[t_key], t_args)
                data, err = _unwrap_envelope(tool_res)
                if err:
                    reply = f"Sorry, I couldn't retrieve your orders: {err}."
                else:
                    assert data is not None
                    orders = data.get("orders") or []
                    if not orders:
                        reply = "You don't have any orders yet."
                    else:
                        lines = [
                            f"- Order #{o.get('order_id')}: {o.get('status')} — ${o.get('total_amount')}"
                            for o in orders
                        ]
                        reply = "Here are your past and current orders:\n" + "\n".join(lines)
                return {"messages": [{"role": "assistant", "content": reply}], "sources": ["Scooby Order Service"]}

    elif "product" in query_lower or "search" in query_lower:
        t_key = "tool_search_products" if "tool_search_products" in tools_by_name else "search_products"
        if t_key in tools_by_name:
            # The mobile app prepends "[Context: ...]" pet-context metadata
            # to every message. That's useful for the LLM to see (it's left
            # untouched everywhere else), but it's useless — actively
            # harmful — as a literal text search term, guaranteeing zero
            # matches. Strip it only for this literal-string tool call.
            clean_search_term = re.sub(r"^\[Context:.*?\]\s*", "", user_query).strip()
            tool_res = await execute_tool(tools_by_name[t_key], {"search": clean_search_term or user_query, "limit": 5})
            products = _extract_products(tool_res)
            if products:
                count = len(products)
                reply = f"I found {count} product{'s' if count != 1 else ''} matching your search:"
            else:
                reply = "I couldn't find any products matching that search. Try a different term, or ask me what categories we carry."
            return {
                "messages": [{"role": "assistant", "content": reply}],
                "sources": ["Scooby Product Catalog"],
                "products": products,
            }

    elif "slot" in query_lower or "vet" in query_lower or "doctor" in query_lower or "availability" in query_lower:
        t_key = "tool_get_available_slots" if "tool_get_available_slots" in tools_by_name else "get_available_slots"
        if t_key in tools_by_name:
            tool_res = await execute_tool(tools_by_name[t_key], {})
            data, err = _unwrap_envelope(tool_res)
            if err:
                reply = f"Sorry, I couldn't retrieve available slots: {err}."
            else:
                assert data is not None
                slots = data.get("slots") or []
                reply = (
                    "Here are available vet consultation slots:\n" + _format_items_generic(slots)
                    if slots else "There are no available vet consultation slots right now."
                )
            return {"messages": [{"role": "assistant", "content": reply}], "sources": ["Scooby Vet Service"]}

    elif "pet" in query_lower or "pets" in query_lower:
        t_key = "tool_get_my_pets" if "tool_get_my_pets" in tools_by_name else "get_my_pets"
        if t_key in tools_by_name:
            t_args: dict[str, Any] = {}
            if "mcp_call_token" in tools_by_name[t_key].args:
                t_args["mcp_call_token"] = mint_mcp_call_token(session_user_id)
            else:
                t_args["session_user_id"] = session_user_id
            tool_res = await execute_tool(tools_by_name[t_key], t_args)
            data, err = _unwrap_envelope(tool_res)
            if err:
                reply = f"Sorry, I couldn't retrieve your pets: {err}."
            else:
                assert data is not None
                pets = data.get("pets") or []
                reply = (
                    "Here are your registered pets:\n" + _format_items_generic(pets)
                    if pets else "You don't have any registered pets yet."
                )
            return {"messages": [{"role": "assistant", "content": reply}], "sources": ["Scooby Pet Service"]}

    reply = "I can assist with your orders, product catalog search, and vet consultation bookings. How can I help you today?"
    return {"messages": [{"role": "assistant", "content": reply}]}
