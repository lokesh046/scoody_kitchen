from fastapi import APIRouter, HTTPException
from schemas.chat import ChatRequest, ChatResponse
from graph.workflow import chatbot_graph
from memory.redis_memory import session_memory

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Execute multi-turn conversational AI chatbot powered by LangGraph & RAG."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # 1. Load multi-turn history from Redis session memory
    history = session_memory.get_history(request.session_id)
    input_messages = history + [{"role": "user", "content": request.message}]

    # 2. Execute LangGraph RAG Workflow
    initial_state = {
        "messages": input_messages,
        "session_id": request.session_id,
        "user_id": request.user_id,
        "context_found": True,
        "sources": [],
    }

    try:
        final_state = chatbot_graph.invoke(initial_state)
        messages = final_state.get("messages", [])
        bot_reply = messages[-1]["content"] if messages else "No response generated."
        sources = final_state.get("sources", [])

        # 3. Save turns into Redis session memory (30-min TTL)
        session_memory.save_message(request.session_id, "user", request.message)
        session_memory.save_message(request.session_id, "assistant", bot_reply)

        return ChatResponse(
            reply=bot_reply,
            status="success",
            session_id=request.session_id,
            sources=sources,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error executing chatbot workflow: {str(exc)}")


@router.delete("/session/{session_id}")
def clear_session_endpoint(session_id: str) -> dict[str, str]:
    """Purge session conversation history (e.g. on logout)."""
    session_memory.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} purged."}
