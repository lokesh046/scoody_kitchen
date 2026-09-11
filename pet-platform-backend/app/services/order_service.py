from decimal import Decimal

from sqlalchemy import case, select
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
    OrderStatus.CONFIRMED: {OrderStatus.PROCESSING, OrderStatus.CANCELLED},
    OrderStatus.PROCESSING: {OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.PACKED: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
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
    if order.status == new_status:
        return order

    prev_status = order.status
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

    # Queue background notification task (In-App notification + Email dispatch)
    if not (prev_status == OrderStatus.PENDING and new_status == OrderStatus.CANCELLED):
        try:
            from app.tasks.notification_tasks import dispatch_order_notifications_task
            dispatch_order_notifications_task.delay(
                user_id=order.user_id,
                title=f"Order Update: {new_status.value.upper()}",
                message=f"Order #{order.id}: {description}.",
                link="/orders"
            )
        except Exception as e:
            # Prevent task failures from blocking database commits
            print(f"Warning: Failed to queue order notification task: {e}")

    return order


def create_order_from_cart(
    db: Session,
    user_id: int,
    checkout_data: CheckoutRequest,
) -> Order:
    from app.models.user import User
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("User not found")
    if not user.is_phone_verified:
        raise ValueError("Phone number must be verified before placing an order")

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

    # Cancel any existing pending orders for this user to release reserved stock
    existing_pending_orders = list(
        db.scalars(
            select(Order).where(
                Order.user_id == user_id,
                Order.status == OrderStatus.PENDING
            )
        ).all()
    )
    for pending_order in existing_pending_orders:
        cancel_order(db, pending_order)

    total_amount = Decimal("0.00")
    order_items_data = []

    from app.services.cart_service import get_product_price

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

        unit_price = get_product_price(product, cart_item.selected_weight)
        subtotal = unit_price * cart_item.quantity
        total_amount += subtotal

        order_items_data.append(
            {
                "product": product,
                "inventory": inventory,
                "quantity": cart_item.quantity,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "selected_weight": cart_item.selected_weight,
            }
        )

    applied_coupon_code = None
    discount_amount = Decimal("0.00")
    if checkout_data.coupon_code:
        from app.services.coupon_service import validate_coupon_code
        is_valid, coupon, disc, discounted_total, msg = validate_coupon_code(
            db,
            code=checkout_data.coupon_code,
            order_amount=total_amount,
        )
        if not is_valid or coupon is None:
            raise ValueError(msg)
        applied_coupon_code = coupon.code
        discount_amount = disc
        total_amount = discounted_total

    order = Order(
        user_id=user_id,
        status=OrderStatus.PENDING,
        total_amount=total_amount,
        coupon_code=applied_coupon_code,
        discount_amount=discount_amount,
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
            selected_weight=item_data["selected_weight"],
        )
        db.add(order_item)

    history = OrderStatusHistory(
        order_id=order.id,
        status=OrderStatus.PENDING,
        description="Order created and stock reserved",
    )
    db.add(history)

    db.commit()
    db.refresh(order)

    # Initialize payment session if payment_method is supplied in the checkout request
    order.razorpay_order_id = None
    order.razorpay_key_id = None
    if checkout_data.payment_method:
        from app.services.payment_service import create_payment
        from app.core.config import settings
        payment = create_payment(db, order, checkout_data.payment_method)
        order.razorpay_order_id = payment.razorpay_order_id
        order.razorpay_key_id = settings.RAZORPAY_KEY_ID

    # Queue background task to notify admins of a new incoming order
    try:
        from app.tasks.notification_tasks import notify_admins_task
        notify_admins_task.delay(
            title="New Order Placed",
            message=f"Order #{order.id} for ₹{order.total_amount:.2f} has been created and needs confirmation."
        )
    except Exception as e:
        print(f"Warning: Failed to queue admin checkout notification task: {e}")

    return order


def get_user_orders(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    status: OrderStatus | None = None,
) -> list[Order]:
    from app.models.order_status_history import OrderStatusHistory
    from sqlalchemy import not_

    statement = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.status_history),
            joinedload(Order.shipment),
            joinedload(Order.user),
        )
        .where(
            Order.user_id == user_id,
            not_(
                Order.status_history.any(
                    OrderStatusHistory.description == "System cancelled: checkout abandoned or restarted"
                )
            )
        )
    )
    if status is not None:
        statement = statement.where(Order.status == status)

    statement = statement.order_by(Order.created_at.desc()).offset(skip).limit(limit)
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
            joinedload(Order.user),
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
    tab: str | None = None,
) -> list[Order]:
    statement = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.status_history),
            joinedload(Order.shipment),
            joinedload(Order.user),
        )
    )
    if tab:
        if tab == "pending":
            statuses = [OrderStatus.PENDING]
        elif tab == "confirmed":
            statuses = [
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.PACKED,
                OrderStatus.SHIPPED,
                OrderStatus.IN_TRANSIT,
                OrderStatus.OUT_FOR_DELIVERY,
            ]
        elif tab == "delivered":
            statuses = [OrderStatus.DELIVERED, OrderStatus.COMPLETED]
        elif tab == "cancelled":
            statuses = [
                OrderStatus.CANCELLED,
                OrderStatus.RETURNED,
                OrderStatus.DELIVERY_FAILED,
            ]
        else:
            statuses = []
        
        if statuses:
            statement = statement.where(Order.status.in_(statuses))

    if tab == "delivered":
        statement = statement.order_by(
            case((Order.status == OrderStatus.DELIVERED, 0), else_=1),
            Order.created_at.asc()
        )
    else:
        statement = statement.order_by(Order.created_at.asc())

    statement = statement.offset(skip).limit(limit)
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
            joinedload(Order.user),
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


def complete_order(
    db: Session,
    order: Order,
) -> Order:
    return change_order_status(db, order, OrderStatus.COMPLETED, "Order completed successfully")


def cancel_order(
    db: Session,
    order: Order,
) -> Order:
    # 1. Idempotent short-circuit: if already cancelled, return immediately without touching stock
    if getattr(order, "status", None) == OrderStatus.CANCELLED:
        return order

    # 2. Acquire exclusive row lock on the Order row to serialize concurrent cancellations
    locked_order = order
    try:
        statement = (
            select(Order)
            .where(Order.id == order.id)
            .with_for_update()
        )
        result = db.scalar(statement)
        if isinstance(result, Order):
            locked_order = result
            if locked_order.status == OrderStatus.CANCELLED:
                return locked_order
    except Exception:
        pass

    validate_order_status_transition(locked_order.status, OrderStatus.CANCELLED)

    statement_items = select(OrderItem).where(OrderItem.order_id == locked_order.id)
    order_items = list(db.scalars(statement_items).all())

    for order_item in order_items:
        release_stock(
            db,
            order_item.product_id,
            order_item.quantity,
            clamp_drift=True,
        )

    return change_order_status(db, locked_order, OrderStatus.CANCELLED, "Order cancelled and stock released")