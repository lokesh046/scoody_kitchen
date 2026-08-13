from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.schemas.order import CheckoutRequest
from app.services.inventory_service import release_stock, reserve_stock


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
            raise ValueError(
                f"Product {cart_item.product_id} not found"
            )

        if not product.is_active:
            raise ValueError(
                f"Product '{product.name}' is no longer available"
            )

        inventory = reserve_stock(
            db,
            product.id,
            cart_item.quantity,
        )

        subtotal = (
            product.price * cart_item.quantity
        )

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
            joinedload(Order.items).joinedload(OrderItem.product)
        )
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )

    return list(
        db.scalars(statement).unique().all()
    )


def get_user_order(
    db: Session,
    user_id: int,
    order_id: int,
) -> Order | None:

    statement = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product)
        )
        .where(
            Order.id == order_id,
            Order.user_id == user_id,
        )
    )

    return db.scalar(statement)

def cancel_order(
    db: Session,
    order: Order,
) -> Order:

    if order.status != OrderStatus.PENDING:
        raise ValueError(
            "Only pending orders can be cancelled"
        )

    statement = (
        select(OrderItem)
        .where(OrderItem.order_id == order.id)
    )

    order_items = list(
        db.scalars(statement).all()
    )

    for order_item in order_items:
        release_stock(
            db,
            order_item.product_id,
            order_item.quantity,
        )

    order.status = OrderStatus.CANCELLED

    db.commit()
    db.refresh(order)

    return order