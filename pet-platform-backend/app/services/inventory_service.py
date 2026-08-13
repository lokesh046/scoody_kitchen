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
) -> Inventory | None:

    statement = select(Inventory).where(
        Inventory.product_id == product_id
    )

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

    return (
        inventory.stock_quantity
        - inventory.reserved_quantity
    )