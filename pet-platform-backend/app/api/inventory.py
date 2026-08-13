from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session


from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.inventory import InventoryCreate, InventoryResponse, InventoryUpdate
from app.services.inventory_service import (
    create_inventory,
    update_inventory,
    get_inventory,
)


router = APIRouter(
    prefix="/inventory",
    tags=["inventory"]
)

@router.post(
    "",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_inventory(
    inventory_data: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    try:
        return create_inventory(
            db,
            inventory_data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

@router.get(
    "/{inventory_id}",
    response_model=InventoryResponse,
)
def get_inventory_details(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    inventory = get_inventory(
        db,
        inventory_id,
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found",
        )

    return inventory


@router.patch(
    "/{inventory_id}",
    response_model=InventoryResponse,
)
def update_existing_inventory(
    inventory_id: int,
    inventory_data: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    inventory = get_inventory(
        db,
        inventory_id,
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found",
        )

    return update_inventory(
        db,
        inventory,
        inventory_data,
    )