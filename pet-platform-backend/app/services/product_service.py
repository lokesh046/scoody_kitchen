import math
from decimal import Decimal
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status


from app.models.category import Category
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services.inventory_service import get_available_stock

ALLOWED_SORT_FIELDS = {
    "price": Product.price,
    "name": Product.name,
    "created_at": Product.created_at,
}


def create_product(
    db: Session,
    product_data: ProductCreate,
    image_url: str | None = None,
) -> Product:
    
    category = db.get(Category, product_data.category_id)

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    product = Product(
        category_id=product_data.category_id,
        name=product_data.name,
        description=product_data.description,
        sku=product_data.sku,
        price=product_data.price,
        image_url=image_url,
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


def get_products_paginated(
    db: Session,
    search: str | None = None,
    category_id: int | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 20,
    include_inactive: bool = False,
) -> dict:
    if page < 1:
        raise ValueError("Page number must be at least 1")
    if limit < 1 or limit > 100:
        raise ValueError("Limit must be between 1 and 100")
    if min_price is not None and min_price < Decimal("0.00"):
        raise ValueError("min_price cannot be negative")
    if max_price is not None and max_price < Decimal("0.00"):
        raise ValueError("max_price cannot be negative")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise ValueError("min_price cannot be greater than max_price")

    if sort_by not in ALLOWED_SORT_FIELDS:
        raise ValueError(f"Invalid sort field '{sort_by}'. Allowed fields: {list(ALLOWED_SORT_FIELDS.keys())}")
    if sort_order.lower() not in ("asc", "desc"):
        raise ValueError("sort_order must be 'asc' or 'desc'")

    statement = select(Product).options(
        joinedload(Product.category),
        joinedload(Product.inventory)
    )

    if not include_inactive:
        statement = statement.where(Product.is_active.is_(True))

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term)
            )
        )

    if category_id is not None:
        if category_id <= 0:
            raise ValueError("category_id must be a positive integer")
        statement = statement.where(Product.category_id == category_id)

    if min_price is not None:
        statement = statement.where(Product.price >= min_price)

    if max_price is not None:
        statement = statement.where(Product.price <= max_price)

    # Count query
    count_statement = select(func.count()).select_from(statement.subquery())
    total = db.scalar(count_statement) or 0

    # Sorting
    sort_col = ALLOWED_SORT_FIELDS[sort_by]
    if sort_order.lower() == "asc":
        statement = statement.order_by(sort_col.asc(), Product.id.asc())
    else:
        statement = statement.order_by(sort_col.desc(), Product.id.desc())

    # Pagination
    offset = (page - 1) * limit
    statement = statement.offset(offset).limit(limit)

    products = list(db.scalars(statement).unique().all())

    # Attach customer availability
    for product in products:
        avail_stock = None
        in_stock = None
        if product.inventory:
            try:
                stock_val = get_available_stock(product.inventory)
                avail_stock = stock_val
                in_stock = stock_val > 0
            except ValueError:
                avail_stock = 0
                in_stock = False

        product.available_stock = avail_stock
        product.is_in_stock = in_stock

    pages = math.ceil(total / limit) if total > 0 else 0

    return {
        "items": products,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


def get_products(
    db: Session,
    include_inactive: bool = False,
) -> list[Product]:

    statement = select(Product).options(
        joinedload(Product.category),
        joinedload(Product.inventory)
    )

    if not include_inactive:
        statement = statement.where(
            Product.is_active.is_(True)
        )

    statement = statement.order_by(
        Product.created_at.desc()
    )

    products = list(db.scalars(statement).unique().all())
    for product in products:
        if product.inventory:
            try:
                stock_val = get_available_stock(product.inventory)
                product.available_stock = stock_val
                product.is_in_stock = stock_val > 0
            except ValueError:
                product.available_stock = 0
                product.is_in_stock = False

    return products


def get_product(
    db: Session,
    product_id: int,
) -> Product | None:

    statement = (
        select(Product)
        .options(
            joinedload(Product.category),
            joinedload(Product.inventory)
        )
        .where(Product.id == product_id)
    )

    product = db.scalar(statement)
    if product and product.inventory:
        try:
            stock_val = get_available_stock(product.inventory)
            product.available_stock = stock_val
            product.is_in_stock = stock_val > 0
        except ValueError:
            product.available_stock = 0
            product.is_in_stock = False

    return product

def update_product(
    db: Session,
    product: Product,
    product_data: ProductUpdate,
    image_url: str | None = None,
) -> Product:

    update_data = product_data.model_dump(
        exclude_unset=True
    )

    if "category_id" in update_data and update_data["category_id"] is not None:
        category = db.get(
            Category,
            update_data["category_id"],
        )

        if category is None:
            raise ValueError("Category not found")

    for field, value in update_data.items():
        setattr(product, field, value)

    if image_url is not None:
        product.image_url = image_url

    db.commit()
    db.refresh(product)

    return product

def deactivate_product(
    db: Session,
    product: Product,
) -> Product:

    product.is_active = False

    db.commit()
    db.refresh(product)

    return product


import logging

logger = logging.getLogger(__name__)

def delete_product(
    db: Session,
    product: Product,
) -> None:
    image_url = product.image_url
    db.delete(product)
    db.commit()

    if image_url:
        try:
            from app.services.storage_service import get_storage_provider
            storage_provider = get_storage_provider()
            storage_provider.delete_image(image_url)
        except Exception as exc:
            logger.warning(f"Failed to delete storage image '{image_url}' for deleted product {product.id}: {exc}")