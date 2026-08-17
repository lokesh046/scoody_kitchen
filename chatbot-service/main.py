from fastapi import FastAPI
from routers.health import router as health_router
from routers.chat import router as chat_router
from routers.rag_admin import router as rag_admin_router
from routers.voice import router as voice_router
from routers.image import router as image_router

app = FastAPI(
    title="Pet Platform Chatbot Service",
    description="Multimodal AI Assistant orchestrator service powered by LangGraph, Pinecone, and FastMCP",
    version="1.0.0",
)

# Include Routers
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(rag_admin_router)
app.include_router(voice_router)
app.include_router(image_router)
