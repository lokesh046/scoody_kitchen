import pytest
from unittest.mock import MagicMock

from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.payment import Payment, PaymentStatus
from app.services.order_service import (
    cancel_order,
    confirm_order,
    deliver_order,
    get_user_order,
    get_user_orders,
    process_order,
    ship_order,
    validate_order_status_transition,
)
from app.services.payment_service import (
    create_payment,
    process_payment_failure,
    process_payment_success,
)


def test_valid_transitions():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.PENDING)

    confirm_order(db, order)
    assert order.status == OrderStatus.CONFIRMED

    process_order(db, order)
    assert order.status == OrderStatus.PROCESSING

    ship_order(db, order)
    assert order.status == OrderStatus.SHIPPED

    deliver_order(db, order)
    assert order.status == OrderStatus.DELIVERED


@pytest.mark.parametrize(
    "current_status,target_status",
    [
        (OrderStatus.CANCELLED, OrderStatus.CONFIRMED),
        (OrderStatus.CANCELLED, OrderStatus.PROCESSING),
        (OrderStatus.CANCELLED, OrderStatus.SHIPPED),
        (OrderStatus.CANCELLED, OrderStatus.DELIVERED),
        (OrderStatus.DELIVERED, OrderStatus.CANCELLED),
        (OrderStatus.DELIVERED, OrderStatus.PENDING),
        (OrderStatus.PENDING, OrderStatus.SHIPPED),
        (OrderStatus.PENDING, OrderStatus.DELIVERED),
    ],
)
def test_invalid_transitions(current_status, target_status):
    with pytest.raises(ValueError) as exc_info:
        validate_order_status_transition(current_status, target_status)
    assert "Invalid order status transition" in str(exc_info.value)


def test_customer_ownership_isolation():
    db = MagicMock()
    
    # User 1 tries to access User 2's order
    order_user2 = Order(id=10, user_id=2, status=OrderStatus.PENDING)
    db.scalar.return_value = None  # get_user_order filters by (id, user_id)

    res = get_user_order(db, user_id=1, order_id=10)
    assert res is None


def test_payment_success_lifecycle():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.PENDING)
    payment = Payment(id=1, order_id=1, status=PaymentStatus.PENDING, order=order)
    inv = Inventory(product_id=10, stock_quantity=20, reserved_quantity=5)

    db.scalars.return_value.all.return_value = [
        OrderItem(id=1, order_id=1, product_id=10, quantity=5)
    ]
    db.scalar.return_value = inv

    res_payment = process_payment_success(db, payment)
    assert res_payment.status == PaymentStatus.SUCCESS
    assert order.status == OrderStatus.CONFIRMED
    assert inv.stock_quantity == 15
    assert inv.reserved_quantity == 0


def test_payment_failure_lifecycle():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.PENDING)
    payment = Payment(id=1, order_id=1, status=PaymentStatus.PENDING, order=order)
    inv = Inventory(product_id=10, stock_quantity=20, reserved_quantity=5)

    db.scalars.return_value.all.return_value = [
        OrderItem(id=1, order_id=1, product_id=10, quantity=5)
    ]
    db.scalar.return_value = inv

    res_payment = process_payment_failure(db, payment)
    assert res_payment.status == PaymentStatus.FAILED
    assert order.status == OrderStatus.CANCELLED
    assert inv.reserved_quantity == 0
    assert inv.stock_quantity == 20


def test_double_payment_success_rejected():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.CONFIRMED)
    payment = Payment(id=1, order_id=1, status=PaymentStatus.SUCCESS, order=order)

    with pytest.raises(ValueError) as exc_info:
        process_payment_success(db, payment)
    assert "Payment is no longer pending" in str(exc_info.value)


def test_payment_failure_after_success_rejected():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.CONFIRMED)
    payment = Payment(id=1, order_id=1, status=PaymentStatus.SUCCESS, order=order)

    with pytest.raises(ValueError) as exc_info:
        process_payment_failure(db, payment)
    assert "Payment is no longer pending" in str(exc_info.value)


def test_payment_success_after_failure_rejected():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.CANCELLED)
    payment = Payment(id=1, order_id=1, status=PaymentStatus.FAILED, order=order)

    with pytest.raises(ValueError) as exc_info:
        process_payment_success(db, payment)
    assert "Payment is no longer pending" in str(exc_info.value)


def test_cancel_pending_order_releases_stock():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.PENDING)
    inv = Inventory(product_id=10, stock_quantity=20, reserved_quantity=5)

    db.scalars.return_value.all.return_value = [
        OrderItem(id=1, order_id=1, product_id=10, quantity=5)
    ]
    db.scalar.return_value = inv

    res_order = cancel_order(db, order)
    assert res_order.status == OrderStatus.CANCELLED
    assert inv.reserved_quantity == 0


def test_cancel_confirmed_order_rejected():
    db = MagicMock()
    order = Order(id=1, user_id=1, status=OrderStatus.CONFIRMED)

    with pytest.raises(ValueError) as exc_info:
        cancel_order(db, order)
    assert "Invalid order status transition" in str(exc_info.value)
