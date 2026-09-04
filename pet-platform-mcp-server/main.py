# Force IPv4 DNS resolution to prevent IPv6 hangs on this system
import socket
orig_getaddrinfo = socket.getaddrinfo
def forced_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if family in (socket.AF_UNSPEC, 0):
        family = socket.AF_INET
    return orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = forced_ipv4_getaddrinfo

import os

from dotenv import load_dotenv
load_dotenv()  # Loads the .env file immediately before other modules load

from mcp.server.fastmcp import FastMCP

from tools.orders import tool_get_order_status, tool_get_order_tracking, tool_get_my_orders
from tools.products import tool_search_products, tool_get_product_stock
from tools.bookings import tool_get_available_slots, tool_get_my_consultations, tool_get_my_pets
from tools.actions import (
    tool_book_consultation,
    tool_cancel_order,
    tool_cancel_consultation,
)


# Create FastMCP server instance (listening on all interfaces inside container on port 8001)
host = os.getenv("HOST", "0.0.0.0")
port = int(os.getenv("PORT", "8001"))
mcp = FastMCP("Pet Platform MCP Server", host=host, port=port)


@mcp.tool()
def ping(message: str = "ping") -> str:
    """Placeholder MCP ping tool to test inter-service communication."""
    return f"pong: {message}"


# Register Order Read Tools
mcp.tool()(tool_get_order_status)
mcp.tool()(tool_get_order_tracking)
mcp.tool()(tool_get_my_orders)

# Register Product Read Tools
mcp.tool()(tool_search_products)
mcp.tool()(tool_get_product_stock)

# Register Booking Read Tools
mcp.tool()(tool_get_available_slots)
mcp.tool()(tool_get_my_consultations)
mcp.tool()(tool_get_my_pets)

# Register Action Tools (State-Changing Write Operations)
mcp.tool()(tool_book_consultation)
mcp.tool()(tool_cancel_order)
mcp.tool()(tool_cancel_consultation)


if __name__ == "__main__":
    mcp.run(transport="sse")
