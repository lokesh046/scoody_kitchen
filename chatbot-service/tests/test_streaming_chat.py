import base64
import json
import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure chatbot-service is in sys.path
service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

from main import app
from memory.redis_memory import session_memory

client = TestClient(app)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789_long_key_for_sha256")


def _make_auth_header(user_id: int = 1) -> dict:
    try:
        import jwt
        token = jwt.encode({"sub": str(user_id), "role": "customer"}, JWT_SECRET_KEY, algorithm="HS256")
    except Exception:
        header = base64.b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
        payload = base64.b64encode(json.dumps({"sub": str(user_id), "role": "customer"}).encode()).decode().rstrip("=")
        token = f"{header}.{payload}.sig"
    client.cookies.set("access_token", token)
    return {}


def test_chat_stream_endpoint_sse_output():
    sess_id = "test_stream_sess_001"
    headers = _make_auth_header()

    session_memory.clear_session(sess_id)

    response = client.post(
        "/chat/stream",
        headers=headers,
        json={
            "message": "What is your return policy for unopened items?",
            "session_id": sess_id,
        },
    )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    content = response.text
    assert "data:" in content
    assert '"type": "token"' in content or '"type": "sources"' in content
    assert '"type": "done"' in content

    # Verify session memory saved conversation turn
    history = session_memory.get_history(sess_id)
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
