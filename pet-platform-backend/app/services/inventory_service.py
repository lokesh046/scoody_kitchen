import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


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


from sqlalchemy.orm.attributes import flag_modified


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
    selected_weight: str | None = None,
) -> Inventory:
    """
    Validates quantity > 0, product existence & activity, inventory existence,
    and available stock >= requested quantity (for both variant and product level).
    Returns the Inventory object or raises ValueError.
    """
    if quantity <= 0:
        raise ValueError("Quantity must be greater than 0")

    product = db.get(Product, product_id)
    if product is None:
        raise ValueError(f"Product {product_id} not found")

    if not product.is_active:
        raise ValueError(f"Product '{product.name}' is no longer available")

    # Check variant-specific stock if weight is specified and product has weight_options
    if selected_weight and product.weight_options:
        for opt in product.weight_options:
            if opt.get("weight") == selected_weight:
                if "stock" in opt:
                    variant_stock = int(opt.get("stock", 0))
                    variant_reserved = int(opt.get("reserved", 0))
                    variant_available = variant_stock - variant_reserved
                    if variant_available < quantity:
                        raise ValueError(
                            f"Insufficient stock for '{product.name} ({selected_weight})'. "
                            f"Only {max(0, variant_available)} available."
                        )
                break

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
    selected_weight: str | None = None,
) -> Inventory:
    """
    Acquires row lock, validates stock availability, and increments reserved_quantity.
    If selected_weight is provided, also reserves stock on the matching weight variant.
    Raises ValueError on insufficient stock or invalid state.
    """
    inventory = check_stock(db, product_id, quantity, for_update=True, selected_weight=selected_weight)
    product = db.get(Product, product_id)

    # Reserve on specific weight variant if configured
    if selected_weight and product and product.weight_options:
        for opt in product.weight_options:
            if opt.get("weight") == selected_weight:
                if "stock" in opt:
                    opt["reserved"] = int(opt.get("reserved", 0)) + quantity
                    flag_modified(product, "weight_options")
                break

    inventory.reserved_quantity += quantity

    if inventory.reserved_quantity > inventory.stock_quantity:
        raise ValueError("Reserved quantity cannot exceed physical stock")

    return inventory


def release_stock(
    db: Session,
    product_id: int,
    quantity: int,
    clamp_drift: bool = False,
    selected_weight: str | None = None,
) -> Inventory:
    """
    Acquires row lock, validates reserved stock availability, and decrements reserved_quantity.
    If selected_weight is provided, also releases reserved stock on the matching weight variant.
    Raises ValueError if attempting to release more than currently reserved or on invalid input.
    If clamp_drift=True, self-heals historical drift by clamping reserved_quantity to 0 instead of crashing.
    """
    if quantity <= 0:
        raise ValueError("Quantity to release must be greater than 0")

    inventory = get_product_inventory(db, product_id, for_update=True)
    if inventory is None:
        raise ValueError(f"Inventory not found for product {product_id}")

    product = db.get(Product, product_id)
    if selected_weight and product and product.weight_options:
        for opt in product.weight_options:
            if opt.get("weight") == selected_weight:
                if "stock" in opt:
                    current_res = int(opt.get("reserved", 0))
                    if current_res < quantity:
                        if clamp_drift:
                            opt["reserved"] = 0
                        else:
                            raise ValueError(
                                f"Cannot release {quantity} reserved stock for '{product.name} ({selected_weight})'. "
                                f"Currently reserved: {current_res}"
                            )
                    else:
                        opt["reserved"] = current_res - quantity
                    flag_modified(product, "weight_options")
                break

    if inventory.reserved_quantity < quantity:
        if clamp_drift:
            logger.warning(
                "Historical stock drift detected for product %s: attempted to release %s units, "
                "but only %s currently reserved. Clamping reserved_quantity to 0.",
                product_id, quantity, inventory.reserved_quantity
            )
            inventory.reserved_quantity = 0
            return inventory
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
    selected_weight: str | None = None,
) -> Inventory:
    """
    Acquires row lock, validates reserved stock availability, and converts reserved stock into sold stock
    (decrements both stock_quantity and reserved_quantity).
    If selected_weight is provided, decrements both stock and reserved on the matching variant.
    Raises ValueError on insufficient reserved/physical stock or invalid input.
    """
    if quantity <= 0:
        raise ValueError("Quantity to finalize must be greater than 0")

    inventory = get_product_inventory(db, product_id, for_update=True)
    if inventory is None:
        raise ValueError(f"Inventory not found for product {product_id}")

    product = db.get(Product, product_id)
    if selected_weight and product and product.weight_options:
        for opt in product.weight_options:
            if opt.get("weight") == selected_weight:
                if "stock" in opt:
                    opt["stock"] = max(0, int(opt.get("stock", 0)) - quantity)
                    opt["reserved"] = max(0, int(opt.get("reserved", 0)) - quantity)
                    flag_modified(product, "weight_options")
                break

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