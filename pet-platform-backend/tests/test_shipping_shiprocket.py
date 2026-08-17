import anyio
import json
import pytest
from unittest.mock import MagicMock, patch

from app.models.enums import UserRole
from app.models.order import Order, OrderStatus
from app.models.shipment import Shipment
from app.shipping.factory import get_shipping_provider
from app.shipping.providers.shiprocket import ShiprocketProvider, map_shiprocket_status_to_internal


def test_shiprocket_status_mappings():
    assert map_shiprocket_status_to_internal("AWB ASSIGNED") == ("pre_transit", OrderStatus.SHIPPED)
    assert map_shiprocket_status_to_internal("IN TRANSIT") == ("in_transit", OrderStatus.IN_TRANSIT)
    assert map_shiprocket_status_to_internal("OUT FOR DELIVERY") == ("out_for_delivery", OrderStatus.OUT_FOR_DELIVERY)
    assert map_shiprocket_status_to_internal("DELIVERED") == ("delivered", OrderStatus.DELIVERED)
    assert map_shiprocket_status_to_internal("RTO DELIVERED") == ("returned", OrderStatus.RETURNED)
    assert map_shiprocket_status_to_internal("FAILED") == ("failure", OrderStatus.DELIVERY_FAILED)
    assert map_shiprocket_status_to_internal("CANCELED") == ("canceled", OrderStatus.CANCELLED)


def test_shipping_provider_factory_switch():
    with patch("app.core.config.settings.SHIPPING_PROVIDER", "shiprocket"):
        provider = get_shipping_provider()
        assert isinstance(provider, ShiprocketProvider)

    with patch("app.core.config.settings.SHIPPING_PROVIDER", "easypost"):
        provider = get_shipping_provider()
        assert not isinstance(provider, ShiprocketProvider)


def test_shiprocket_provider_test_codes():
    provider = ShiprocketProvider()
    res = anyio.run(provider.create_tracker, "SR2000000002", "Shiprocket")
    assert res["tracking_code"] == "SR2000000002"
    assert res["status"] == "in transit"


def test_shiprocket_webhook_idempotency_and_status_progression():
    from app.services.shipping_service import process_shiprocket_webhook

    db = MagicMock()
    db.scalar.return_value = None  # No existing processed event

    order = Order(id=10, user_id=1, status=OrderStatus.SHIPPED, status_history=[])
    shipment = Shipment(
        id=1,
        order_id=10,
        provider="shiprocket",
        provider_tracker_id="sr_trk_SR2000000002",
        tracking_number="SR2000000002",
        carrier="Shiprocket",
        status="pre_transit",
        order=order,
    )
    db.scalars.return_value.first.return_value = shipment

    webhook_payload = {
        "event_id": "evt_sr_unique_001",
        "awb": "SR2000000002",
        "current_status": "IN TRANSIT",
    }

    with patch("app.core.config.settings.SHIPROCKET_WEBHOOK_TOKEN", "valid_token_123"):
        # First call: process event
        res1 = process_shiprocket_webhook(db, "valid_token_123", webhook_payload)
        assert res1["status"] == "processed"
        assert shipment.status == "in_transit"
        assert order.status == OrderStatus.IN_TRANSIT

        # Second call with same event ID: return already_processed
        db.scalar.return_value = MagicMock()  # Event now exists
        res2 = process_shiprocket_webhook(db, "valid_token_123", webhook_payload)
        assert res2["status"] == "already_processed"


def test_shiprocket_webhook_fails_closed_when_token_missing():
    from app.services.shipping_service import process_shiprocket_webhook

    db = MagicMock()
    webhook_payload = {"awb": "SR2000000002", "current_status": "IN TRANSIT"}

    with patch("app.core.config.settings.SHIPROCKET_WEBHOOK_TOKEN", None):
        with pytest.raises(ValueError, match="Shiprocket webhook verification token is not configured on server"):
            process_shiprocket_webhook(db, "some_token", webhook_payload)


def test_shiprocket_webhook_token_verification():
    from app.services.shipping_service import process_shiprocket_webhook

    token = "secret_shiprocket_webhook_token_123"
    webhook_payload = {"awb": "SR1000000001", "current_status": "DELIVERED"}

    with patch("app.core.config.settings.SHIPROCKET_WEBHOOK_TOKEN", token):
        # Invalid token header raises ValueError
        db = MagicMock()
        with pytest.raises(ValueError, match="Invalid Shiprocket webhook verification token"):
            process_shiprocket_webhook(db, "invalid_token", webhook_payload)

        # Valid token header succeeds
        db.scalar.return_value = None
        db.scalars.return_value.first.return_value = None
        res = process_shiprocket_webhook(db, token, webhook_payload)
        assert res["status"] == "processed"
