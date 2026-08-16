import io
from decimal import Decimal
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import UserRole
from app.models.product import Product, ProductImage
from app.models.user import User
from app.schemas.product import ProductImageResponse, ProductResponse


def test_product_image_model_and_relationship():
    product = Product(
        id=1,
        category_id=1,
        name="Scooby Dog Kibble 10kg",
        price=Decimal("1200.00"),
        is_active=True,
    )
    img1 = ProductImage(
        id=10,
        product_id=1,
        image_url="https://res.cloudinary.com/scooby/image/upload/front.jpg",
        display_order=0,
    )
    img2 = ProductImage(
        id=11,
        product_id=1,
        image_url="https://res.cloudinary.com/scooby/image/upload/back.jpg",
        display_order=1,
    )
    product.images = [img1, img2]

    assert len(product.images) == 2
    assert product.images[0].image_url == "https://res.cloudinary.com/scooby/image/upload/front.jpg"
    assert product.images[1].display_order == 1


def test_product_response_schema_with_gallery_images():
    img_resp1 = ProductImageResponse(
        id=1,
        product_id=10,
        image_url="https://res.cloudinary.com/scooby/image/upload/1.jpg",
        display_order=0,
    )
    img_resp2 = ProductImageResponse(
        id=2,
        product_id=10,
        image_url="https://res.cloudinary.com/scooby/image/upload/2.jpg",
        display_order=1,
    )

    product_resp = ProductResponse(
        id=10,
        category_id=2,
        name="Pet Shampoo 500ml",
        description="Organic Neem & Aloe",
        sku="SHAMPOO-001",
        price=Decimal("399.00"),
        image_url="https://res.cloudinary.com/scooby/image/upload/1.jpg",
        is_active=True,
        created_at="2026-08-16T12:00:00Z",
        updated_at="2026-08-16T12:00:00Z",
        images=[img_resp1, img_resp2],
    )

    assert len(product_resp.images) == 2
    assert product_resp.images[0].id == 1
    assert product_resp.images[1].image_url == "https://res.cloudinary.com/scooby/image/upload/2.jpg"


@patch("app.api.product.get_storage_provider")
@patch("app.api.product.get_product")
def test_upload_product_gallery_images_endpoint(mock_get_product, mock_get_storage_provider):
    mock_storage = MagicMock()
    mock_storage.upload_image.side_effect = [
        "https://res.cloudinary.com/scooby/image/upload/img1.jpg",
        "https://res.cloudinary.com/scooby/image/upload/img2.jpg",
    ]
    mock_get_storage_provider.return_value = mock_storage

    admin_user = User(id=1, email="admin@scooby.com", role=UserRole.ADMIN, auth_provider="magic_link")
    
    from datetime import datetime

    dummy_product = Product(
        id=100,
        category_id=1,
        name="Dog Leash",
        description="Heavy Duty",
        sku="LEASH-001",
        price=Decimal("250.00"),
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        images=[],
    )
    mock_get_product.return_value = dummy_product

    # Mock dependencies in FastAPI app
    app.dependency_overrides = {}
    from app.dependencies.auth import get_current_user
    from app.core.database import get_db

    mock_db = MagicMock()

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: admin_user

    client = TestClient(app)

    jpeg_header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"0" * 50
    files = [
        ("images", ("photo1.jpg", io.BytesIO(jpeg_header), "image/jpeg")),
        ("images", ("photo2.jpg", io.BytesIO(jpeg_header), "image/jpeg")),
    ]

    response = client.post("/product/100/gallery", files=files)
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 100
    assert len(data["images"]) == 2
    assert data["image_url"] == "https://res.cloudinary.com/scooby/image/upload/img1.jpg"
