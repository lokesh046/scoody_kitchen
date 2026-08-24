import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request

logger = logging.getLogger(__name__)
from fastapi.responses import StreamingResponse

from auth.dependencies import get_current_chat_user, validate_session_ownership
from graph.workflow import chatbot_graph
from memory.redis_memory import session_memory
from schemas.chat import ChatRequest, ChatResponse
from utils.guardrails import redact_pii_text, validate_prompt_safety
from utils.rate_limiter import enforce_rate_limit

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat_endpoint(
    request_data: ChatRequest,
    req: Request,
    current_user_id: int | None = Depends(get_current_chat_user),
) -> ChatResponse:
    """Execute multi-turn conversational AI chatbot powered by LangGraph, PII Redaction, & Safety Guardrails."""
    if not request_data.message.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # 1. Enforce Rate Limiting Guardrail
    import time
    start_total = time.perf_counter()

    # 1. Enforce Rate Limiting Guardrail
    enforce_rate_limit(req, user_id=current_user_id)

    # 2. LangChain Prompt Safety & PII Redaction Pipeline
    start_safety = time.perf_counter()
    try:
        sanitized_message = validate_prompt_safety(request_data.message)
    except HTTPException as exc:
        if exc.status_code == 400 and "Security Violation" in exc.detail:
            warning_text = "🛡️ [Safety Notice] I'm sorry, but your message was flagged by our safety system as a potential instruction override or security concern. I cannot fulfill this request."
            return ChatResponse(
                reply=warning_text,
                status="success",
                session_id=request_data.session_id,
                sources=["Scooby Guardrails Engine"],
            )
        raise exc
    safety_duration = (time.perf_counter() - start_safety) * 1000.0

    # Validate session ownership context (IDOR defense)
    validate_session_ownership(request_data.session_id, current_user_id)

    # 3. Load multi-turn history from Redis session memory
    start_redis_load = time.perf_counter()
    history = session_memory.get_history(request_data.session_id)
    redis_load_duration = (time.perf_counter() - start_redis_load) * 1000.0

    input_messages = history + [{"role": "user", "content": sanitized_message}]

    # 4. Execute LangGraph RAG Workflow with server-side injected user_id (IDOR Defense)
    initial_state = {
        "messages": input_messages,
        "session_id": request_data.session_id,
        "user_id": current_user_id,
        "context_found": True,
        "sources": [],
    }

    try:
        start_graph = time.perf_counter()
        final_state = await chatbot_graph.ainvoke(initial_state)
        graph_duration = (time.perf_counter() - start_graph) * 1000.0

        messages = final_state.get("messages", [])
        last_msg = None
        for msg in reversed(messages):
            msg_class = msg.__class__.__name__
            if msg_class in ["AIMessage", "ToolMessage"]:
                last_msg = msg
                break
            elif hasattr(msg, "type") and getattr(msg, "type", None) in ["ai", "assistant"]:
                last_msg = msg
                break
            elif isinstance(msg, dict) and (msg.get("role") in ["assistant", "ai"] or msg.get("type") in ["ai", "assistant"]):
                last_msg = msg
                break

        raw_reply = ""
        if last_msg:
            if hasattr(last_msg, "content"):
                raw_reply = last_msg.content
            elif isinstance(last_msg, dict):
                raw_reply = last_msg.get("content", "")
            else:
                raw_reply = str(last_msg)
        else:
            raw_reply = "No response generated."

        if isinstance(raw_reply, list):
            text_parts = []
            for block in raw_reply:
                if isinstance(block, str):
                    text_parts.append(block)
                elif isinstance(block, dict):
                    text_parts.append(block.get("text", block.get("content", "")))
                elif hasattr(block, "text"):
                    text_parts.append(getattr(block, "text", ""))
            raw_reply = "".join(text_parts).strip()
        bot_reply = redact_pii_text(raw_reply)
        sources = final_state.get("sources", [])

        # Find tool calls in message list
        tools_used = []
        for msg in messages:
            if isinstance(msg, dict):
                if msg.get("role") == "tool":
                    name = msg.get("name")
                    if name and name not in tools_used:
                        tools_used.append(name)
            else:
                if hasattr(msg, "type") and msg.type == "tool":
                    name = getattr(msg, "name", None)
                    if name and name not in tools_used:
                        tools_used.append(name)

        # 5. Save turns into Redis session memory (30-min TTL)
        start_redis_save = time.perf_counter()
        session_memory.save_message(request_data.session_id, "user", sanitized_message)
        session_memory.save_message(request_data.session_id, "assistant", bot_reply)
        redis_save_duration = (time.perf_counter() - start_redis_save) * 1000.0

        total_duration = (time.perf_counter() - start_total) * 1000.0

        # Print session summary to terminal
        print(f"\n========================================\n"
              f"[CHAT RESPONSE SUMMARY]\n"
              f"Session ID: {request_data.session_id}\n"
              f"User Query: {sanitized_message}\n"
              f"Tools Used: {', '.join(tools_used) if tools_used else 'None (Direct Answer)'}\n"
              f"Response Length: {len(bot_reply)} chars\n"
              f"----------------------------------------\n"
              f"[Performance Metrics]\n"
              f"Safety Validation : {safety_duration:.2f}ms\n"
              f"Redis History Load: {redis_load_duration:.2f}ms\n"
              f"LangGraph Workflow: {graph_duration:.2f}ms\n"
              f"Redis History Save: {redis_save_duration:.2f}ms\n"
              f"Total Request Time: {total_duration:.2f}ms\n"
              f"========================================\n", flush=True)

        return ChatResponse(
            reply=bot_reply,
            status="success",
            session_id=request_data.session_id,
            sources=sources,
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        logger.error("Chat workflow failed for session %s: %s", request_data.session_id, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Something went wrong processing your message. Please try again."
        )


@router.post("/stream")
async def chat_stream_endpoint(
    request_data: ChatRequest,
    req: Request,
    current_user_id: int | None = Depends(get_current_chat_user),
) -> StreamingResponse:
    """[SSE STREAMING] Real-time response token streaming powered by Server-Sent Events (SSE)."""
    if not request_data.message.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    import time
    start_total = time.perf_counter()

    # 1. Enforce Rate Limiting & Safety Guardrails
    enforce_rate_limit(req, user_id=current_user_id)
    start_safety = time.perf_counter()
    try:
        sanitized_message = validate_prompt_safety(request_data.message)
    except HTTPException as exc:
        if exc.status_code == 400 and "Security Violation" in exc.detail:
            async def graceful_safety_stream_generator():
                warning_text = "🛡️ [Safety Notice] I'm sorry, but your message was flagged by our safety system as a potential instruction override or security concern. I cannot fulfill this request."
                yield f"data: {json.dumps({'type': 'sources', 'sources': ['Scooby Guardrails Engine']})}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'content': warning_text})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'session_id': request_data.session_id, 'status': 'success'})}\n\n"
            return StreamingResponse(graceful_safety_stream_generator(), media_type="text/event-stream")
        raise exc
    safety_duration = (time.perf_counter() - start_safety) * 1000.0

    # Validate session ownership context (IDOR defense)
    validate_session_ownership(request_data.session_id, current_user_id)

    # 2. Load multi-turn history from Redis session memory
    start_redis_load = time.perf_counter()
    history = session_memory.get_history(request_data.session_id)
    redis_load_duration = (time.perf_counter() - start_redis_load) * 1000.0

    input_messages = history + [{"role": "user", "content": sanitized_message}]

    initial_state = {
        "messages": input_messages,
        "session_id": request_data.session_id,
        "user_id": current_user_id,
        "context_found": True,
        "sources": [],
    }

    async def sse_event_generator():
        accumulated_text = ""
        collected_sources = []
        tools_used = []
        tool_start_times = {}
        node_start_times = {}
        final_state_output = None
        start_stream = time.perf_counter()
        ttft = 0.0

        try:
            async for event in chatbot_graph.astream_events(initial_state, version="v2"):
                kind = event.get("event")

                # 1. Native Real-Time LLM Token Emission
                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    content = getattr(chunk, "content", None)
                    if content and isinstance(content, str):
                        if not accumulated_text:
                            ttft = (time.perf_counter() - start_stream) * 1000.0
                        accumulated_text += content
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"

                # 2. FastMCP Tool Execution Status Notification
                elif kind == "on_tool_start":
                    tool_name = event.get("name", "tool")
                    tool_input = event.get("data", {}).get("input", {})
                    event_id = event.get("id", "")
                    tool_start_times[event_id] = (tool_name, time.perf_counter())
                    if tool_name not in tools_used:
                        tools_used.append(tool_name)
                    # Print to terminal console
                    print(f"\n[TOOL CALL] Executing tool: {tool_name} | Input: {tool_input}", flush=True)
                    yield f"data: {json.dumps({'type': 'status', 'content': f'Executing tool {tool_name}...'})}\n\n"

                elif kind == "on_tool_end":
                    event_id = event.get("id", "")
                    if event_id in tool_start_times:
                        tool_name, start_time = tool_start_times[event_id]
                        duration = (time.perf_counter() - start_time) * 1000.0
                        print(f"📊 [Tool Timer] Tool '{tool_name}' executed in {duration:.2f}ms", flush=True)
                        yield f"data: {json.dumps({'type': 'status', 'content': f'Tool {tool_name} completed in {duration:.0f}ms'})}\n\n"

                elif kind == "on_chain_start":
                    name = event.get("name")
                    if name in ["knowledge_agent", "commerce_agent", "health_agent", "router_node"]:
                        event_id = event.get("id", "")
                        node_start_times[event_id] = (name, time.perf_counter())

                # 3. Capture Node Output Sources & Final Responses
                elif kind == "on_chain_end":
                    event_id = event.get("id", "")
                    # Log Agent Node Durations
                    if event_id in node_start_times:
                        node_name, start_time = node_start_times[event_id]
                        duration = (time.perf_counter() - start_time) * 1000.0
                        print(f"📊 [Agent Timer] Agent node '{node_name}' completed in {duration:.2f}ms", flush=True)

                    output = event.get("data", {}).get("output")
                    if isinstance(output, dict):
                        # If this is the root graph ending (contains messages and sources)
                        if "messages" in output and "sources" in output:
                            final_state_output = output
                            msgs = output.get("messages", [])
                            print(f"\n🔎 [Debug Search] Graph/Node finished. Messages: {len(msgs)}", flush=True)

                            # Extract sources
                            if output["sources"]:
                                for s in output["sources"]:
                                    if s not in collected_sources:
                                        collected_sources.append(s)
                        
                        # Fallback: if it's a child node chain that has sources
                        elif "sources" in output and output["sources"]:
                            for s in output["sources"]:
                                if s not in collected_sources:
                                    collected_sources.append(s)

            # If no streaming tokens were collected, extract the response from the final root state output
            if not accumulated_text.strip() and final_state_output:
                msgs = final_state_output.get("messages", [])
                last_msg = None
                for idx, msg in enumerate(reversed(msgs)):
                    msg_class = msg.__class__.__name__
                    msg_type = getattr(msg, "type", None)
                    msg_role = msg.get("role") if isinstance(msg, dict) else None
                    print(f"   [Final Fallback Extraction] Index {idx}: Class={msg_class} | Type={msg_type} | Role={msg_role} | Content={str(msg)[:60]}", flush=True)
                    
                    if msg_class in ["AIMessage", "ToolMessage"]:
                        last_msg = msg
                        break
                    elif hasattr(msg, "type") and getattr(msg, "type", None) in ["ai", "assistant"]:
                        last_msg = msg
                        break
                    elif isinstance(msg, dict) and (msg.get("role") in ["assistant", "ai"] or msg.get("type") in ["ai", "assistant"]):
                        last_msg = msg
                        break

                raw_reply = ""
                if last_msg:
                    if hasattr(last_msg, "content"):
                        raw_reply = last_msg.content
                    elif isinstance(last_msg, dict):
                        raw_reply = last_msg.get("content", "")
                    else:
                        raw_reply = str(last_msg)

                # Safe list-to-string conversion
                if isinstance(raw_reply, list):
                    text_parts = []
                    for block in raw_reply:
                        if isinstance(block, str):
                            text_parts.append(block)
                        elif isinstance(block, dict):
                            text_parts.append(block.get("text", block.get("content", "")))
                        elif hasattr(block, "text"):
                            text_parts.append(getattr(block, "text", ""))
                    raw_reply = "".join(text_parts).strip()
                accumulated_text = str(raw_reply) if raw_reply else "No response generated."
                
                # Send the accumulated fallback tokens to the frontend so the chat bubble updates
                yield f"data: {json.dumps({'type': 'token', 'content': accumulated_text})}\n\n"

            # Always emit the collected sources to the client at the end of the stream
            yield f"data: {json.dumps({'type': 'sources', 'sources': collected_sources})}\n\n"

            # 5. Save turns into Redis session memory (30-min TTL)
            start_redis_save = time.perf_counter()
            session_memory.save_message(request_data.session_id, "user", sanitized_message)
            session_memory.save_message(request_data.session_id, "assistant", accumulated_text)
            redis_save_duration = (time.perf_counter() - start_redis_save) * 1000.0

            total_duration = (time.perf_counter() - start_total) * 1000.0

            # Print session summary to terminal
            print(f"\n========================================\n"
                  f"[CHAT RESPONSE STREAM SUMMARY]\n"
                  f"Session ID: {request_data.session_id}\n"
                  f"User Query: {sanitized_message}\n"
                  f"Tools Used: {', '.join(tools_used) if tools_used else 'None (Direct Answer)'}\n"
                  f"Response Length: {len(accumulated_text)} chars\n"
                  f"----------------------------------------\n"
                  f"[Performance Metrics]\n"
                  f"Safety Validation : {safety_duration:.2f}ms\n"
                  f"Redis History Load: {redis_load_duration:.2f}ms\n"
                  f"Time to First Tok : {ttft:.2f}ms\n"
                  f"Redis History Save: {redis_save_duration:.2f}ms\n"
                  f"Total Request Time: {total_duration:.2f}ms\n"
                  f"========================================\n", flush=True)

            # Emit completion event
            yield f"data: {json.dumps({'type': 'done', 'session_id': request_data.session_id, 'status': 'success'})}\n\n"

        except Exception as exc:
            logger.error("Streaming chat failed for session %s: %s", request_data.session_id, exc, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Something went wrong. Please try again.'})}\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")


@router.get("/session/{session_id}")
def get_session_history_endpoint(
    session_id: str,
    current_user_id: int = Depends(get_current_chat_user),
) -> dict:
    """Fetch session conversation history."""
    validate_session_ownership(session_id, current_user_id)
    history = session_memory.get_history(session_id)
    return {"status": "success", "history": history}


@router.delete("/session/{session_id}")
def clear_session_endpoint(
    session_id: str,
    current_user_id: int = Depends(get_current_chat_user),
) -> dict[str, str]:
    """Purge session conversation history (e.g. on logout)."""
    validate_session_ownership(session_id, current_user_id)
    session_memory.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} purged."}
