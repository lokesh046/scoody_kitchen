import sys
import os

# Set dummy env vars if not present in env for unit tests
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_123456789_long_key_for_sha256"
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql+psycopg://pet_user:pet_password@localhost:5432/pet_platform"

# Ensure backend and mcp-server paths are set
mcp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../pet-platform-backend"))

if mcp_dir not in sys.path:
    sys.path.insert(0, mcp_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from unittest.mock import MagicMock, patch

from tools.orders import tool_get_order_status, tool_get_order_tracking
from tools.products import tool_search_products, tool_get_product_stock
from tools.bookings import tool_get_available_slots, tool_get_my_consultations
from app.models.order import OrderStatus


def test_get_order_status_idor_protection():
    order_mock = MagicMock()
    order_mock.id = 100
    order_mock.user_id = 42  # Customer A
    order_mock.status = OrderStatus.SHIPPED
    order_mock.total_amount = 500.0
    order_mock.items = []

    with patch("tools.orders.get_order_by_id", return_value=order_mock), \
         patch("tools.orders.SessionLocal"):

        # 1. Matching session_user_id (42) -> succeeds
        res = tool_get_order_status(session_user_id=42, order_id=100)
        assert res["order_id"] == 100
        assert res["status"] == "shipped"

        # 2. Mismatched session_user_id (99) -> raises ValueError (IDOR Defense)
        with pytest.raises(ValueError, match="Access Denied"):
            tool_get_order_status(session_user_id=99, order_id=100)


def test_get_order_tracking_user_isolation():
    with patch("tools.orders.get_tracking_details", return_value={"order_id": 100, "status": "in_transit"}), \
         patch("tools.orders.SessionLocal"):

        res = tool_get_order_tracking(session_user_id=42, order_id=100)
        assert res["order_id"] == 100
        assert res["status"] == "in_transit"


def test_search_products_tool():
    paginated_mock = MagicMock()
    paginated_mock.total = 1
    paginated_mock.page = 1

    item_mock = MagicMock()
    item_mock.id = 1
    item_mock.name = "Pet Food"
    item_mock.description = "Healthy food"
    item_mock.price = 299.0
    item_mock.category_id = 2
    item_mock.image_url = "http://example.com/img.jpg"
    item_mock.images = []
    item_mock.is_in_stock = True

    paginated_mock.items = [item_mock]

    with patch("tools.products.get_products_paginated", return_value=paginated_mock), \
         patch("tools.products.SessionLocal"):

        res = tool_search_products(search="Food")
        assert res["total"] == 1
        assert res["products"][0]["name"] == "Pet Food"


def test_get_product_stock_tool():
    prod_mock = MagicMock()
    prod_mock.name = "Dog Toy"
    inv_mock = MagicMock()
    inv_mock.stock_quantity = 50
    inv_mock.reserved_quantity = 5

    with patch("tools.products.get_product", return_value=prod_mock), \
         patch("tools.products.get_product_inventory", return_value=inv_mock), \
         patch("tools.products.get_available_stock", return_value=45), \
         patch("tools.products.is_low_stock", return_value=False), \
         patch("tools.products.SessionLocal"):

        res = tool_get_product_stock(product_id=10)
        assert res["product_id"] == 10
        assert res["available_stock"] == 45
        assert res["is_in_stock"] is True


def test_get_available_slots_and_my_consultations():
    slot_mock = MagicMock()
    slot_mock.id = 1
    slot_mock.doctor_id = 5
    slot_mock.doctor.name = "Dr. Smith"
    slot_mock.day_of_week = "monday"
    slot_mock.start_time = "10:00:00"
    slot_mock.end_time = "10:30:00"
    slot_mock.is_available = True

    consultation_mock = MagicMock()
    consultation_mock.id = 20
    consultation_mock.customer_id = 42
    consultation_mock.doctor_id = 5
    consultation_mock.pet_id = 2
    consultation_mock.status = "scheduled"
    consultation_mock.scheduled_at = "2026-08-18 10:00:00"
    consultation_mock.reason = "Checkup"
    consultation_mock.customer_notes = "Regular checkup"

    db_mock = MagicMock()
    db_mock.scalars.return_value.all.side_effect = [[slot_mock], [consultation_mock]]

    with patch("tools.bookings.SessionLocal", return_value=db_mock):
        slots = tool_get_available_slots(doctor_id=5)
        assert len(slots) == 1
        assert slots[0]["doctor_name"] == "Dr. Smith"

        consultations = tool_get_my_consultations(session_user_id=42)
        assert len(consultations) == 1
        assert consultations[0]["customer_id"] == 42
