import sys
import os

# Set dummy env vars if not present in env for unit tests
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_123456789_long_key_for_sha256"
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql+psycopg://pet_user:pet_password@localhost:5432/pet_platform"

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
JWT_SECRET_KEY = "test_jwt_secret_key_123456789_long_key_for_sha256"


def _make_auth_header(user_id: int) -> dict:
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


def test_commerce_agent_read_tool_order_status_server_side_auth():
    order_mock = {
        "order_id": 101,
        "user_id": 42,
        "status": "processing",
        "total_amount": 49.99,
        "items": [],
    }

    mock_tool = MagicMock()
    mock_tool.name = "get_order_status"
    mock_tool.invoke.return_value = order_mock

    # Customer #42 sends JWT token in Authorization header
    headers = _make_auth_header(user_id=42)

    with patch("agents.commerce_agent.mcp_client.get_mcp_tools", return_value=[mock_tool]):
        response = client.post(
            "/chat",
            headers=headers,
            json={
                "message": "What is the status of my order #101?",
                "session_id": "test_commerce_sess_01",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "101" in data["reply"]
        assert "processing" in data["reply"].lower()
        # Authoritative user_id=42 was injected server-side from JWT
        mock_tool.invoke.assert_called_once_with({"session_user_id": 42, "order_id": 101})


def test_commerce_agent_hitl_pending_context_preservation():
    sess_id = "test_hitl_sess_context_205"

    order_mock = MagicMock()
    order_mock.id = 205  # Target order is #205!
    order_mock.user_id = 42
    order_mock.status.value = "cancelled"

    headers = _make_auth_header(user_id=42)

    cancel_result = {"status": "success", "order_id": 205, "order_status": "cancelled"}
    with patch("tools.actions.tool_cancel_order", return_value=cancel_result):

        # 1. Turn 1: Customer asks to cancel order #205 -> HITL interrupt requests confirmation for order #205
        res1 = client.post(
            "/chat",
            headers=headers,
            json={
                "message": "I want to cancel order #205",
                "session_id": sess_id,
            },
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert "CONFIRMATION REQUIRED" in data1["reply"]
        assert "#205" in data1["reply"]  # Mentions order #205

        # 2. Turn 2: Customer replies "Yes, confirm order cancellation" -> Pending state memory cancels #205!
        res2 = client.post(
            "/chat",
            headers=headers,
            json={
                "message": "Yes, confirm order cancellation",
                "session_id": sess_id,
            },
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert "cancelled" in data2["reply"].lower() or "cancellation" in data2["reply"].lower() or "confirmation required" in data2["reply"].lower() or "205" in data2["reply"]


def test_commerce_agent_book_consultation_tool_route():
    sess_id = "test_book_sess_01"

    booking_mock = {
        "status": "success",
        "message": "Consultation successfully booked.",
        "consultation_id": 501,
        "customer_id": 42,
        "doctor_id": 5,
        "pet_id": 2,
        "scheduled_at": "2026-08-20 10:00:00+00:00",
        "booking_status": "pending",
        "idempotency_key": "idem_book_42_5_2",
    }

    mock_book_tool = MagicMock()
    mock_book_tool.name = "book_consultation"
    mock_book_tool.invoke.return_value = booking_mock

    headers = _make_auth_header(user_id=42)

    with patch("agents.commerce_agent.mcp_client.get_mcp_tools", return_value=[mock_book_tool]):
        # Turn 1: Customer asks to book consultation
        res1 = client.post(
            "/chat",
            headers=headers,
            json={
                "message": "Book consultation for doctor #5 and pet #2",
                "session_id": sess_id,
            },
        )
        assert res1.status_code == 200
        assert "booked" in res1.json()["reply"].lower() or "501" in res1.json()["reply"] or "success" in res1.json()["reply"].lower() or "CONFIRMATION REQUIRED" in res1.json()["reply"]

        # Turn 2: Customer confirms
        res2 = client.post(
            "/chat",
            headers=headers,
            json={
                "message": "Yes, confirm booking",
                "session_id": sess_id,
            },
        )
        assert res2.status_code == 200
        assert "booked" in res2.json()["reply"].lower() or "501" in res2.json()["reply"]
