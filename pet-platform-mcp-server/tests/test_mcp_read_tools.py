import sys
import os
import pytest
from unittest.mock import patch

# Ensure mcp-server path is set
mcp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if mcp_dir not in sys.path:
    sys.path.insert(0, mcp_dir)

from tools.orders import tool_get_order_status, tool_get_order_tracking
from tools.products import tool_search_products, tool_get_product_stock
from tools.bookings import tool_get_available_slots, tool_get_my_consultations


def test_get_order_status_idor_protection():
    mock_order = {"order_id": 100, "status": "shipped", "total_amount": 500.0}
    with patch("tools.orders.backend_get", return_value=mock_order) as mock_get:
        res = tool_get_order_status(session_user_id=42, order_id=100)
        assert res["order_id"] == 100
        assert res["status"] == "shipped"
        mock_get.assert_called_once_with("/internal/orders/100", params={"acting_user_id": 42})


def test_get_order_tracking_user_isolation():
    mock_tracking = {"order_id": 100, "status": "in_transit"}
    with patch("tools.orders.backend_get", return_value=mock_tracking) as mock_get:
        res = tool_get_order_tracking(session_user_id=42, order_id=100)
        assert res["order_id"] == 100
        assert res["status"] == "in_transit"
        mock_get.assert_called_once_with("/internal/orders/100/tracking", params={"acting_user_id": 42})


def test_search_products_tool():
    mock_products = {"total": 1, "products": [{"name": "Pet Food"}]}
    with patch("tools.products.backend_get", return_value=mock_products) as mock_get:
        res = tool_search_products(search="Food")
        assert res["total"] == 1
        assert res["products"][0]["name"] == "Pet Food"
        mock_get.assert_called_once_with("/internal/products/search", params={"search": "Food", "category_id": None, "limit": 10})


def test_get_product_stock_tool():
    mock_stock = {"product_id": 10, "available_stock": 45, "is_in_stock": True}
    with patch("tools.products.backend_get", return_value=mock_stock) as mock_get:
        res = tool_get_product_stock(product_id=10)
        assert res["product_id"] == 10
        assert res["available_stock"] == 45
        assert res["is_in_stock"] is True
        mock_get.assert_called_once_with("/internal/products/10/stock")


def test_get_available_slots_and_my_consultations():
    mock_slots = [{"doctor_name": "Dr. Smith"}]
    mock_consultations = [{"customer_id": 42}]

    with patch("tools.bookings.backend_get") as mock_get:
        mock_get.side_effect = [mock_slots, mock_consultations]

        slots = tool_get_available_slots(doctor_id=5)
        assert len(slots) == 1
        assert slots[0]["doctor_name"] == "Dr. Smith"
        mock_get.assert_any_call("/internal/bookings/available-slots", params={"doctor_id": 5})

        consultations = tool_get_my_consultations(session_user_id=42)
        assert len(consultations) == 1
        assert consultations[0]["customer_id"] == 42
        mock_get.assert_any_call("/internal/bookings/my-consultations", params={"acting_user_id": 42})
