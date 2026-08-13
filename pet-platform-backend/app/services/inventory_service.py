from sqlalchemy import select
from sqlalchemy.orm import Session


from app.models.inventory import Inventory
from app.schemas.inventory import InventoryCreate, InventoryUpdate  
from app.models.product import Product



def create_inventory(
    db: Session,
    inventory_data: InventoryCreate,
)-> Inventory:

    product = db.get(
        Product,
        inventory_data.product_id,
    )

    if not product:
        raise ValueError(f"Product with id={inventory_data.product_id} not found")


    statement = select(Inventory).where(
        Inventory.product_id == inventory_data.product_id
    )

    existing_inventory = db.scalar(statement)

    if existing_inventory is not None:
        raise RuntimeError(
        "Inventory already exists for this product"
       )

    inventory=Inventory(
        product_id=inventory_data.product_id,
        stock_quantity=inventory_data.stock_quantity,
        low_stock_threshold=inventory_data.low_stock_threshold,
    )

    db.add(inventory)
    db.commit()
    db.refresh(inventory)

    return inventory

def get_inventory(
    db: Session,
    inventory_id: int,
) -> Inventory | None:

    return db.get(
        Inventory,
        inventory_id,
    )

def get_product_inventory(
    db: Session,
    product_id: int,
    for_update: bool = False,
) -> Inventory | None:

    statement = select(Inventory).where(
        Inventory.product_id == product_id
    )

    if for_update:
        statement = statement.with_for_update()

    return db.scalar(statement)

def update_inventory(
    db: Session,
    inventory: Inventory,
    inventory_data: InventoryUpdate,
) -> Inventory:

    update_data = inventory_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(inventory, field, value)

    db.commit()
    db.refresh(inventory)

    return inventory


def get_available_stock(
    inventory: Inventory,
) -> int:

    if inventory.stock_quantity < inventory.reserved_quantity:
        raise ValueError(
            f"Inconsistent inventory state for product {inventory.product_id}: "
            f"reserved quantity ({inventory.reserved_quantity}) exceeds physical stock ({inventory.stock_quantity})"
        )

    return (
        inventory.stock_quantity
        - inventory.reserved_quantity
    )


def is_low_stock(
    inventory: Inventory,
) -> bool:
    """
    Returns True if available_stock (stock_quantity - reserved_quantity)
    is less than or equal to low_stock_threshold.
    """
    return get_available_stock(inventory) <= inventory.low_stock_threshold


def check_stock(
    db: Session,
    product_id: int,
    quantity: int,
    for_update: bool = False,
) -> Inventory:
    """
    Validates quantity > 0, product existence & activity, inventory existence,
    and available stock >= requested quantity.
    Returns the Inventory object or raises ValueError.
    """
    if quantity <= 0:
        raise ValueError("Quantity must be greater than 0")

    product = db.get(Product, product_id)
    if product is None:
        raise ValueError(f"Product {product_id} not found")

    if not product.is_active:
        raise ValueError(f"Product '{product.name}' is no longer available")

    inventory = get_product_inventory(db, product_id, for_update=for_update)
    if inventory is None:
        raise ValueError(f"Inventory not found for '{product.name}'")

    available = get_available_stock(inventory)
    if available < quantity:
        raise ValueError(
            f"Insufficient stock for '{product.name}'"
        )

    return inventory


def reserve_stock(
    db: Session,
    product_id: int,
    quantity: int,
) -> Inventory:
    """
    Acquires row lock, validates stock availability, and increments reserved_quantity.
    Raises ValueError on insufficient stock or invalid state.
    """
    inventory = check_stock(db, product_id, quantity, for_update=True)

    inventory.reserved_quantity += quantity

    if inventory.reserved_quantity > inventory.stock_quantity:
        raise ValueError("Reserved quantity cannot exceed physical stock")

    return inventory


def release_stock(
    db: Session,
    product_id: int,
    quantity: int,
) -> Inventory:
    """
    Acquires row lock, validates reserved stock availability, and decrements reserved_quantity.
    Raises ValueError if attempting to release more than currently reserved or on invalid input.
    """
    if quantity <= 0:
        raise ValueError("Quantity to release must be greater than 0")

    inventory = get_product_inventory(db, product_id, for_update=True)
    if inventory is None:
        raise ValueError(f"Inventory not found for product {product_id}")

    if inventory.reserved_quantity < quantity:
        raise ValueError(
            f"Cannot release {quantity} reserved stock for product {product_id}. "
            f"Currently reserved: {inventory.reserved_quantity}"
        )

    inventory.reserved_quantity -= quantity
    return inventory


def finalize_stock(
    db: Session,
    product_id: int,
    quantity: int,
) -> Inventory:
    """
    Acquires row lock, validates reserved stock availability, and converts reserved stock into sold stock
    (decrements both stock_quantity and reserved_quantity).
    Raises ValueError on insufficient reserved/physical stock or invalid input.
    """
    if quantity <= 0:
        raise ValueError("Quantity to finalize must be greater than 0")

    inventory = get_product_inventory(db, product_id, for_update=True)
    if inventory is None:
        raise ValueError(f"Inventory not found for product {product_id}")

    if inventory.reserved_quantity < quantity:
        raise ValueError(
            f"Cannot finalize {quantity} stock for product {product_id}. "
            f"Currently reserved: {inventory.reserved_quantity}"
        )

    if inventory.stock_quantity < quantity:
        raise ValueError(
            f"Cannot finalize {quantity} stock for product {product_id}. "
            f"Physical stock ({inventory.stock_quantity}) is insufficient"
        )

    inventory.stock_quantity -= quantity
    inventory.reserved_quantity -= quantity

    return inventory