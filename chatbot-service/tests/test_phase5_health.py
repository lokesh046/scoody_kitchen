import sys
import os
import base64
import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

# Ensure chatbot-service is in sys.path
service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

from main import app

client = TestClient(app)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789_long_key_for_sha256")


def _make_auth_header(user_id: int = 1) -> dict:
    client.cookies.clear()
    try:
        import jwt
        token = jwt.encode({"sub": str(user_id), "role": "customer"}, JWT_SECRET_KEY, algorithm="HS256")
    except Exception:
        header = base64.b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
        payload = base64.b64encode(json.dumps({"sub": str(user_id), "role": "customer"}).encode()).decode().rstrip("=")
        token = f"{header}.{payload}.sig"
    client.cookies.set("access_token", token)
    return {}


def test_health_agent_emergency_red_alert():
    # Emergency symptom: seizure + chocolate poison
    headers = _make_auth_header()
    response = client.post(
        "/chat",
        headers=headers,
        json={
            "message": "My dog ate chocolate and is having a seizure and severe bleeding!",
            "session_id": "test_health_sess_emergency",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "EMERGENCY VETERINARY ALERT" in data["reply"]
    assert "Medical Disclaimer" in data["reply"]
    assert "Scooby Emergency Vet Protocol" in data["sources"]


def test_health_agent_non_emergency_guidance_with_disclaimer():
    # Mild symptom: skin dryness
    headers = _make_auth_header()
    response = client.post(
        "/chat",
        headers=headers,
        json={
            "message": "My cat has mild dry skin symptoms and occasional sneezing.",
            "session_id": "test_health_sess_mild",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "Medical Disclaimer" in data["reply"]
    assert "Scooby Veterinary Guidance" in data["sources"]


def test_health_agent_least_privilege_isolation():
    # Health queries should never execute commerce or cancellation tools
    from agents.health_agent import health_agent_node

    state = {
        "messages": [{"role": "user", "content": "My dog has a fever health symptom"}],
        "user_id": 42,
    }
    import asyncio
    result = asyncio.run(health_agent_node(state))
    assert "messages" in result
    # Verify no commerce tool results exist in output
    reply = result["messages"][-1]["content"]
    assert "order_status" not in reply.lower()
    assert "cancel_order" not in reply.lower()
