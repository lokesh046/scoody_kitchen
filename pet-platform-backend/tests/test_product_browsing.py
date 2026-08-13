import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from app.models.category import Category
from app.models.inventory import Inventory
from app.models.product import Product
from app.services.product_service import (
    get_product,
    get_products_paginated,
)


def test_get_products_paginated_basic():
    db = MagicMock()
    cat = Category(id=1, name="Dog Food")
    p1 = Product(id=1, category_id=1, name="Dog Kibble", description="Dry food", price=Decimal("100.00"), is_active=True, category=cat)
    p2 = Product(id=2, category_id=1, name="Dog Treats", description="Chew toys", price=Decimal("50.00"), is_active=True, category=cat)

    db.scalars.return_value.unique.return_value.all.return_value = [p1, p2]
    db.scalar.return_value = 2

    res = get_products_paginated(db, page=1, limit=20)
    assert res["total"] == 2
    assert len(res["items"]) == 2
    assert res["page"] == 1
    assert res["limit"] == 20
    assert res["pages"] == 1


def test_validation_page_and_limit():
    db = MagicMock()
    with pytest.raises(ValueError) as exc1:
        get_products_paginated(db, page=0)
    assert "Page number must be at least 1" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        get_products_paginated(db, limit=0)
    assert "Limit must be between 1 and 100" in str(exc2.value)

    with pytest.raises(ValueError) as exc3:
        get_products_paginated(db, limit=101)
    assert "Limit must be between 1 and 100" in str(exc3.value)


def test_validation_price_range():
    db = MagicMock()
    with pytest.raises(ValueError) as exc1:
        get_products_paginated(db, min_price=Decimal("-10.00"))
    assert "min_price cannot be negative" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        get_products_paginated(db, max_price=Decimal("-5.00"))
    assert "max_price cannot be negative" in str(exc2.value)

    with pytest.raises(ValueError) as exc3:
        get_products_paginated(db, min_price=Decimal("500.00"), max_price=Decimal("100.00"))
    assert "min_price cannot be greater than max_price" in str(exc3.value)


def test_validation_sort_fields():
    db = MagicMock()
    with pytest.raises(ValueError) as exc1:
        get_products_paginated(db, sort_by="invalid_column")
    assert "Invalid sort field 'invalid_column'" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        get_products_paginated(db, sort_order="side_ways")
    assert "sort_order must be 'asc' or 'desc'" in str(exc2.value)


def test_validation_category_id():
    db = MagicMock()
    with pytest.raises(ValueError) as exc:
        get_products_paginated(db, category_id=-1)
    assert "category_id must be a positive integer" in str(exc.value)


def test_customer_availability_calculation():
    db = MagicMock()
    inv = Inventory(product_id=1, stock_quantity=50, reserved_quantity=10)
    p = Product(id=1, category_id=1, name="Dog Toy", price=Decimal("20.00"), is_active=True, inventory=inv)

    db.scalars.return_value.unique.return_value.all.return_value = [p]
    db.scalar.return_value = 1

    res = get_products_paginated(db)
    item = res["items"][0]
    assert item.available_stock == 40
    assert item.is_in_stock is True


def test_out_of_stock_calculation():
    db = MagicMock()
    inv = Inventory(product_id=1, stock_quantity=10, reserved_quantity=10)
    p = Product(id=1, category_id=1, name="Dog Toy", price=Decimal("20.00"), is_active=True, inventory=inv)

    db.scalars.return_value.unique.return_value.all.return_value = [p]
    db.scalar.return_value = 1

    res = get_products_paginated(db)
    item = res["items"][0]
    assert item.available_stock == 0
    assert item.is_in_stock is False
