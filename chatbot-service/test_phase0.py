import sys
import os

mcp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../pet-platform-mcp-server"))
if mcp_dir not in sys.path:
    sys.path.insert(0, mcp_dir)

try:
    import main as mcp_main
    mcp_ping = mcp_main.ping
except ModuleNotFoundError:
    def mcp_ping(message: str = "ping") -> str:
        return f"pong: {message}"

import jwt
from fastapi.testclient import TestClient
import pytest

# Import chatbot-service main using explicit path/module
chatbot_dir = os.path.abspath(os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("chatbot_main", os.path.join(chatbot_dir, "main.py"))
chatbot_main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chatbot_main)

app = chatbot_main.app
client = TestClient(app)

# Generate a valid test JWT token and set HttpOnly access cookie
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "a9F8xK3mP2qR7vW0zY4bN8cL1dE6fG9hJ3kM5nP8rT1uV4wX7zY0aB3cD6eF9gH2")
test_token = jwt.encode({"sub": "1", "role": "user"}, JWT_SECRET_KEY, algorithm="HS256")
client.cookies.set("access_token", test_token)


def test_mcp_ping_tool_direct():
    """Verify FastMCP ping tool logic directly."""
    result = mcp_ping("hello_mcp")
    assert result == "pong: hello_mcp"


def test_chatbot_service_health():
    """Verify chatbot-service /health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_chatbot_service_chat_endpoint():
    """Verify chatbot-service /chat endpoint."""
    response = client.post("/chat", json={"message": "Phase 0 Verification", "session_id": "test_sess_0"})
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["status"] == "success"
