"""MCP Client Manager - Connects to FastMCP Server via langchain-mcp-adapters."""

import os
import sys

# Set dummy env vars if not present in env for unit tests
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_123456789"
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql+psycopg://pet_user:pet_password@localhost:5432/pet_platform"

from typing import Any

# Ensure pet-platform-mcp-server is in sys.path for direct module import fallback
mcp_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../pet-platform-mcp-server"))
if mcp_server_dir not in sys.path:
    sys.path.insert(0, mcp_server_dir)

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://mcp-server:8001/sse")


class MCPClientManager:
    """Manages MCP tool loading via langchain-mcp-adapters with fallback."""

    def __init__(self):
        self.server_url = MCP_SERVER_URL

    def get_mcp_tools(self) -> list[Any]:
        """Load tools from FastMCP server using langchain-mcp-adapters with direct fallback."""
        try:
            from langchain_mcp_adapters.client import MultiServerMCPClient
            import asyncio
            
            # Synchronous wrapper around MultiServerMCPClient for LangGraph node compatibility
            async def _fetch():
                async with MultiServerMCPClient(
                    {"pet_tools": {"url": self.server_url, "transport": "sse"}}
                ) as client:
                    return client.get_tools()

            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If event loop is running, use fallback for thread safety
                return self._get_fallback_mcp_tools()
            tools = loop.run_until_complete(_fetch())
            if tools:
                return tools
        except Exception:
            pass

        return self._get_fallback_mcp_tools()

    def _get_fallback_mcp_tools(self) -> list[Any]:
        """Direct python tool wrappers for headless testing."""
        from langchain_core.tools import StructuredTool

        try:
            from tools.orders import tool_get_order_status, tool_get_order_tracking
            from tools.products import tool_search_products, tool_get_product_stock
            from tools.bookings import tool_get_available_slots, tool_get_my_consultations
            from tools.actions import tool_book_consultation, tool_cancel_order, tool_cancel_consultation

            return [
                StructuredTool.from_function(func=tool_get_order_status, name="get_order_status"),
                StructuredTool.from_function(func=tool_get_order_tracking, name="get_order_tracking"),
                StructuredTool.from_function(func=tool_search_products, name="search_products"),
                StructuredTool.from_function(func=tool_get_product_stock, name="get_product_stock"),
                StructuredTool.from_function(func=tool_get_available_slots, name="get_available_slots"),
                StructuredTool.from_function(func=tool_get_my_consultations, name="get_my_consultations"),
                StructuredTool.from_function(func=tool_book_consultation, name="book_consultation"),
                StructuredTool.from_function(func=tool_cancel_order, name="cancel_order"),
                StructuredTool.from_function(func=tool_cancel_consultation, name="cancel_consultation"),
            ]
        except Exception:
            return []


mcp_client = MCPClientManager()
