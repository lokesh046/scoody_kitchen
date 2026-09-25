from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.dependencies.auth import get_current_user
from app.models.user import User

from app.schemas.cart import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
)

from app.services.cart_service import (
    add_item_to_cart,
    clear_cart,
    get_cart_response,
    get_user_cart,
    remove_cart_item,
    update_cart_item,
)


router = APIRouter(
    prefix="/cart",
    tags=["Cart"],
)


@router.get(
    "",
    response_model=CartResponse,
)
def get_my_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    return get_cart_response(
        db,
        current_user.id,
    )


@router.post(
    "/items",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute")
def add_product_to_cart(
    request: Request,
    item_data: CartItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    cart = get_user_cart(
        db,
        current_user.id,
    )

    try:

        add_item_to_cart(
            db,
            cart,
            item_data,
        )
        db.expire_all()
        return get_cart_response(
            db,
            current_user.id,
        )

    except ValueError as exc:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.patch(
    "/items/{item_id}",
    response_model=CartResponse,
)
@limiter.limit("30/minute")
def update_my_cart_item(
    request: Request,
    item_id: int,
    item_data: CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    cart = get_user_cart(
        db,
        current_user.id,
    )

    cart_item = update_cart_item(
        db,
        cart,
        item_id,
        item_data,
    )

    if cart_item is None:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    db.expire_all()
    return get_cart_response(
        db,
        current_user.id,
    )


@router.delete(
    "/items/{item_id}",
    response_model=CartResponse,
)
@limiter.limit("30/minute")
def remove_item_from_cart(
    request: Request,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    cart = get_user_cart(
        db,
        current_user.id,
    )

    removed = remove_cart_item(
        db,
        cart,
        item_id,
    )

    if not removed:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    db.expire_all()
    return get_cart_response(
        db,
        current_user.id,
    )


@router.delete(
    "",
)
@limiter.limit("10/minute")
def clear_my_cart(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    cart = get_user_cart(
        db,
        current_user.id,
    )

    clear_cart(
        db,
        cart,
    )

    return {
        "message": "Cart cleared successfully"
    }