from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.product import Product

from app.schemas.cart import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
)


def get_or_create_cart(
    db: Session,
    user_id: int,
) -> Cart:

    statement = (
        select(Cart)
        .options(
            joinedload(Cart.items)
            .joinedload(CartItem.product)
        )
        .where(Cart.user_id == user_id)
    )

    cart = (
        db.execute(statement)
        .unique()
        .scalar_one_or_none()
    )

    if cart is not None:
        return cart

    cart = Cart(
        user_id=user_id,
    )

    db.add(cart)
    db.commit()
    db.refresh(cart)

    return cart


def get_user_cart(
    db: Session,
    user_id: int,
) -> Cart:

    return get_or_create_cart(
        db,
        user_id,
    )


def build_cart_item_response(
    cart_item: CartItem,
) -> CartItemResponse:

    subtotal = (
        cart_item.product.price
        * cart_item.quantity
    )

    return CartItemResponse(
        id=cart_item.id,
        product_id=cart_item.product_id,
        name=cart_item.product.name,
        description=cart_item.product.description,
        price=cart_item.product.price,
        quantity=cart_item.quantity,
        subtotal=subtotal,
        created_at=cart_item.created_at,
        updated_at=cart_item.updated_at,
    )


def build_cart_response(
    cart: Cart,
) -> CartResponse:

    items = []

    for item in cart.items:

        items.append(
            build_cart_item_response(
                item
            )
        )

    total_amount = sum(
        (
            item.subtotal
            for item in items
        ),
        Decimal("0.00"),
    )

    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        items=items,
        total_amount=total_amount,
    )


def get_cart_response(
    db: Session,
    user_id: int,
) -> CartResponse:

    cart = get_user_cart(
        db,
        user_id,
    )

    return build_cart_response(
        cart
    )


def add_item_to_cart(
    db: Session,
    cart: Cart,
    item_data: CartItemCreate,
) -> CartItemResponse:

    product = db.get(
        Product,
        item_data.product_id,
    )

    if product is None:
        raise ValueError(
            "Product not found"
        )

    if not product.is_active:
        raise ValueError(
            "Product is not available"
        )

    statement = select(CartItem).where(
        CartItem.cart_id == cart.id,
        CartItem.product_id == item_data.product_id,
    )

    existing_item = db.scalar(
        statement
    )

    if existing_item is not None:

        existing_item.quantity += (
            item_data.quantity
        )

        db.commit()

        statement = (
            select(CartItem)
            .options(
                joinedload(
                    CartItem.product
                )
            )
            .where(
                CartItem.id
                == existing_item.id
            )
        )

        existing_item = db.scalar(
            statement
        )

        if existing_item is None:
            raise ValueError("Cart item could not be loaded")

        return build_cart_item_response(
            existing_item
        )

    cart_item = CartItem(
        cart_id=cart.id,
        product_id=item_data.product_id,
        quantity=item_data.quantity,
    )

    db.add(cart_item)
    db.commit()

    statement = (
        select(CartItem)
        .options(
            joinedload(
                CartItem.product
            )
        )
        .where(
            CartItem.id == cart_item.id
        )
    )

    cart_item = db.scalar(
        statement
    )
    if cart_item is None:
        raise ValueError("Cart item could not be loaded")

    return build_cart_item_response(
        cart_item
    )


def update_cart_item(
    db: Session,
    cart: Cart,
    item_id: int,
    item_data: CartItemUpdate,
) -> CartItemResponse | None:

    statement = select(CartItem).where(
        CartItem.id == item_id,
        CartItem.cart_id == cart.id,
    )

    cart_item = db.scalar(
        statement
    )

    if cart_item is None:
        return None

    cart_item.quantity = (
        item_data.quantity
    )

    db.commit()

    statement = (
        select(CartItem)
        .options(
            joinedload(
                CartItem.product
            )
        )
        .where(
            CartItem.id == cart_item.id
        )
    )

    cart_item = db.scalar(
        statement
    )

    if cart_item is None:
        raise ValueError("Cart Item could not be loader")

    return build_cart_item_response(
        cart_item
    )


def remove_cart_item(
    db: Session,
    cart: Cart,
    item_id: int,
) -> bool:

    statement = select(CartItem).where(
        CartItem.id == item_id,
        CartItem.cart_id == cart.id,
    )

    cart_item = db.scalar(
        statement
    )

    if cart_item is None:
        return False

    db.delete(cart_item)
    db.commit()

    return True


def clear_cart(
    db: Session,
    cart: Cart,
) -> None:

    for item in cart.items:
        db.delete(item)

    db.commit()