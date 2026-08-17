import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Request
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
    enforce_rate_limit(req, user_id=current_user_id)

    # 2. LangChain Prompt Safety & PII Redaction Pipeline
    sanitized_message = validate_prompt_safety(request_data.message)

    # Validate session ownership context (IDOR defense)
    validate_session_ownership(request_data.session_id, current_user_id)

    # 3. Load multi-turn history from Redis session memory
    history = session_memory.get_history(request_data.session_id)
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
        final_state = await chatbot_graph.ainvoke(initial_state)
        messages = final_state.get("messages", [])
        raw_reply = messages[-1]["content"] if messages else "No response generated."
        bot_reply = redact_pii_text(raw_reply)
        sources = final_state.get("sources", [])

        # 5. Save turns into Redis session memory (30-min TTL)
        session_memory.save_message(request_data.session_id, "user", sanitized_message)
        session_memory.save_message(request_data.session_id, "assistant", bot_reply)

        return ChatResponse(
            reply=bot_reply,
            status="success",
            session_id=request_data.session_id,
            sources=sources,
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=500, detail=f"Error executing chatbot workflow: {str(exc)}")


@router.post("/stream")
async def chat_stream_endpoint(
    request_data: ChatRequest,
    req: Request,
    current_user_id: int | None = Depends(get_current_chat_user),
) -> StreamingResponse:
    """[SSE STREAMING] Real-time response token streaming powered by Server-Sent Events (SSE)."""
    if not request_data.message.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # 1. Enforce Rate Limiting & Safety Guardrails
    enforce_rate_limit(req, user_id=current_user_id)
    sanitized_message = validate_prompt_safety(request_data.message)

    # Validate session ownership context (IDOR defense)
    validate_session_ownership(request_data.session_id, current_user_id)

    # 2. Load multi-turn history from Redis session memory
    history = session_memory.get_history(request_data.session_id)
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
        try:
            async for event in chatbot_graph.astream_events(initial_state, version="v2"):
                kind = event.get("event")

                # 1. Native Real-Time LLM Token Emission
                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    content = getattr(chunk, "content", None)
                    if content and isinstance(content, str):
                        accumulated_text += content
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"

                # 2. FastMCP Tool Execution Status Notification
                elif kind == "on_tool_start":
                    tool_name = event.get("name", "tool")
                    yield f"data: {json.dumps({'type': 'status', 'content': f'Executing tool {tool_name}...'})}\n\n"

                # 3. Capture Node Output Sources
                elif kind == "on_chain_end":
                    output = event.get("data", {}).get("output")
                    if isinstance(output, dict) and "sources" in output and output["sources"]:
                        for s in output["sources"]:
                            if s not in collected_sources:
                                collected_sources.append(s)

            # Fallback for static responses / offline mode if no live LLM tokens were streamed
            if not accumulated_text.strip():
                final_state = await chatbot_graph.ainvoke(initial_state)
                messages = final_state.get("messages", [])
                accumulated_text = messages[-1]["content"] if messages else "No response generated."
                collected_sources = final_state.get("sources", [])
                
                yield f"data: {json.dumps({'type': 'sources', 'sources': collected_sources})}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'content': accumulated_text})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'sources', 'sources': collected_sources})}\n\n"

            # Persist session conversation history into Redis memory
            session_memory.save_message(request_data.session_id, "user", sanitized_message)
            session_memory.save_message(request_data.session_id, "assistant", accumulated_text)

            # Emit completion event
            yield f"data: {json.dumps({'type': 'done', 'session_id': request_data.session_id, 'status': 'success'})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")


@router.delete("/session/{session_id}")
def clear_session_endpoint(
    session_id: str,
    current_user_id: int = Depends(get_current_chat_user),
) -> dict[str, str]:
    """Purge session conversation history (e.g. on logout)."""
    validate_session_ownership(session_id, current_user_id)
    session_memory.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} purged."}
