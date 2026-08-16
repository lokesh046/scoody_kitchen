from decimal import Decimal
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session  

from app.core.cache import cache
from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.enums import UserRole
from app.models.product import ProductImage
from app.models.user import User
from app.schemas.product import (
    PaginatedProductResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from app.services.product_service import (
    create_product,
    deactivate_product,
    get_product,
    get_products,
    get_products_paginated,
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
    response_model=PaginatedProductResponse,
    status_code=status.HTTP_200_OK,
)
def get_all_products(
    search: str | None = Query(None),
    category_id: int | None = Query(None),
    min_price: Decimal | None = Query(None),
    max_price: Decimal | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1),
    limit: int = Query(20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    include_inactive = current_user.role == UserRole.ADMIN
    cache_key = f"products:{page}_{limit}_{category_id}_{min_price}_{max_price}_{search}_{sort_by}_{sort_order}_{include_inactive}"

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        result = get_products_paginated(
            db=db,
            search=search,
            category_id=category_id,
            min_price=min_price,
            max_price=max_price,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            limit=limit,
            include_inactive=include_inactive,
        )
        cache.set(cache_key, result, ttl_seconds=120)
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )




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
        created = create_product(db, product_data, image_url=image_url)
        cache.clear_prefix("products:")
        return created
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

        cache.clear_prefix("products:")
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

    deactivated = deactivate_product(
        db,
        product,
    )
    cache.clear_prefix("products:")
    return deactivated


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


@router.post(
    "/{product_id}/gallery",
    response_model=ProductResponse,
)
async def upload_product_gallery_images(
    product_id: int,
    images: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image files provided",
        )

    storage_provider = get_storage_provider()
    existing_count = len(product.images)

    for index, image_file in enumerate(images):
        if not image_file.filename:
            continue
        file_bytes = await image_file.read()
        validate_image_file(image_file, file_bytes)

        uploaded_url = storage_provider.upload_image(
            file_bytes=file_bytes,
            original_filename=image_file.filename,
            content_type=image_file.content_type or "image/jpeg",
        )

        img_record = ProductImage(
            product_id=product.id,
            image_url=uploaded_url,
            display_order=existing_count + index,
        )
        db.add(img_record)
        if hasattr(product, "images") and isinstance(product.images, list):
            product.images.append(img_record)

        if not product.image_url:
            product.image_url = uploaded_url

    db.commit()
    db.refresh(product)
    cache.clear_prefix("products:")
    return product


@router.delete(
    "/{product_id}/gallery/{image_id}",
    response_model=ProductResponse,
)
def delete_product_gallery_image(
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    img_record = db.scalars(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
        )
    ).unique().one_or_none()

    if img_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gallery image not found",
        )

    storage_provider = get_storage_provider()
    try:
        storage_provider.delete_image(img_record.image_url)
    except Exception:
        pass

    db.delete(img_record)
    db.commit()
    db.refresh(product)
    cache.clear_prefix("products:")
    return product

