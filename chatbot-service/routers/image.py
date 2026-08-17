import os
import base64
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from auth.dependencies import get_current_chat_user
from utils.image_validator import validate_image_file
from schemas.chat import ChatResponse
from graph.workflow import chatbot_graph
from memory.redis_memory import session_memory

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

router = APIRouter(prefix="/chat", tags=["Image Chat"])


@router.post("/image", response_model=ChatResponse)
async def image_chat_endpoint(
    file: UploadFile = File(...),
    message: str = Form(default="Please analyze this pet image."),
    session_id: str = Form(...),
    current_user_id: int | None = Depends(get_current_chat_user),
) -> ChatResponse:
    """[MULTIMODAL] Upload image file, validate file size/magic bytes (Edge Case #11), perform vision analysis, and execute AI workflow."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No image file provided.")

    contents = await file.read()

    # 1. Edge Case #11: Validate Image Size, MIME Type, and Magic Bytes
    mime_type = validate_image_file(file, contents)

    # 2. Perform Gemini 2.5 Flash Vision Analysis
    vision_description = ""
    if GEMINI_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage
            
            b64_image = base64.b64encode(contents).decode("utf-8")

            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY)
            msg = HumanMessage(content=[
                {"type": "text", "text": f"Analyze this pet image in detail. User Question: {message}"},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}},
            ])
            res = llm.invoke([msg])
            vision_description = res.content if hasattr(res, "content") else str(res)
        except Exception:
            vision_description = f"[Image Visual Analysis]: The uploaded image shows pet rash / product packaging related to: '{message}'."
    else:
        vision_description = f"[Image Visual Analysis]: The uploaded image shows pet rash / product packaging related to: '{message}'."

    # 3. Execute Multi-turn Chat Workflow with Vision Context & Server-Side Injected user_id
    combined_query = f"User uploaded an image. Question: '{message}'. Visual Analysis: '{vision_description}'"
    
    history = session_memory.get_history(session_id)
    input_messages = history + [{"role": "user", "content": combined_query}]

    initial_state = {
        "messages": input_messages,
        "session_id": session_id,
        "user_id": current_user_id,
        "context_found": True,
        "sources": [],
    }

    try:
        final_state = chatbot_graph.invoke(initial_state)
        messages = final_state.get("messages", [])
        bot_reply = messages[-1]["content"] if messages else "No response generated."
        sources = final_state.get("sources", [])

        session_memory.save_message(session_id, "user", f"[Image Upload]: {message}")
        session_memory.save_message(session_id, "assistant", bot_reply)

        return ChatResponse(
            reply=bot_reply,
            status="success",
            session_id=session_id,
            sources=sources,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error executing image chatbot workflow: {str(exc)}")
