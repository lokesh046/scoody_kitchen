import sys
import os
import pytest
from unittest.mock import MagicMock, patch

# Set dummy env vars if not present in env for unit tests
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_123456789"
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql+psycopg://pet_user:pet_password@localhost:5432/pet_platform"

# Ensure backend and mcp-server paths are set
mcp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../pet-platform-backend"))

if mcp_dir not in sys.path:
    sys.path.insert(0, mcp_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from tools.actions import (
    tool_book_consultation,
    tool_cancel_order,
    tool_cancel_consultation,
)
from app.models.order import OrderStatus
from app.models.enums import ConsultationStatus


def test_book_consultation_action_and_idempotency():
    consultation_mock = MagicMock()
    consultation_mock.id = 501
    consultation_mock.customer_id = 42
    consultation_mock.doctor_id = 5
    consultation_mock.pet_id = 2
    consultation_mock.scheduled_at = "2026-08-20 10:00:00+00:00"
    consultation_mock.status = ConsultationStatus.PENDING

    key = "idem_key_book_001"

    with patch("tools.actions.create_consultation", return_value=consultation_mock) as mock_create, \
         patch("tools.actions.SessionLocal"):

        # 1. First call: executes create_consultation
        res1 = tool_book_consultation(
            session_user_id=42,
            doctor_id=5,
            pet_id=2,
            scheduled_at_iso="2026-08-20T10:00:00Z",
            reason="Vaccination",
            idempotency_key=key,
        )
        assert res1["status"] == "success"
        assert res1["consultation_id"] == 501
        assert mock_create.call_count == 1

        # 2. Second call with SAME idempotency key: returns cached result without re-executing create_consultation
        res2 = tool_book_consultation(
            session_user_id=42,
            doctor_id=5,
            pet_id=2,
            scheduled_at_iso="2026-08-20T10:00:00Z",
            reason="Vaccination",
            idempotency_key=key,
        )
        assert res2["status"] == "success"
        assert res2["consultation_id"] == 501
        assert mock_create.call_count == 1  # Not called again!


def test_cancel_order_action_and_idor_protection():
    order_mock = MagicMock()
    order_mock.id = 200
    order_mock.user_id = 42  # Owner is User #42
    order_mock.status = OrderStatus.PROCESSING

    cancelled_mock = MagicMock()
    cancelled_mock.id = 200
    cancelled_mock.status = OrderStatus.CANCELLED

    with patch("tools.actions.get_order_by_id", return_value=order_mock), \
         patch("tools.actions.service_cancel_order", return_value=cancelled_mock) as mock_cancel, \
         patch("tools.actions.SessionLocal"):

        # 1. Non-owner (User #99) tries to cancel -> IDOR Protection throws ValueError
        res_idor = tool_cancel_order(
            session_user_id=99,
            order_id=200,
            idempotency_key="idem_cancel_err_001",
        )
        assert res_idor["status"] == "error"
        assert "Access Denied" in res_idor["error"]
        assert mock_cancel.call_count == 0

        # 2. Legitimate owner (User #42) cancels -> succeeds
        res_ok = tool_cancel_order(
            session_user_id=42,
            order_id=200,
            idempotency_key="idem_cancel_ok_001",
        )
        assert res_ok["status"] == "success"
        assert res_ok["order_status"] == "cancelled"
        assert mock_cancel.call_count == 1


def test_cancel_consultation_action_and_idempotency():
    c_mock = MagicMock()
    c_mock.id = 300
    c_mock.customer_id = 42  # Customer is User #42

    updated_mock = MagicMock()
    updated_mock.id = 300
    updated_mock.status = ConsultationStatus.CANCELLED

    key = "idem_cancel_c_001"

    with patch("tools.actions.get_consultation_by_id", return_value=c_mock), \
         patch("tools.actions.update_consultation_status", return_value=updated_mock) as mock_update, \
         patch("tools.actions.SessionLocal"):

        # 1. Customer #42 cancels consultation -> succeeds
        res1 = tool_cancel_consultation(
            session_user_id=42,
            consultation_id=300,
            idempotency_key=key,
        )
        assert res1["status"] == "success"
        assert res1["consultation_status"] == "cancelled"
        assert mock_update.call_count == 1

        # 2. Duplicate call with SAME idempotency key -> returns cached result
        res2 = tool_cancel_consultation(
            session_user_id=42,
            consultation_id=300,
            idempotency_key=key,
        )
        assert res2["status"] == "success"
        assert mock_update.call_count == 1  # Not called again!
