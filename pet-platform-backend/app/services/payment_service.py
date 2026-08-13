import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.payment import Payment, PaymentStatus


def create_payment(
    db: Session,
    order: Order,
    payment_method: str,
) -> Payment:

    if order.status != OrderStatus.PENDING:
        raise ValueError(
            "Payment can only be created for a pending order"
        )

    existing_payment = db.scalar(
        select(Payment).where(
            Payment.order_id == order.id
        )
    )

    if existing_payment is not None:
        raise ValueError(
            "Payment already exists for this order"
        )

    payment = Payment(
        order_id=order.id,
        amount=order.total_amount,
        status=PaymentStatus.PENDING,
        payment_method=payment_method,
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    return payment



def process_payment_success(
    db: Session,
    payment: Payment,
) -> Payment:

    if payment.status != PaymentStatus.PENDING:
        raise ValueError(
            "Payment is no longer pending"
        )

    order = payment.order

    if order.status != OrderStatus.PENDING:
        raise ValueError(
            "Order is no longer pending"
        )

    order_items = list(
        db.scalars(
            select(OrderItem).where(
                OrderItem.order_id == order.id
            )
        ).all()
    )

    for order_item in order_items:

        inventory = db.scalar(
            select(Inventory)
            .where(
                Inventory.product_id
                == order_item.product_id
            )
            .with_for_update()
        )

        if inventory is None:
            raise ValueError(
                f"Inventory not found for product "
                f"{order_item.product_id}"
            )

        if (
            inventory.reserved_quantity
            < order_item.quantity
        ):
            raise ValueError(
                "Reserved inventory is insufficient"
            )

        inventory.stock_quantity -= (
            order_item.quantity
        )

        inventory.reserved_quantity -= (
            order_item.quantity
        )

    payment.status = PaymentStatus.SUCCESS

    payment.transaction_id = (
        f"TXN-{uuid.uuid4().hex[:16].upper()}"
    )

    order.status = OrderStatus.CONFIRMED

    db.commit()
    db.refresh(payment)

    return payment


def process_payment_failure(
    db: Session,
    payment: Payment,
) -> Payment:

    if payment.status != PaymentStatus.PENDING:
        raise ValueError(
            "Payment is no longer pending"
        )

    order = payment.order

    order_items = list(
        db.scalars(
            select(OrderItem).where(
                OrderItem.order_id == order.id
            )
        ).all()
    )

    for order_item in order_items:

        inventory = db.scalar(
            select(Inventory)
            .where(
                Inventory.product_id
                == order_item.product_id
            )
            .with_for_update()
        )

        if inventory is not None:

            inventory.reserved_quantity -= (
                order_item.quantity
            )

    payment.status = PaymentStatus.FAILED

    order.status = OrderStatus.CANCELLED

    db.commit()
    db.refresh(payment)

    return payment