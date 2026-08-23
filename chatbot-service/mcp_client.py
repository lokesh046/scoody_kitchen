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
import threading
import time

logger = logging.getLogger(__name__)

ALLOW_MCP_FALLBACK = os.getenv("ALLOW_MCP_FALLBACK", "false").lower() == "true"

# How long a fetched tool list stays valid before we bother re-fetching.
# Tool schemas (cancel_order, book_consultation, etc.) essentially never
# change between deploys, so re-opening an SSE connection and re-listing
# tools on every single chat message was pure wasted latency — this was
# the single most expensive step in the commerce agent's request path.
MCP_TOOLS_CACHE_TTL_SECONDS = int(os.getenv("MCP_TOOLS_CACHE_TTL_SECONDS", "60"))

if not os.environ.get("JWT_SECRET_KEY"):
    raise RuntimeError("JWT_SECRET_KEY environment variable is not configured.")
if not os.environ.get("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL environment variable is not configured.")

from typing import Any

# Ensure pet-platform-mcp-server is in sys.path for direct module import fallback
mcp_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../pet-platform-mcp-server"))
if mcp_server_dir not in sys.path:
    sys.path.insert(0, mcp_server_dir)

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")
if not MCP_SERVER_URL:
    raise RuntimeError("MCP_SERVER_URL environment variable is not configured.")


class MCPClientManager:
    """Manages MCP tool loading via langchain-mcp-adapters with fallback."""

    def __init__(self):
        self.server_url = MCP_SERVER_URL
        self._cached_tools: list[Any] | None = None
        self._cached_at: float = 0.0
        self._lock = threading.Lock()

    def get_mcp_tools(self, force_refresh: bool = False) -> list[Any]:
        """Return the MCP tool list, using a short-TTL cache.

        Tool schemas rarely change, so re-opening an SSE connection and
        re-listing every tool on every chat message was pure latency with no
        benefit. This caches the last successful fetch for
        MCP_TOOLS_CACHE_TTL_SECONDS and only goes back to the network when
        the cache is empty, expired, or force_refresh=True (e.g. after a
        tool invocation fails with a "not found"-type error, in case the
        server's tool set changed).

        Still raises if the MCP server is unreachable AND there is no usable
        cached copy to fall back on — a caller needs to know when a request
        could not actually reach the MCP layer, not have it disguised as a
        normal, successful tool list.
        """
        now = time.monotonic()
        with self._lock:
            cache_is_fresh = (
                self._cached_tools is not None
                and not force_refresh
                and (now - self._cached_at) < MCP_TOOLS_CACHE_TTL_SECONDS
            )
            if cache_is_fresh and self._cached_tools is not None:
                return self._cached_tools

        try:
            tools = self._fetch_tools_from_server()
        except Exception as exc:
            # Network hiccup or server restart: if we have a (possibly
            # stale-but-expired) cached copy, prefer serving that over
            # failing the whole request outright — a slightly stale tool
            # schema is far less disruptive than "I can't help you right
            # now." Only fail hard if we've never successfully fetched.
            with self._lock:
                if self._cached_tools is not None:
                    logger.warning(
                        "MCP refresh failed (%s); serving last known tool list (age=%.1fs).",
                        exc, now - self._cached_at,
                    )
                    return self._cached_tools

            logger.error("MCP server unreachable at %s: %s", self.server_url, exc)
            if ALLOW_MCP_FALLBACK:
                logger.warning("ALLOW_MCP_FALLBACK=true — using in-process tools for this call.")
                return self._get_fallback_mcp_tools()
            raise RuntimeError(
                f"Could not reach pet-platform-mcp-server at {self.server_url}. "
                "Tool calls are unavailable until the MCP server is reachable."
            ) from exc

        with self._lock:
            self._cached_tools = tools
            self._cached_at = now

        return tools

    def invalidate_cache(self) -> None:
        """Force the next get_mcp_tools() call to hit the network."""
        with self._lock:
            self._cached_tools = None
            self._cached_at = 0.0

    def _fetch_tools_from_server(self) -> list[Any]:
        """Load tools from the real FastMCP server over SSE (no caching)."""
        from langchain_mcp_adapters.client import MultiServerMCPClient
        import asyncio

        async def _fetch():
            client = MultiServerMCPClient(
                {"pet_tools": {"url": self.server_url, "transport": "sse"}}
            )
            return await client.get_tools()

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

        if not tools:
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
