from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

from app.models.cart_item import CartItem
from app.models.inventory import Inventory
from app.models.product import Product
from app.services.cart_service import build_cart_item_response


def test_build_cart_item_response_with_weight_variant_stock():
    product = Product(
        id=10,
        name="Wild Salmon Feast",
        description="Fresh wild caught salmon",
        price=Decimal("450.00"),
        weight_options=[
            {"weight": "200g", "price": 200, "stock": 5, "reserved": 1},
            {"weight": "500g", "price": 450, "stock": 12, "reserved": 2},
            {"weight": "1kg", "price": 850, "stock": 3, "reserved": 3},
        ],
    )
    cart_item = CartItem(
        id=1,
        cart_id=100,
        product_id=10,
        quantity=2,
        selected_weight="500g",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    cart_item.product = product

    res = build_cart_item_response(cart_item)
    assert res.name == "Wild Salmon Feast"
    assert res.selected_weight == "500g"
    assert res.price == Decimal("450")
    # 12 stock - 2 reserved = 10 available
    assert res.available_stock == 10

    # Test out of stock variant
    cart_item.selected_weight = "1kg"
    res_oos = build_cart_item_response(cart_item)
    # 3 stock - 3 reserved = 0
    assert res_oos.available_stock == 0


def test_build_cart_item_response_with_inventory_fallback():
    product = Product(
        id=20,
        name="Herbal Dog Shampoo",
        description="Organic shampoo",
        price=Decimal("299.00"),
        weight_options=None,
    )
    product.inventory = Inventory(
        product_id=20,
        stock_quantity=15,
        reserved_quantity=4,
    )
    cart_item = CartItem(
        id=2,
        cart_id=100,
        product_id=20,
        quantity=1,
        selected_weight=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    cart_item.product = product

    res = build_cart_item_response(cart_item)
    assert res.name == "Herbal Dog Shampoo"
    assert res.price == Decimal("299.00")
    # 15 - 4 = 11
    assert res.available_stock == 11
