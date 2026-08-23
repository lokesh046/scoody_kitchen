# Force IPv4 DNS resolution to prevent IPv6 hangs on this system
import socket
orig_getaddrinfo = socket.getaddrinfo
def forced_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if family in (socket.AF_UNSPEC, 0):
        family = socket.AF_INET
    return orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = forced_ipv4_getaddrinfo

import os
import logging

# Suppress noisy Google GenAI warnings from clattering logs
logging.getLogger("google_genai").setLevel(logging.ERROR)



# Load env variables from .env file manually to avoid dependency issues
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

# Load DATABASE_URL and other shared secrets from backend env if not present
backend_env = os.path.join(os.path.dirname(__file__), "../pet-platform-backend/.env")
if os.path.exists(backend_env):
    with open(backend_env, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                if key not in os.environ:
                    os.environ[key] = val.strip()

# Inject fallback allowance for local execution if not explicitly false
if "ALLOW_MCP_FALLBACK" not in os.environ:
    os.environ["ALLOW_MCP_FALLBACK"] = "true"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8002",
        "http://127.0.0.1:8002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(rag_admin_router)
app.include_router(voice_router)
app.include_router(image_router)


if __name__ == "__main__":
    import uvicorn

    # WEB_CONCURRENCY controls worker process count (default 4).
    # Session/chat state lives in Redis, not in-process, so it's safe to
    # scale this horizontally across workers.
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8002")),
        workers=int(os.getenv("WEB_CONCURRENCY", "4")),
    )
