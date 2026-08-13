from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException,status


from app.models.category import Category
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate

def create_product(
    db: Session,
    product_data: ProductCreate,
) -> Product:
    
    category = db.get(Category,product_data.category_id)

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

    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


def get_products(
    db: Session,
    include_inactive: bool = False,
) -> list[Product]:

    statement = select(Product)

    if not include_inactive:
        statement = statement.where(
            Product.is_active.is_(True)
        )

    statement = statement.order_by(
        Product.created_at.desc()
    )

    return list(db.scalars(statement).all())

def get_product(
    db: Session,
    product_id: int,
) -> Product | None:

    return db.get(Product, product_id)

def update_product(
    db: Session,
    product: Product,
    product_data: ProductUpdate,
) -> Product:

    update_data = product_data.model_dump(
        exclude_unset=True
    )

    if "category_id" in update_data:
        category = db.get(
            Category,
            update_data["category_id"],
        )

        if category is None:
            raise ValueError("Category not found")

    for field, value in update_data.items():
        setattr(product, field, value)

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


def delete_product(
    db: Session,
    product: Product,
) -> None:

    db.delete(product)
    db.commit() 