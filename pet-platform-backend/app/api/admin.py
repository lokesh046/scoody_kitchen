from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.order import OrderStatus
from app.models.user import User
from app.schemas.order import OrderResponse, OrderStatusUpdate
from app.services.order_service import (
    cancel_order,
    confirm_order,
    deliver_order,
    get_all_orders,
    get_order_by_id,
    process_order,
    ship_order,
)


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@router.get("/test")
def admin_test(
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    )
):
    return {
        "message": "Admin access granted",
        "user_id": current_user.id,
        "role": current_user.role
    }


@router.get(
    "/orders",
    response_model=list[OrderResponse],
)
def list_all_orders_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    return get_all_orders(db)


@router.get(
    "/orders/{order_id}",
    response_model=OrderResponse,
)
def get_order_details_admin(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    order = get_order_by_id(db, order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order


@router.patch(
    "/orders/{order_id}/status",
    response_model=OrderResponse,
)
def update_order_status_admin(
    order_id: int,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    order = get_order_by_id(db, order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    try:
        target_status = status_data.status
        if target_status == OrderStatus.CONFIRMED:
            return confirm_order(db, order)
        elif target_status == OrderStatus.PROCESSING:
            return process_order(db, order)
        elif target_status == OrderStatus.SHIPPED:
            return ship_order(db, order)
        elif target_status in (OrderStatus.DELIVERED, OrderStatus.COMPLETED):
            return deliver_order(db, order)
        elif target_status == OrderStatus.CANCELLED:
            return cancel_order(db, order)
        else:
            raise ValueError(f"Invalid target status '{target_status.value}'")

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )