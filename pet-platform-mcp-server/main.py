import os
from mcp.server.fastmcp import FastMCP

from tools.orders import tool_get_order_status, tool_get_order_tracking
from tools.products import tool_search_products, tool_get_product_stock
from tools.bookings import tool_get_available_slots, tool_get_my_consultations
from tools.actions import (
    tool_book_consultation,
    tool_cancel_order,
    tool_cancel_consultation,
)

# Create FastMCP server instance
mcp = FastMCP("Pet Platform MCP Server", host="0.0.0.0", port=8001)


@mcp.tool()
def ping(message: str = "ping") -> str:
    """Placeholder MCP ping tool to test inter-service communication."""
    return f"pong: {message}"


# Register Order Read Tools
mcp.tool()(tool_get_order_status)
mcp.tool()(tool_get_order_tracking)

# Register Product Read Tools
mcp.tool()(tool_search_products)
mcp.tool()(tool_get_product_stock)

# Register Booking Read Tools
mcp.tool()(tool_get_available_slots)
mcp.tool()(tool_get_my_consultations)

# Register Action Tools (State-Changing Write Operations)
mcp.tool()(tool_book_consultation)
mcp.tool()(tool_cancel_order)
mcp.tool()(tool_cancel_consultation)


if __name__ == "__main__":
    mcp.run(transport="sse")
