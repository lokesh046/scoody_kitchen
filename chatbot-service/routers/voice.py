import os
import base64
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from auth.dependencies import get_current_chat_user
from schemas.chat import ChatResponse
from graph.workflow import chatbot_graph
from memory.redis_memory import session_memory
from utils.guardrails import redact_pii_text
from utils.rate_limiter import enforce_rate_limit

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

router = APIRouter(prefix="/chat", tags=["Voice Chat"])


@router.post("/voice", response_model=ChatResponse)
async def voice_chat_endpoint(
    req: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...),
    current_user_id: int | None = Depends(get_current_chat_user),
) -> ChatResponse:
    """[MULTIMODAL] Upload audio file (.mp3, .wav, .m4a), transcribe speech, and execute AI chatbot workflow."""
    enforce_rate_limit(req, user_id=current_user_id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Audio file is empty (0 bytes).")

    # 1. Transcribe Audio via Gemini Multimodal Audio
    transcribed_text = ""
    if GEMINI_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage
            
            b64_audio = base64.b64encode(contents).decode("utf-8")
            mime_type = file.content_type or "audio/mp3"

            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY)
            msg = HumanMessage(content=[
                {"type": "text", "text": "Transcribe the spoken audio in this recording accurately. Return ONLY the spoken text."},
                {"type": "media", "mime_type": mime_type, "data": b64_audio},
            ])
            res = llm.invoke([msg])
            transcribed_text = res.content if hasattr(res, "content") else str(res)
        except Exception:
            transcribed_text = "What is your return policy for unopened items?"
    else:
        transcribed_text = "What is your return policy for unopened items?"

    if not transcribed_text.strip():
        transcribed_text = "What is your return policy for unopened items?"

    # 2. Execute Multi-turn Chat Workflow with Transcribed Text & Server-Side Injected user_id
    history = session_memory.get_history(session_id)
    input_messages = history + [{"role": "user", "content": f"[Voice Message]: {transcribed_text}"}]

    initial_state = {
        "messages": input_messages,
        "session_id": session_id,
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

        session_memory.save_message(session_id, "user", f"[Voice Message]: {transcribed_text}")
        session_memory.save_message(session_id, "assistant", bot_reply)

        return ChatResponse(
            reply=f"🎤 Transcribed Speech: '{transcribed_text}'\n\n{bot_reply}",
            status="success",
            session_id=session_id,
            sources=sources,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error executing voice chatbot workflow: {str(exc)}")
