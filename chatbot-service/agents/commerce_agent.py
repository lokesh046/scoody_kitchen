"""Commerce ReAct Agent Node powered by ChatLiteLLM native tool binding & HITL confirmation interrupts."""

import os
import re
from typing import Any
from mcp_client import mcp_client
from utils.guardrails import redact_pii_text
from utils.llm_gateway import get_llm_with_fallback

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


def _confirmation_prompt(tool_name: str, args: dict[str, Any]) -> str:
    if tool_name == "cancel_order":
        return (
            f"⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute action 'cancel_order' "
            f"for order #{args.get('order_id')}? This will release reserved stock back to inventory. "
            f"Please reply 'Yes, confirm' to proceed."
        )
    if tool_name == "book_consultation":
        doc_part = args.get("doctor_name") or (f"#{args.get('doctor_id')}" if args.get("doctor_id") else "None")
        pet_part = args.get("pet_name") or (f"#{args.get('pet_id')}" if args.get("pet_id") else "None")
        return (
            f"⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute action 'book_consultation' "
            f"for doctor {doc_part} and pet {pet_part}? "
            f"Please reply 'Yes, confirm' to proceed."
        )
    if tool_name == "cancel_consultation":
        return (
            f"⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute action 'cancel_consultation' "
            f"for consultation #{args.get('consultation_id')}? "
            f"Please reply 'Yes, confirm' to proceed."
        )
    return (
        f"⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute action '{tool_name}'? "
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


def format_action_response(action: str, tool_res: Any) -> str:
    if not tool_res:
        return f"An error occurred: no response from service."
        
    if isinstance(tool_res, str):
        try:
            import json
            tool_res = json.loads(tool_res)
        except Exception:
            return tool_res
            
    if not isinstance(tool_res, dict):
        return str(tool_res)
        
    error_val = tool_res.get("error")
    if error_val:
        if "detail" in error_val:
            try:
                import json
                if ":" in error_val:
                    json_part = error_val.split(":", 1)[1].strip()
                    detail_dict = json.loads(json_part)
                    detail_msg = detail_dict.get("detail")
                    if detail_msg:
                        return f"Sorry, action failed: {detail_msg.strip('\'\"')}."
            except Exception:
                pass
        return f"Sorry, action failed: {error_val}."

    if action == "cancel_order":
        return f"Success! Order #{tool_res.get('order_id')} has been successfully cancelled and its items have been returned to warehouse stock."
        
    if action == "book_consultation":
        status = tool_res.get("status", "pending")
        c_id = tool_res.get("consultation_id")
        c_id_str = f" (ID: #{c_id})" if c_id else ""
        return f"Success! Your consultation booking has been created and is currently **{status}**{c_id_str}."
        
    if action == "cancel_consultation":
        return f"Success! Consultation #{tool_res.get('consultation_id')} has been successfully cancelled."
        
    return f"Action completed successfully: {tool_res}"


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
        redis_pending = await session_memory.aget_pending_action(session_id)
        if redis_pending:
            pending_action = redis_pending.get("action")
            pending_args = redis_pending.get("args") or {}

    # Fallback reconstruction: only look at the immediately preceding
    # assistant turn, never the whole history, so a stale confirmation
    # prompt from several turns ago can't be replayed by an unrelated
    # later message (mirrors the 5-minute TTL on the Redis-stored version).
    if not pending_action and len(messages) >= 2:
        prev_msg = messages[-2]
        if prev_msg.get("role") == "assistant":
            content = prev_msg.get("content", "")
            if "⚠️ CONFIRMATION REQUIRED" in content:
                match = re.search(r"action\s+'([^']+)'\s+for\s+order\s+#(\d+)", content)
                if match:
                    pending_action = match.group(1)
                    pending_args = {"order_id": int(match.group(2))}
                else:
                    match_c = re.search(r"action\s+'([^']+)'\s+for\s+doctor\s+#?(\d+)\s+and\s+pet\s+#?(\d+)", content)
                    if match_c:
                        pending_action = match_c.group(1)
                        pending_args = {
                            "doctor_id": int(match_c.group(2)),
                            "pet_id": int(match_c.group(3))
                        }

    # 3. Handle HITL Action Approval on Customer Confirmation
    if pending_action and _is_affirmative_reply(query_lower):
        # Support both bare and tool_ prefixed action names
        normalized_action = pending_action.replace("tool_", "")
        prefixed_action = f"tool_{normalized_action}"
        
        tool_fn = None
        if normalized_action in tools_by_name:
            tool_fn = tools_by_name[normalized_action]
        elif prefixed_action in tools_by_name:
            tool_fn = tools_by_name[prefixed_action]

        if tool_fn:
            if normalized_action == "cancel_order":
                target_order_id = pending_args.get("order_id", 101)
                idempotency_key = f"idem_cancel_{session_user_id}_{target_order_id}"

                tool_res = await tool_fn.ainvoke({
                    "session_user_id": session_user_id,
                    "order_id": target_order_id,
                    "idempotency_key": idempotency_key,
                })
                reply = format_action_response("cancel_order", tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": messages + [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby Order Service"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

            elif normalized_action == "book_consultation":
                call_args = dict(pending_args)
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
                        "messages": messages + [{"role": "assistant", "content": reply}],
                        "pending_action": None,
                        "pending_action_args": None,
                    }

                # Validate scheduled date is in the future
                sched_str = call_args.get("scheduled_at_iso")
                if sched_str:
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
                                "messages": messages + [{"role": "assistant", "content": reply}],
                                "pending_action": None,
                                "pending_action_args": None,
                            }
                    except Exception:
                        pass
                
                tool_res = await tool_fn.ainvoke(call_args)
                reply = format_action_response("book_consultation", tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": messages + [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby Vet Booking Service"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

            elif normalized_action == "cancel_consultation":
                consultation_id = pending_args.get("consultation_id", 1)
                idempotency_key = f"idem_cancel_consult_{session_user_id}_{consultation_id}"

                tool_res = await tool_fn.ainvoke({
                    "session_user_id": session_user_id,
                    "consultation_id": consultation_id,
                    "idempotency_key": idempotency_key,
                })
                reply = format_action_response("cancel_consultation", tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": messages + [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby Vet Booking Service"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

            elif pending_action in STATE_CHANGING_TOOLS or prefixed_action in STATE_CHANGING_TOOLS:
                # Generic fallback for any other state-changing tool that reaches
                # this point (e.g. added later) — still requires this same
                # confirm-then-invoke path, never a direct call.
                call_args: dict[str, Any] = dict(pending_args)
                call_args["session_user_id"] = session_user_id
                call_args.setdefault(
                    "idempotency_key",
                    f"idem_{pending_action}_{session_user_id}_{'_'.join(str(v) for v in pending_args.values())}",
                )
                tool_res = await tool_fn.ainvoke(call_args)
                reply = format_action_response(normalized_action, tool_res)
                if session_id:
                    await session_memory.aclear_pending_action(session_id)
                return {
                    "messages": messages + [{"role": "assistant", "content": reply}],
                    "sources": ["Scooby FastMCP Tool Engine"],
                    "pending_action": None,
                    "pending_action_args": None,
                }

    # 4. Native ChatLiteLLM Tool Binding Execution Loop
    if GEMINI_API_KEY and mcp_tools:
        try:
            llm = get_llm_with_fallback(model_name="gemini/gemini-3.1-flash-lite", temperature=0.1)
            
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
                from langchain_core.messages import SystemMessage, HumanMessage, BaseMessage
                from datetime import datetime, timezone
                current_time_str = datetime.now(timezone.utc).isoformat()
                messages_input: list[BaseMessage] = [
                    SystemMessage(content=(
                        "You are Scooby Kitchen's AI Commerce Assistant. "
                        "Answer customer requests about products, orders, and bookings. "
                        f"Current Date and Time: {current_time_str}\n"
                        "To book a consultation: You MUST call 'tool_book_consultation' directly using 'pet_name' and 'doctor_name' arguments when the user provides names instead of IDs. Do NOT look up IDs first, and do NOT ask for confirmation or generate the confirmation prompt yourself; the system will automatically intercept your tool call and present the confirmation gate to the user."
                        "\nCRITICAL: Keep your response short, concise, and clear (maximum 3 sentences or a few brief bullet points)."
                    )),
                    HumanMessage(content=user_query)
                ]
                ai_msg = await llm_with_tools.with_config({"tags": ["agent_response"]}).ainvoke(messages_input)

                # Check if LLM generated tool calls natively
                if hasattr(ai_msg, "tool_calls") and ai_msg.tool_calls:
                    for call in ai_msg.tool_calls:
                        t_name = call.get("name")
                        t_args = call.get("args") or {}
                        if t_name in tools_by_name:
                            # SAFETY GATE: any state-changing tool must go
                            # through explicit HITL confirmation, even when
                            # the model chose to call it on its own via
                            # native tool-calling rather than through one of
                            # the keyword-triggered flows.
                            normalized_t_name = t_name.replace("tool_", "")
                            if normalized_t_name in STATE_CHANGING_TOOLS or t_name in STATE_CHANGING_TOOLS:
                                confirm_args = _default_pending_args(normalized_t_name, t_args)
                                confirm_args.pop("session_user_id", None)
                                
                                # Validate scheduled date is in the future
                                if normalized_t_name == "book_consultation":
                                    sched_str = confirm_args.get("scheduled_at_iso")
                                    if sched_str:
                                        try:
                                            from datetime import datetime, timezone
                                            dt = datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
                                            if dt.tzinfo is None:
                                                dt = dt.replace(tzinfo=timezone.utc)
                                            else:
                                                dt = dt.astimezone(timezone.utc)
                                            
                                            if dt <= datetime.now(timezone.utc):
                                                reply = "To book a consultation, the appointment date and time must be in the future, not in the past."
                                                return {
                                                    "messages": messages + [{"role": "assistant", "content": reply}],
                                                    "pending_action": None,
                                                    "pending_action_args": None,
                                                }
                                        except Exception:
                                            pass

                                reply = _confirmation_prompt(normalized_t_name, confirm_args)
                                if session_id:
                                    await session_memory.aset_pending_action(session_id, t_name, confirm_args)
                                return {
                                    "messages": messages + [{"role": "assistant", "content": reply}],
                                    "requires_confirmation": True,
                                    "pending_action": t_name,
                                    "pending_action_args": confirm_args,
                                }

                            # Inject session_user_id authoritatively only if the tool accepts it
                            if "session_user_id" in tools_by_name[t_name].args:
                                t_args["session_user_id"] = session_user_id
                            elif "session_user_id" in t_args:
                                t_args.pop("session_user_id")

                            tool_res = await tools_by_name[t_name].ainvoke(t_args)
                            sanitized_res = redact_pii_text(str(tool_res))
                            
                            # Second pass: ask the LLM to summarize the tool output for the user
                            from langchain_core.messages import ToolMessage, SystemMessage
                            
                            messages_input.append(ai_msg)
                            messages_input.append(ToolMessage(content=sanitized_res, tool_call_id=call.get("id", "")))
                            messages_input.append(SystemMessage(content=(
                                "Now, present the tool output data clearly to the user. "
                                "Make it friendly, conversational, and format the product lists or slots cleanly."
                            )))
                            
                            summary_msg = await llm.with_config({"tags": ["agent_response"]}).ainvoke(messages_input)
                            reply = summary_msg.content if hasattr(summary_msg, "content") else str(summary_msg)
                            
                            return {
                                "messages": messages + [{"role": "assistant", "content": reply}],
                                "sources": ["Scooby FastMCP Tool Engine"],
                            }

                if hasattr(ai_msg, "content") and ai_msg.content:
                    return {"messages": messages + [{"role": "assistant", "content": ai_msg.content}]}
        except Exception as e:
            print(f"❌ [Commerce Agent Exception] Tool calling loop failed: {e}", flush=True)
            import traceback
            traceback.print_exc()

    # Fallback State-changing Action HITL Confirmation Triggering
    if "cancel" in query_lower and ("order" in query_lower or "cancellation" in query_lower):
        order_match = re.search(r"#?(\d+)", user_query)
        target_order_id = int(order_match.group(1)) if order_match else 101
        
        reply = (
            f"⚠️ CONFIRMATION REQUIRED: Are you sure you want to execute action 'cancel_order' for order #{target_order_id}? "
            f"This will release reserved stock back to inventory. Please reply 'Yes, confirm' to proceed."
        )
        if session_id:
            await session_memory.aset_pending_action(session_id, "cancel_order", {"order_id": target_order_id})
        return {
            "messages": messages + [{"role": "assistant", "content": reply}],
            "requires_confirmation": True,
            "pending_action": "cancel_order",
            "pending_action_args": {"order_id": target_order_id},
        }

    if "book" in query_lower and ("vet" in query_lower or "doctor" in query_lower or "consultation" in query_lower):
        doc_match = re.search(r"doctor\s+#?(\d+)", query_lower) or re.search(r"doc\s+#?(\d+)", query_lower)
        doctor_id = int(doc_match.group(1)) if doc_match else None
        pet_match = re.search(r"pet\s+#?(\d+)", query_lower)
        pet_id = int(pet_match.group(1)) if pet_match else None

        missing_fields = []
        if not doctor_id:
            missing_fields.append("doctor ID")
        if not pet_id:
            missing_fields.append("pet ID")
            
        if missing_fields:
            reply = f"To book a consultation using the fallback router, please provide: {', '.join(missing_fields)}."
            return {"messages": messages + [{"role": "assistant", "content": reply}]}

        args = {
            "doctor_id": doctor_id,
            "pet_id": pet_id,
            "scheduled_at_iso": "2026-08-31T10:00:00Z",
            "reason": "Vet Consultation",
        }
        if session_id:
            await session_memory.aset_pending_action(session_id, "book_consultation", args)
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

    # Direct tool invocation fallback
    if "order" in query_lower or "status" in query_lower:
        order_match = re.search(r"#?(\d+)", user_query)
        if order_match:
            t_key = "tool_get_order_status" if "tool_get_order_status" in tools_by_name else "get_order_status"
            if t_key in tools_by_name:
                order_id = int(order_match.group(1))
                tool_res = await tools_by_name[t_key].ainvoke({"session_user_id": session_user_id, "order_id": order_id})
                reply = f"Here is your order status for Order #{order_id}:\n{tool_res}"
                return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Order Service"]}
        else:
            t_key = "tool_get_my_orders" if "tool_get_my_orders" in tools_by_name else "get_my_orders"
            if t_key in tools_by_name:
                tool_res = await tools_by_name[t_key].ainvoke({"session_user_id": session_user_id, "limit": 10})
                reply = f"Here are your past and current orders:\n{tool_res}"
                return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Order Service"]}

    elif "product" in query_lower or "search" in query_lower:
        t_key = "tool_search_products" if "tool_search_products" in tools_by_name else "search_products"
        if t_key in tools_by_name:
            tool_res = await tools_by_name[t_key].ainvoke({"search": user_query, "limit": 5})
            reply = f"Here are matching products:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Product Catalog"]}

    elif "slot" in query_lower or "vet" in query_lower or "doctor" in query_lower or "availability" in query_lower:
        t_key = "tool_get_available_slots" if "tool_get_available_slots" in tools_by_name else "get_available_slots"
        if t_key in tools_by_name:
            tool_res = await tools_by_name[t_key].ainvoke({})
            reply = f"Here are available vet consultation slots:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Vet Service"]}

    elif "pet" in query_lower or "pets" in query_lower:
        t_key = "tool_get_my_pets" if "tool_get_my_pets" in tools_by_name else "get_my_pets"
        if t_key in tools_by_name:
            tool_res = await tools_by_name[t_key].ainvoke({"session_user_id": session_user_id})
            reply = f"Here are your registered pets:\n{tool_res}"
            return {"messages": messages + [{"role": "assistant", "content": reply}], "sources": ["Scooby Pet Service"]}

    reply = "I can assist with your orders, product catalog search, and vet consultation bookings. How can I help you today?"
    return {"messages": messages + [{"role": "assistant", "content": reply}]}
