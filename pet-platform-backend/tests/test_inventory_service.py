import pytest
import threading
from decimal import Decimal
from unittest.mock import MagicMock

from app.models.inventory import Inventory
from app.models.product import Product
from app.services.inventory_service import (
    check_stock,
    finalize_stock,
    get_available_stock,
    is_low_stock,
    release_stock,
    reserve_stock,
)


def test_get_available_stock_success():
    inv = Inventory(product_id=1, stock_quantity=50, reserved_quantity=15)
    assert get_available_stock(inv) == 35


def test_get_available_stock_inconsistent_state():
    inv = Inventory(product_id=1, stock_quantity=10, reserved_quantity=15)
    with pytest.raises(ValueError) as exc_info:
        get_available_stock(inv)
    assert "reserved quantity (15) exceeds physical stock (10)" in str(exc_info.value)


def test_check_stock_invalid_quantity():
    db = MagicMock()
    with pytest.raises(ValueError) as exc_info:
        check_stock(db, product_id=1, quantity=0)
    assert "Quantity must be greater than 0" in str(exc_info.value)

    with pytest.raises(ValueError) as exc_info:
        check_stock(db, product_id=1, quantity=-5)
    assert "Quantity must be greater than 0" in str(exc_info.value)


def test_check_stock_nonexistent_product():
    db = MagicMock()
    db.get.return_value = None
    with pytest.raises(ValueError) as exc_info:
        check_stock(db, product_id=999, quantity=2)
    assert "Product 999 not found" in str(exc_info.value)


def test_check_stock_inactive_product():
    db = MagicMock()
    mock_prod = MagicMock()
    mock_prod.name = "Dog Leash"
    mock_prod.is_active = False
    db.get.return_value = mock_prod
    with pytest.raises(ValueError) as exc_info:
        check_stock(db, product_id=1, quantity=2)
    assert "Product 'Dog Leash' is no longer available" in str(exc_info.value)


def test_check_stock_insufficient_stock():
    db = MagicMock()
    mock_prod = MagicMock()
    mock_prod.name = "Dog Leash"
    mock_prod.is_active = True
    db.get.return_value = mock_prod
    inv = Inventory(product_id=1, stock_quantity=10, reserved_quantity=8)
    db.scalar.return_value = inv

    with pytest.raises(ValueError) as exc_info:
        check_stock(db, product_id=1, quantity=5)
    assert "Insufficient stock for 'Dog Leash'" in str(exc_info.value)


def test_reserve_stock_success():
    db = MagicMock()
    db.get.return_value = MagicMock(is_active=True, name="Dog Toy")
    inv = Inventory(product_id=1, stock_quantity=50, reserved_quantity=0)
    db.scalar.return_value = inv

    res = reserve_stock(db, product_id=1, quantity=10)
    assert res.reserved_quantity == 10
    assert get_available_stock(res) == 40


def test_reserve_stock_exceeding_physical_stock():
    db = MagicMock()
    db.get.return_value = MagicMock(is_active=True, name="Dog Toy")
    inv = Inventory(product_id=1, stock_quantity=10, reserved_quantity=5)
    db.scalar.return_value = inv

    with pytest.raises(ValueError) as exc_info:
        reserve_stock(db, product_id=1, quantity=6)
    assert "Insufficient stock" in str(exc_info.value)


def test_release_stock_success():
    db = MagicMock()
    inv = Inventory(product_id=1, stock_quantity=50, reserved_quantity=10)
    db.scalar.return_value = inv

    res = release_stock(db, product_id=1, quantity=5)
    assert res.reserved_quantity == 5
    assert get_available_stock(res) == 45


def test_release_stock_more_than_reserved():
    db = MagicMock()
    inv = Inventory(product_id=1, stock_quantity=50, reserved_quantity=5)
    db.scalar.return_value = inv

    with pytest.raises(ValueError) as exc_info:
        release_stock(db, product_id=1, quantity=10)
    assert "Cannot release 10 reserved stock" in str(exc_info.value)


def test_release_stock_invalid_quantity():
    db = MagicMock()
    with pytest.raises(ValueError) as exc_info:
        release_stock(db, product_id=1, quantity=0)
    assert "Quantity to release must be greater than 0" in str(exc_info.value)


def test_finalize_stock_success():
    db = MagicMock()
    inv = Inventory(product_id=1, stock_quantity=50, reserved_quantity=10)
    db.scalar.return_value = inv

    res = finalize_stock(db, product_id=1, quantity=10)
    assert res.stock_quantity == 40
    assert res.reserved_quantity == 0
    assert get_available_stock(res) == 40


def test_finalize_stock_insufficient_reserved():
    db = MagicMock()
    inv = Inventory(product_id=1, stock_quantity=50, reserved_quantity=5)
    db.scalar.return_value = inv

    with pytest.raises(ValueError) as exc_info:
        finalize_stock(db, product_id=1, quantity=10)
    assert "Cannot finalize 10 stock" in str(exc_info.value)


def test_is_low_stock():
    inv_low = Inventory(product_id=1, stock_quantity=10, reserved_quantity=6, low_stock_threshold=5)
    assert is_low_stock(inv_low) is True

    inv_ok = Inventory(product_id=1, stock_quantity=50, reserved_quantity=0, low_stock_threshold=5)
    assert is_low_stock(inv_ok) is False


def test_concurrent_reserve_simulation():
    # Simulates concurrent reservation logic with simulated lock
    class ThreadSafeInventory:
        def __init__(self, stock):
            self.stock_quantity = stock
            self.reserved_quantity = 0
            self.lock = threading.Lock()

        def reserve(self, qty):
            with self.lock:
                available = self.stock_quantity - self.reserved_quantity
                if available < qty:
                    raise ValueError("Insufficient stock")
                self.reserved_quantity += qty
                return True

    inv = ThreadSafeInventory(stock=10)
    results = []

    def client_attempt(qty):
        try:
            inv.reserve(qty)
            results.append("SUCCESS")
        except ValueError:
            results.append("FAILED")

    t1 = threading.Thread(target=client_attempt, args=(7,))
    t2 = threading.Thread(target=client_attempt, args=(5,))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # One attempt must succeed, one must fail
    assert results.count("SUCCESS") == 1
    assert results.count("FAILED") == 1
    assert inv.reserved_quantity <= inv.stock_quantity


def test_variant_stock_check_reserve_release_finalize():
    db = MagicMock()
    mock_prod = MagicMock()
    mock_prod.id = 10
    mock_prod.name = "Chicken Stew"
    mock_prod.is_active = True
    mock_prod.weight_options = [
        {"weight": "500g", "price": 350, "stock": 10, "reserved": 0},
        {"weight": "1kg", "price": 650, "stock": 5, "reserved": 0},
    ]
    inv = Inventory(product_id=10, stock_quantity=15, reserved_quantity=0)
    db.get.side_effect = lambda model, id_: mock_prod if model == Product else inv
    db.scalar.return_value = inv

    # Reserve 2 pouches of 500g
    reserve_stock(db, product_id=10, quantity=2, selected_weight="500g")
    assert mock_prod.weight_options[0]["reserved"] == 2
    assert inv.reserved_quantity == 2

    # Attempting to reserve 9 more 500g should fail (only 8 available: 10 - 2)
    with pytest.raises(ValueError) as exc:
        check_stock(db, product_id=10, quantity=9, selected_weight="500g")
    assert "Insufficient stock for 'Chicken Stew (500g)'" in str(exc.value)

    # Releasing 1 pouch of 500g
    release_stock(db, product_id=10, quantity=1, selected_weight="500g")
    assert mock_prod.weight_options[0]["reserved"] == 1
    assert inv.reserved_quantity == 1

    # Finalizing 1 pouch of 500g
    finalize_stock(db, product_id=10, quantity=1, selected_weight="500g")
    assert mock_prod.weight_options[0]["stock"] == 9
    assert mock_prod.weight_options[0]["reserved"] == 0
    assert inv.stock_quantity == 14
    assert inv.reserved_quantity == 0

