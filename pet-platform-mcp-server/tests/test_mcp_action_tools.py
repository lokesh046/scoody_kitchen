import sys
import os
import pytest
from unittest.mock import patch

# Ensure mcp-server path is set
mcp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if mcp_dir not in sys.path:
    sys.path.insert(0, mcp_dir)

from tools.actions import (
    tool_book_consultation,
    tool_cancel_order,
    tool_cancel_consultation,
)


def test_book_consultation_action_and_idempotency():
    mock_res = {"status": "success", "consultation_id": 501}
    key = "idem_key_book_001"

    with patch("tools.actions.backend_post", return_value=mock_res) as mock_post:
        # 1. First call: executes backend_post
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
        assert mock_post.call_count == 1

        # 2. Second call with SAME idempotency key: returns cached result without re-executing backend_post
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
        assert mock_post.call_count == 1  # Not called again!


def test_cancel_order_action_and_idor_protection():
    mock_res = {"status": "success", "order_id": 100}
    key = "idem_key_cancel_001"

    with patch("tools.actions.backend_post", return_value=mock_res) as mock_post:
        res1 = tool_cancel_order(
            session_user_id=42,
            order_id=100,
            idempotency_key=key,
        )
        assert res1["status"] == "success"
        assert res1["order_id"] == 100
        assert mock_post.call_count == 1


def test_cancel_consultation_action_and_idempotency():
    mock_res = {"status": "success", "consultation_id": 20}
    key = "idem_key_cancel_c_001"

    with patch("tools.actions.backend_post", return_value=mock_res) as mock_post:
        res1 = tool_cancel_consultation(
            session_user_id=42,
            consultation_id=20,
            idempotency_key=key,
        )
        assert res1["status"] == "success"
        assert res1["consultation_id"] == 20
        assert mock_post.call_count == 1
