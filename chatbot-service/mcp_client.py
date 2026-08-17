"""MCP Client Manager - Connects to FastMCP Server via langchain-mcp-adapters.

IMPORTANT: this client talks to pet-platform-mcp-server over real MCP (SSE)
and nothing else. There used to be a silent in-process fallback here that
imported the MCP server's tool functions directly and called them without
going over the network at all — meaning a real request could quietly bypass
the MCP protocol and the mcp-server container entirely, with no error and no
log line telling you it happened. That fallback is now only reachable when
ALLOW_MCP_FALLBACK=true is explicitly set (intended for local unit tests that
don't spin up the full docker-compose stack) — never in the normal request
path.
"""

import logging
import os
import sys

logger = logging.getLogger(__name__)

ALLOW_MCP_FALLBACK = os.getenv("ALLOW_MCP_FALLBACK", "false").lower() == "true"

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
        """Load tools from the real FastMCP server over SSE.

        Raises if the MCP server is unreachable, rather than silently
        returning in-process tool calls — a caller needs to know when a
        request could not actually reach the MCP layer, not have it disguised
        as a normal, successful tool list.
        """
        from langchain_mcp_adapters.client import MultiServerMCPClient
        import asyncio

        async def _fetch():
            client = MultiServerMCPClient(
                {"pet_tools": {"url": self.server_url, "transport": "sse"}}
            )
            return await client.get_tools()

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're already inside an async context (e.g. FastAPI request
                # handler). Run the fetch on a fresh event loop in a thread
                # rather than silently switching to the in-process fallback.
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    tools = pool.submit(lambda: asyncio.run(_fetch())).result(timeout=10)
            else:
                tools = loop.run_until_complete(_fetch())
        except Exception as exc:
            logger.error("MCP server unreachable at %s: %s", self.server_url, exc)
            if ALLOW_MCP_FALLBACK:
                logger.warning("ALLOW_MCP_FALLBACK=true — using in-process tools for this call.")
                return self._get_fallback_mcp_tools()
            raise RuntimeError(
                f"Could not reach pet-platform-mcp-server at {self.server_url}. "
                "Tool calls are unavailable until the MCP server is reachable."
            ) from exc

        if not tools:
            logger.error("MCP server returned no tools from %s.", self.server_url)
            raise RuntimeError("MCP server returned no tools.")

        logger.info("Loaded %d tools via real MCP/SSE from %s.", len(tools), self.server_url)
        return tools

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
