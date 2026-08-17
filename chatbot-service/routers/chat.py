from fastapi import APIRouter, Depends, HTTPException, Request
from auth.dependencies import get_current_chat_user
from utils.guardrails import validate_prompt_safety
from utils.rate_limiter import enforce_rate_limit
from schemas.chat import ChatRequest, ChatResponse
from graph.workflow import chatbot_graph
from memory.redis_memory import session_memory

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
def chat_endpoint(
    request_data: ChatRequest,
    req: Request,
    current_user_id: int | None = Depends(get_current_chat_user),
) -> ChatResponse:
    """Execute multi-turn conversational AI chatbot powered by LangGraph, PII Redaction, & Safety Guardrails."""
    if not request_data.message.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # 1. Enforce Rate Limiting Guardrail
    enforce_rate_limit(req)

    # 2. LangChain Prompt Safety & PII Redaction Pipeline
    sanitized_message = validate_prompt_safety(request_data.message)

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
        final_state = chatbot_graph.invoke(initial_state)
        messages = final_state.get("messages", [])
        bot_reply = messages[-1]["content"] if messages else "No response generated."
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


@router.delete("/session/{session_id}")
def clear_session_endpoint(session_id: str) -> dict[str, str]:
    """Purge session conversation history (e.g. on logout)."""
    session_memory.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} purged."}
