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

import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

# Enforce standard HTTP/REST transport globally to avoid gRPC IPv6 DNS hangs
os.environ["GOOGLE_GENAI_USE_REST"] = "1"
os.environ["GRPC_DNS_RESOLVER"] = "native"

try:
    from google import genai  # type: ignore
except ImportError:
    pass



# Load env variables from .env file manually to avoid dependency issues
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                if key not in os.environ:
                    os.environ[key] = val.strip()

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

# LangSmith tracing activates purely from environment variables — LangChain's
# own SDK checks these directly, so there's no code to wire up beyond making
# sure a project name is set when tracing is on. Without this, every trace
# would dump into a generic "default" project instead of being grouped
# clearly. Accepts either the current (LANGSMITH_*) or legacy (LANGCHAIN_*)
# names, since both are still honored.
_tracing_enabled = os.environ.get("LANGSMITH_TRACING") or os.environ.get("LANGCHAIN_TRACING_V2")
if _tracing_enabled and _tracing_enabled.lower() == "true":
    if "LANGSMITH_PROJECT" not in os.environ and "LANGCHAIN_PROJECT" not in os.environ:
        os.environ["LANGSMITH_PROJECT"] = "scooby-kitchen-chatbot"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.health import router as health_router
from routers.chat import router as chat_router
from routers.rag_admin import router as rag_admin_router
from routers.voice import router as voice_router
from routers.image import router as image_router
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    tracing_on = os.environ.get("LANGSMITH_TRACING") or os.environ.get("LANGCHAIN_TRACING_V2")
    has_key = bool(os.environ.get("LANGSMITH_API_KEY") or os.environ.get("LANGCHAIN_API_KEY"))
    if tracing_on and tracing_on.lower() == "true" and has_key:
        project = os.environ.get("LANGSMITH_PROJECT") or os.environ.get("LANGCHAIN_PROJECT")
        print(f"✅ [Startup] LangSmith tracing enabled — project '{project}'.", flush=True)
    else:
        print(
            "ℹ️  [Startup] LangSmith tracing is OFF. Set LANGSMITH_TRACING=true and "
            "LANGSMITH_API_KEY in .env to see full request traces (which agent ran, "
            "every tool call, every LLM call, with timing) instead of scattered print()s.",
            flush=True,
        )

    from mcp_client import mcp_client
    try:
        await mcp_client.initialize()
    except Exception as e:
        print(f"⚠️ [Startup Warning] Failed to warm up MCP client: {e}", flush=True)

    # Prompt Guard (and the RAG embedding model) now run on the shared
    # ml-inference-service rather than loading in this process — there's
    # nothing local left to warm up here, just confirm that service is
    # reachable and has the model loaded, so a startup misconfiguration
    # (service down, HF_TOKEN missing there) is visible in these logs
    # instead of only surfacing as a silent per-request fallback later.
    try:
        import asyncio
        from utils.prompt_guard import is_prompt_guard_available, PROMPT_GUARD_ENABLED
        if PROMPT_GUARD_ENABLED:
            print("⏳ [Startup] Checking Prompt Guard on ml-inference-service...", flush=True)
            available = await asyncio.to_thread(is_prompt_guard_available)
            if available:
                print("✅ [Startup] Prompt Guard model ready on ml-inference-service.", flush=True)
            else:
                print(
                    "⚠️ [Startup] Prompt Guard unavailable on ml-inference-service — "
                    "falling back to regex-only injection detection.",
                    flush=True,
                )
    except Exception as e:
        print(f"⚠️ [Startup Warning] Failed to reach ml-inference-service: {e}", flush=True)

    yield

app = FastAPI(
    title="Pet Platform Chatbot Service",
    description="Multimodal AI Assistant orchestrator service powered by LangGraph, Pinecone, and FastMCP",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8002",
        "http://127.0.0.1:8002",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://192.168.1.6:3000",
        "http://192.168.1.6:8002",
        "http://192.168.1.6:8081",
        "https://scoobys-kitchen.com",
        "https://www.scoobys-kitchen.com",
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

    # WEB_CONCURRENCY controls worker process count (default 1 for local dev to prevent redundant ML model loading).
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8002")),
        workers=int(os.getenv("WEB_CONCURRENCY", "1")),
    )
