from fastapi import APIRouter, Depends, HTTPException,status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session  


from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from app.services.product_service import (
    create_product,
    deactivate_product,
    get_product,
    get_products,
    update_product,
)

from app.services.inventory_service import (get_available_stock,get_product_inventory)
router = APIRouter(
    prefix="/product",
    tags=["Products"]
)


@router.get(
    "",
    response_model = list[ProductResponse],
    status_code=status.HTTP_200_OK,
)

async def get_all_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    if current_user.role == UserRole.ADMIN:
        return get_products(db,include_inactive=True)
    
    return get_products(db,include_inactive=False)




@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
def get_product_details(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = get_product(
        db,
        product_id,
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if not product.is_active and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return product


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):

    try:
        return create_product(db,product_data)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="SKU already exists",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )



@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
)
def update_existing_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    product = get_product(
        db,
        product_id,
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    try:
        return update_product(
            db,
            product,
            product_data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="SKU already exists",
        )


@router.delete(
    "/{product_id}",
    response_model=ProductResponse,
)
def delete_existing_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    product = get_product(
        db,
        product_id,
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return deactivate_product(
        db,
        product,
    )


@router.get(
    "/{product_id}/inventory",
)
def get_product_stock(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inventory = get_product_inventory(
        db,
        product_id,
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found",
        )

    return {
        "product_id": product_id,
        "stock_quantity": inventory.stock_quantity,
        "reserved_quantity": inventory.reserved_quantity,
        "available_stock": get_available_stock(inventory),
        "low_stock": (
            get_available_stock(inventory)
            <= inventory.low_stock_threshold
        ),
    }

