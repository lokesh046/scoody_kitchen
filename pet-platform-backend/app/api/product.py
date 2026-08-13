from decimal import Decimal
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
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

from app.services.inventory_service import (get_available_stock, get_product_inventory, is_low_stock)
from app.services.storage_service import get_storage_provider, validate_image_file

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
async def create_new_product(
    category_id: int = Form(...),
    name: str = Form(...),
    price: Decimal = Form(...),
    sku: str = Form(...),
    description: str | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    product_data = ProductCreate(
        category_id=category_id,
        name=name,
        description=description,
        sku=sku,
        price=price,
    )

    image_url = None
    storage_provider = None

    if image is not None and image.filename:
        file_bytes = await image.read()
        validate_image_file(image, file_bytes)
        storage_provider = get_storage_provider()
        image_url = storage_provider.upload_image(
            file_bytes=file_bytes,
            original_filename=image.filename,
            content_type=image.content_type or "image/jpeg",
        )

    try:
        return create_product(db, product_data, image_url=image_url)
    except Exception as exc:
        if image_url and storage_provider:
            try:
                storage_provider.delete_image(image_url)
            except Exception:
                pass
        db.rollback()
        if isinstance(exc, HTTPException):
            raise exc
        if isinstance(exc, IntegrityError):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="SKU already exists",
            )
        if isinstance(exc, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )
        raise exc



@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
)
async def update_existing_product(
    product_id: int,
    category_id: int | None = Form(None),
    name: str | None = Form(None),
    price: Decimal | None = Form(None),
    sku: str | None = Form(None),
    description: str | None = Form(None),
    is_active: bool | None = Form(None),
    image: UploadFile | None = File(None),
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

    product_data = ProductUpdate(
        category_id=category_id,
        name=name,
        description=description,
        sku=sku,
        price=price,
        is_active=is_active,
    )

    old_image_url = product.image_url
    new_image_url = None
    storage_provider = None

    if image is not None and image.filename:
        file_bytes = await image.read()
        validate_image_file(image, file_bytes)
        storage_provider = get_storage_provider()
        new_image_url = storage_provider.upload_image(
            file_bytes=file_bytes,
            original_filename=image.filename,
            content_type=image.content_type or "image/jpeg",
        )

    try:
        updated = update_product(
            db,
            product,
            product_data,
            image_url=new_image_url,
        )

        if new_image_url and old_image_url:
            if storage_provider is None:
                storage_provider = get_storage_provider()
            try:
                storage_provider.delete_image(old_image_url)
            except Exception:
                pass

        return updated

    except Exception as exc:
        db.rollback()
        if new_image_url and storage_provider:
            try:
                storage_provider.delete_image(new_image_url)
            except Exception:
                pass

        if isinstance(exc, HTTPException):
            raise exc
        if isinstance(exc, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )
        if isinstance(exc, IntegrityError):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="SKU already exists",
            )
        raise exc


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
        "low_stock": is_low_stock(inventory),
    }

