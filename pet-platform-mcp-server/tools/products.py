from typing import Any
from tools._client import backend_get


def tool_search_products(
    search: str | None = None,
    category_id: int | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """Search products catalog by query string or category."""
    return backend_get(
        "/internal/products/search",
        params={"search": search, "category_id": category_id, "limit": limit},
    )


def tool_get_product_stock(product_id: int) -> dict[str, Any]:
    """Check stock availability and inventory levels for a product."""
    return backend_get(f"/internal/products/{product_id}/stock")
