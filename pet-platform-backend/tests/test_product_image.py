import io
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import UserRole
from app.models.product import Product
from app.schemas.cart import CartItemResponse
from app.schemas.order import OrderItemResponse
from app.services.storage_service import validate_image_file, generate_unique_storage_key
from fastapi import HTTPException


def test_validate_image_file_valid_jpeg():
    # Valid JPEG magic bytes header \xff\xd8\xff
    valid_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"0" * 50
    class DummyFile:
        content_type = "image/jpeg"

    # Should pass without raising exception
    validate_image_file(DummyFile(), valid_bytes)


def test_validate_image_file_invalid_type():
    dummy_bytes = b"Hello executable code"
    class DummyFile:
        content_type = "application/x-msdownload"

    with pytest.raises(HTTPException) as exc_info:
        validate_image_file(DummyFile(), dummy_bytes)
    assert exc_info.value.status_code == 400
    assert "Unsupported file type" in exc_info.value.detail


def test_validate_image_file_oversized():
    dummy_bytes = b"\xff\xd8\xff" + b"0" * (6 * 1024 * 1024)
    class DummyFile:
        content_type = "image/jpeg"

    with pytest.raises(HTTPException) as exc_info:
        validate_image_file(DummyFile(), dummy_bytes, max_size=5 * 1024 * 1024)
    assert exc_info.value.status_code == 400
    assert "File size exceeds" in exc_info.value.detail


def test_validate_image_file_magic_bytes_mismatch():
    # Content-type says image/png but header is plain text
    dummy_bytes = b"NOT_A_PNG_HEADER"
    class DummyFile:
        content_type = "image/png"

    with pytest.raises(HTTPException) as exc_info:
        validate_image_file(DummyFile(), dummy_bytes)
    assert exc_info.value.status_code == 400
    assert "File content does not match" in exc_info.value.detail


def test_generate_unique_storage_key():
    key1 = generate_unique_storage_key("dog.jpg")
    key2 = generate_unique_storage_key("dog.jpg")
    assert key1.startswith("products/")
    assert key1.endswith(".jpg")
    assert key1 != key2


def test_cart_item_response_schema():
    cart_item = CartItemResponse(
        id=1,
        product_id=10,
        name="Dog Chews",
        description="Organic",
        price=Decimal("15.99"),
        quantity=3,
        subtotal=Decimal("47.97"),
        image_url="http://127.0.0.1:8000/uploads/products/chews.jpg",
        created_at="2026-08-13T12:00:00Z",
        updated_at="2026-08-13T12:00:00Z",
    )
    assert cart_item.image_url == "http://127.0.0.1:8000/uploads/products/chews.jpg"


def test_order_item_response_schema():
    order_item = OrderItemResponse(
        id=100,
        product_id=10,
        quantity=2,
        unit_price=Decimal("15.99"),
        subtotal=Decimal("31.98"),
        image_url="http://127.0.0.1:8000/uploads/products/chews.jpg",
    )
    assert order_item.image_url == "http://127.0.0.1:8000/uploads/products/chews.jpg"
