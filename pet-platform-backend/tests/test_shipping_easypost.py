import hmac
import hashlib
import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import UserRole
from app.models.order import Order, OrderStatus
from app.models.order_status_history import OrderStatusHistory
from app.models.shipment import Shipment
from app.models.user import User
from app.dependencies.auth import get_current_user
from app.shipping.providers.easypost import EasyPostProvider, map_easypost_status_to_internal

client = TestClient(app)


def test_easypost_status_mappings():
    assert map_easypost_status_to_internal("pre_transit") == ("pre_transit", OrderStatus.SHIPPED)
    assert map_easypost_status_to_internal("in_transit") == ("in_transit", OrderStatus.IN_TRANSIT)
    assert map_easypost_status_to_internal("out_for_delivery") == ("out_for_delivery", OrderStatus.OUT_FOR_DELIVERY)
    assert map_easypost_status_to_internal("delivered") == ("delivered", OrderStatus.DELIVERED)
    assert map_easypost_status_to_internal("return_to_sender") == ("returned", OrderStatus.RETURNED)
    assert map_easypost_status_to_internal("failure") == ("failure", OrderStatus.DELIVERY_FAILED)


import anyio


def test_easypost_provider_test_codes():
    provider = EasyPostProvider()
    res = anyio.run(provider.create_tracker, "EZ2000000002", "USPS")
    assert res["tracking_code"] == "EZ2000000002"
    assert res["status"] == "in_transit"


def test_customer_tracking_isolation():
    customer_a = User(id=101, email="cust_a@test.com", role=UserRole.CUSTOMER, is_active=True)
    app.dependency_overrides[get_current_user] = lambda: customer_a

    try:
        # Customer A requesting Customer B's order tracking -> 403 Forbidden
        # (We use get_tracking_details directly to assert isolation)
        from app.services.shipping_service import get_tracking_details

        db = MagicMock()
        order_b = Order(id=999, user_id=202, status=OrderStatus.PENDING, status_history=[])
        db.scalars.return_value.unique.return_value.one_or_none.return_value = order_b

        with pytest.raises(ValueError, match="Access denied"):
            get_tracking_details(db, order_id=999, current_user=customer_a)
    finally:
        app.dependency_overrides.clear()


def test_get_tracking_details_missing_shipment():
    customer = User(id=50, email="cust50@test.com", role=UserRole.CUSTOMER, is_active=True)
    db = MagicMock()
    order = Order(id=500, user_id=50, status=OrderStatus.PENDING, shipment=None, status_history=[])
    db.scalars.return_value.unique.return_value.one_or_none.return_value = order

    from app.services.shipping_service import get_tracking_details
    tracking = get_tracking_details(db, order_id=500, current_user=customer)

    assert tracking["order_id"] == 500
    assert tracking["order_status"].lower() == "pending"
    assert tracking["shipment"] is None
    assert isinstance(tracking["timeline"], list)


def test_webhook_idempotency_and_status_progression():
    from app.services.shipping_service import process_easypost_webhook

    db = MagicMock()
    db.scalar.return_value = None  # No existing processed event

    order = Order(id=10, user_id=1, status=OrderStatus.SHIPPED, status_history=[])
    shipment = Shipment(
        id=1,
        order_id=10,
        provider="easypost",
        provider_tracker_id="trk_test_123",
        tracking_number="EZ2000000002",
        carrier="USPS",
        status="pre_transit",
        order=order,
    )
    db.scalars.return_value.first.return_value = shipment

    webhook_payload = {
        "id": "evt_test_unique_001",
        "event": "tracker.updated",
        "description": "tracker.updated",
        "result": {
            "id": "trk_test_123",
            "tracking_code": "EZ2000000002",
            "status": "in_transit",
        },
    }

    payload_bytes = json.dumps(webhook_payload).encode("utf-8")
    secret = "test_easypost_secret"
    valid_sig = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    with patch("app.core.config.settings.EASYPOST_WEBHOOK_SECRET", secret):
        # First call: process event
        res1 = process_easypost_webhook(db, payload_bytes, valid_sig, webhook_payload)
        assert res1["status"] == "processed"
        assert shipment.status == "in_transit"
        assert order.status == OrderStatus.IN_TRANSIT

        # Second call with same event ID: return already_processed
        db.scalar.return_value = MagicMock()  # Event now exists
        res2 = process_easypost_webhook(db, payload_bytes, valid_sig, webhook_payload)
        assert res2["status"] == "already_processed"


def test_webhook_hmac_signature_verification():
    from app.services.shipping_service import verify_easypost_hmac_signature, process_easypost_webhook
    from unittest.mock import patch

    payload = b'{"id": "evt_sig_test", "event": "tracker.updated"}'
    secret = "test_webhook_secret_key"

    valid_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    with patch("app.core.config.settings.EASYPOST_WEBHOOK_SECRET", secret):
        assert verify_easypost_hmac_signature(payload, valid_sig) is True
        assert verify_easypost_hmac_signature(payload, "invalid_signature") is False

        # Webhook handler with invalid signature should raise ValueError
        db = MagicMock()
        with pytest.raises(ValueError, match="Invalid EasyPost webhook HMAC signature"):
            process_easypost_webhook(db, payload, "invalid_sig", {"id": "evt_sig_test"})
