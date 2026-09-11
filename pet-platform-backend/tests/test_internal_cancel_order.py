import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.api.internal import internal_cancel_order
from app.models.idempotency_key import IdempotencyKey
from app.models.order import Order, OrderStatus
from sqlalchemy.exc import IntegrityError


def test_internal_cancel_order_first_claim_success():
    db = MagicMock()
    order = Order(id=10, user_id=42, status=OrderStatus.CONFIRMED)

    # Mock get_order_by_id and service_cancel_order
    with patch("app.api.internal.get_order_by_id", return_value=order), \
         patch("app.api.internal.service_cancel_order") as mock_cancel:
        
        cancelled_order = Order(id=10, user_id=42, status=OrderStatus.CANCELLED)
        mock_cancel.return_value = cancelled_order

        res = internal_cancel_order(
            order_id=10,
            acting_user_id=42,
            idempotency_key="test_key_001",
            db=db,
        )

        assert res["order_id"] == 10
        assert res["status"] == "CANCELLED"
        # Verify IdempotencyKey was added and committed
        assert db.add.called
        assert db.commit.called


def test_internal_cancel_order_pending_conflict_raises_409():
    db = MagicMock()
    order = Order(id=10, user_id=42, status=OrderStatus.CONFIRMED)

    # Simulate IntegrityError on db.flush() during claim
    db.flush.side_effect = IntegrityError("duplicate key", params=None, orig=None)

    # The existing key is currently PENDING
    existing_key = IdempotencyKey(key="test_key_pending", user_id=42, response="PENDING")
    db.scalar.return_value = existing_key

    with patch("app.api.internal.get_order_by_id", return_value=order), \
         patch("app.api.internal.service_cancel_order") as mock_cancel:

        with pytest.raises(HTTPException) as exc_info:
            internal_cancel_order(
                order_id=10,
                acting_user_id=42,
                idempotency_key="test_key_pending",
                db=db,
            )

        assert exc_info.value.status_code == 409
        assert "currently being processed" in exc_info.value.detail
        # Ensure service_cancel_order was NEVER called!
        assert not mock_cancel.called


def test_internal_cancel_order_completed_key_returns_cached():
    db = MagicMock()
    order = Order(id=10, user_id=42, status=OrderStatus.CONFIRMED)

    # Simulate IntegrityError on db.flush() during claim
    db.flush.side_effect = IntegrityError("duplicate key", params=None, orig=None)

    # The existing key was already completed in the past
    cached_payload = json.dumps({"order_id": 10, "status": "CANCELLED"})
    existing_key = IdempotencyKey(key="test_key_done", user_id=42, response=cached_payload)
    db.scalar.return_value = existing_key

    with patch("app.api.internal.get_order_by_id", return_value=order), \
         patch("app.api.internal.service_cancel_order") as mock_cancel:

        res = internal_cancel_order(
            order_id=10,
            acting_user_id=42,
            idempotency_key="test_key_done",
            db=db,
        )

        assert res["order_id"] == 10
        assert res["status"] == "CANCELLED"
        # Ensure service_cancel_order was NEVER called!
        assert not mock_cancel.called
