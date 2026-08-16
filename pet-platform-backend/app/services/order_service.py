from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.order_status_history import OrderStatusHistory
from app.schemas.order import CheckoutRequest
from app.services.inventory_service import release_stock, reserve_stock

VALID_ORDER_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PROCESSING},
    OrderStatus.PROCESSING: {OrderStatus.PACKED, OrderStatus.SHIPPED},
    OrderStatus.PACKED: {OrderStatus.SHIPPED},
    OrderStatus.SHIPPED: {OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.DELIVERY_FAILED},
    OrderStatus.IN_TRANSIT: {OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.DELIVERY_FAILED},
    OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.DELIVERY_FAILED},
    OrderStatus.DELIVERED: {OrderStatus.COMPLETED},
    OrderStatus.RETURNED: set(),
    OrderStatus.DELIVERY_FAILED: set(),
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
}


def validate_order_status_transition(
    current_status: OrderStatus,
    new_status: OrderStatus,
) -> None:
    """
    Validates whether changing an order from current_status to new_status is allowed.
    Raises ValueError with a user-friendly detail message if the transition is invalid.
    """
    allowed = VALID_ORDER_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Invalid order status transition from '{current_status.value}' to '{new_status.value}'"
        )


def change_order_status(
    db: Session,
    order: Order,
    new_status: OrderStatus,
    description: str,
) -> Order:
    if order.status != new_status:
        validate_order_status_transition(order.status, new_status)
        order.status = new_status

    history = OrderStatusHistory(
        order_id=order.id,
        status=new_status,
        description=description,
    )
    db.add(history)
    db.commit()
    db.refresh(order)
    return order


def create_order_from_cart(
    db: Session,
    user_id: int,
    checkout_data: CheckoutRequest,
) -> Order:
    cart_statement = (
        select(Cart)
        .options(
            joinedload(Cart.items)
            .joinedload(CartItem.product)
        )
        .where(Cart.user_id == user_id)
    )

    cart = (
        db.execute(cart_statement)
        .unique()
        .scalar_one_or_none()
    )

    if cart is None:
        raise ValueError("Cart not found")

    if not cart.items:
        raise ValueError("Cart is empty")

    total_amount = Decimal("0.00")
    order_items_data = []

    for cart_item in cart.items:
        product = cart_item.product
        if product is None:
            raise ValueError(f"Product {cart_item.product_id} not found")

        if not product.is_active:
            raise ValueError(f"Product '{product.name}' is no longer available")

        inventory = reserve_stock(
            db,
            product.id,
            cart_item.quantity,
        )

        subtotal = product.price * cart_item.quantity
        total_amount += subtotal

        order_items_data.append(
            {
                "product": product,
                "inventory": inventory,
                "quantity": cart_item.quantity,
                "unit_price": product.price,
                "subtotal": subtotal,
            }
        )

    order = Order(
        user_id=user_id,
        status=OrderStatus.PENDING,
        total_amount=total_amount,
        shipping_address=checkout_data.shipping_address,
    )

    db.add(order)
    db.flush()

    for item_data in order_items_data:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data["product"].id,
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            subtotal=item_data["subtotal"],
        )
        db.add(order_item)

    for cart_item in cart.items:
        db.delete(cart_item)

    history = OrderStatusHistory(
        order_id=order.id,
        status=OrderStatus.PENDING,
        description="Order created and stock reserved",
    )
    db.add(history)

    db.commit()
    db.refresh(order)
    return order


def get_user_orders(
    db: Session,
    user_id: int,
) -> list[Order]:
    statement = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.status_history),
            joinedload(Order.shipment),
        )
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    return list(db.scalars(statement).unique().all())


def get_user_order(
    db: Session,
    user_id: int,
    order_id: int,
) -> Order | None:
    statement = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.status_history),
            joinedload(Order.shipment),
        )
        .where(
            Order.id == order_id,
            Order.user_id == user_id,
        )
    )
    return db.scalar(statement)


def get_all_orders(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: OrderStatus | None = None,
) -> list[Order]:
    statement = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.status_history),
            joinedload(Order.shipment),
        )
    )
    if status is not None:
        statement = statement.where(Order.status == status)

    statement = statement.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(statement).unique().all())


def get_order_by_id(
    db: Session,
    order_id: int,
) -> Order | None:
    statement = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.status_history),
            joinedload(Order.shipment),
        )
        .where(Order.id == order_id)
    )
    return db.scalar(statement)


def confirm_order(
    db: Session,
    order: Order,
) -> Order:
    return change_order_status(db, order, OrderStatus.CONFIRMED, "Order confirmed")


def process_order(
    db: Session,
    order: Order,
) -> Order:
    return change_order_status(db, order, OrderStatus.PROCESSING, "Order is being processed")


def ship_order(
    db: Session,
    order: Order,
) -> Order:
    return change_order_status(db, order, OrderStatus.SHIPPED, "Order shipped")


def deliver_order(
    db: Session,
    order: Order,
) -> Order:
    return change_order_status(db, order, OrderStatus.DELIVERED, "Order delivered to recipient")


def cancel_order(
    db: Session,
    order: Order,
) -> Order:
    validate_order_status_transition(order.status, OrderStatus.CANCELLED)

    statement = select(OrderItem).where(OrderItem.order_id == order.id)
    order_items = list(db.scalars(statement).all())

    for order_item in order_items:
        release_stock(
            db,
            order_item.product_id,
            order_item.quantity,
        )

    return change_order_status(db, order, OrderStatus.CANCELLED, "Order cancelled and stock released")