import sys
import os
from typing import Any

# Ensure pet-platform-backend is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../pet-platform-backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import SessionLocal
from app.services.product_service import get_products_paginated, get_product
from app.services.inventory_service import get_product_inventory, get_available_stock, is_low_stock


def tool_search_products(
    search: str | None = None,
    category_id: int | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """Search products catalog by query string or category."""
    db = SessionLocal()
    try:
        paginated = get_products_paginated(
            db=db,
            search=search,
            category_id=category_id,
            limit=limit,
            include_inactive=False,
        )
        
        products = [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "price": float(p.price) if p.price is not None else 0.0,
                "category_id": p.category_id,
                "image_url": p.image_url,
                "images": [img.image_url for img in getattr(p, "images", [])],
                "in_stock": getattr(p, "is_in_stock", True),
            }
            for p in paginated.items
        ]
        
        return {
            "total": paginated.total,
            "page": paginated.page,
            "products": products,
        }
    finally:
        db.close()


def tool_get_product_stock(product_id: int) -> dict[str, Any]:
    """Check stock availability and inventory levels for a product."""
    db = SessionLocal()
    try:
        product = get_product(db, product_id)
        if not product:
            return {"error": f"Product #{product_id} not found."}
            
        inv = get_product_inventory(db, product_id)
        if not inv:
            return {
                "product_id": product_id,
                "name": product.name,
                "stock_quantity": 0,
                "available_stock": 0,
                "is_in_stock": False,
            }
            
        avail = get_available_stock(inv)
        return {
            "product_id": product_id,
            "name": product.name,
            "stock_quantity": inv.stock_quantity,
            "reserved_quantity": inv.reserved_quantity,
            "available_stock": avail,
            "low_stock": is_low_stock(inv),
            "is_in_stock": avail > 0,
        }
    finally:
        db.close()
