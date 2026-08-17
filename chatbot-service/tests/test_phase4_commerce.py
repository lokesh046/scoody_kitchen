import sys
import os

# Set dummy env vars if not present in env for unit tests
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_123456789"
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql+psycopg://pet_user:pet_password@localhost:5432/pet_platform"

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

# Ensure chatbot-service is in sys.path
service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

from main import app

client = TestClient(app)


def test_commerce_agent_read_tool_order_status():
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

    with patch("agents.commerce_agent.mcp_client.get_mcp_tools", return_value=[mock_tool]):
        response = client.post(
            "/chat",
            json={
                "message": "What is the status of my order #101?",
                "session_id": "test_commerce_sess_01",
                "user_id": 42,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "101" in data["reply"]
        assert "processing" in data["reply"].lower()
        mock_tool.invoke.assert_called_once_with({"session_user_id": 42, "order_id": 101})


def test_commerce_agent_hitl_interrupt_confirmation_flow():
    sess_id = "test_hitl_sess_01"

    order_mock = MagicMock()
    order_mock.id = 101
    order_mock.user_id = 42
    order_mock.status.value = "cancelled"

    with patch("tools.actions.get_order_by_id", return_value=order_mock), \
         patch("tools.actions.service_cancel_order", return_value=order_mock), \
         patch("tools.actions.SessionLocal"):

        # 1. Turn 1: Customer asks to cancel order -> Triggers HITL Confirmation Required interrupt
        res1 = client.post(
            "/chat",
            json={
                "message": "I want to cancel my order #101",
                "session_id": sess_id,
                "user_id": 42,
            },
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert "CONFIRMATION REQUIRED" in data1["reply"]

        # 2. Turn 2: Customer replies "Yes, confirm" -> Action executes
        res2 = client.post(
            "/chat",
            json={
                "message": "Yes, confirm cancellation",
                "session_id": sess_id,
                "user_id": 42,
            },
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert "cancelled" in data2["reply"].lower() or "cancellation" in data2["reply"].lower()
