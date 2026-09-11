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
    sys.path.append(mcp_server_dir)

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")
if not MCP_SERVER_URL:
    raise RuntimeError("MCP_SERVER_URL environment variable is not configured.")


class MCPClientManager:
    """Manages MCP tool loading via langchain-mcp-adapters with persistent connection."""

    def __init__(self):
        self.server_url = MCP_SERVER_URL
        self.client = None
        self._cached_tools: list[Any] | None = None
        self._cached_at: float = 0.0

    async def initialize(self) -> None:
        """Initialize the persistent MultiServerMCPClient connection."""
        from langchain_mcp_adapters.client import MultiServerMCPClient
        if not self.client:
            url = self.server_url
            if not url.endswith("/sse"):
                url = f"{url.rstrip('/')}/sse"
            self.client = MultiServerMCPClient(
                {
                    "pet_tools": {
                        "url": url,
                        "transport": "sse",
                        # Bound both connection setup and per-event wait time —
                        # without these, a stalled mcp-server hangs this call
                        # indefinitely instead of failing fast.
                        "timeout": 10.0,
                        "sse_read_timeout": 30.0,
                    }
                }
            )
            # Warm up connection or fetch initial tools
            try:
                start = time.perf_counter()
                self._cached_tools = await self.client.get_tools()
                duration = (time.perf_counter() - start) * 1000.0
                self._cached_at = time.monotonic()
                logger.info("Persistent MCP Client initialized successfully with %d tools.", len(self._cached_tools))
                print(f"📊 [MCP Timer] Initial tool list fetch (SSE handshake + list) took {duration:.2f}ms", flush=True)
            except Exception as e:
                logger.error("Failed to connect to MCP server on startup: %s", e)
                # Keep client structure but let it retry on get_mcp_tools calls
                if ALLOW_MCP_FALLBACK:
                    logger.warning("ALLOW_MCP_FALLBACK=true — will use fallback tools on error.")

    async def get_mcp_tools(self, force_refresh: bool = False) -> list[Any]:
        """Return the MCP tool list asynchronously using the persistent client connection."""
        now = time.monotonic()
        cache_is_fresh = (
            self._cached_tools is not None
            and not force_refresh
            and (now - self._cached_at) < MCP_TOOLS_CACHE_TTL_SECONDS
        )
        if cache_is_fresh and self._cached_tools is not None:
            # Cache hit is effectively free — logged so a slow request can
            # be confirmed as NOT coming from this layer, not just assumed.
            print("📊 [MCP Timer] Tool list served from cache (0ms, no network call)", flush=True)
            return self._cached_tools

        # Ensure client is initialized
        if not self.client:
            await self.initialize()

        try:
            if not self.client:
                raise RuntimeError("MCP client not initialized.")
            start = time.perf_counter()
            tools = await self.client.get_tools()
            duration = (time.perf_counter() - start) * 1000.0
            print(f"📊 [MCP Timer] Tool list cache MISS — live SSE fetch took {duration:.2f}ms", flush=True)
            self._cached_tools = tools
            self._cached_at = now
            return tools
        except Exception as exc:
            # Network hiccup or server restart: if we have a (possibly
            # stale-but-expired) cached copy, prefer serving that over
            # failing the whole request outright. But filter out WRITE/DESTRUCTIVE
            # tools to degrade to a safe read-only state.
            if self._cached_tools is not None:
                logger.warning(
                    "MCP refresh failed (%s); serving read-only cached tools.",
                    exc
                )
                from utils.tool_executor import get_tool_risk, ToolRisk
                return [
                    t for t in self._cached_tools
                    if get_tool_risk(getattr(t, "name", str(t))) == ToolRisk.READ
                ]

            logger.error("MCP server unreachable at %s: %s", self.server_url, exc)
            if ALLOW_MCP_FALLBACK:
                logger.warning("ALLOW_MCP_FALLBACK=true — using in-process tools for this call.")
                return self._get_fallback_mcp_tools()
            raise RuntimeError(
                f"Could not reach pet-platform-mcp-server at {self.server_url}. "
                "Tool calls are unavailable until the MCP server is reachable."
            ) from exc

    def invalidate_cache(self) -> None:
        """Force the next get_mcp_tools() call to hit the network."""
        self._cached_tools = None
        self._cached_at = 0.0

    def _get_fallback_mcp_tools(self) -> list[Any]:
        """Direct python tool wrappers for headless testing."""
        from langchain_core.tools import StructuredTool

        try:
            from tools.orders import tool_get_order_status, tool_get_order_tracking, tool_get_my_orders
            from tools.products import tool_search_products, tool_get_product_stock 
            from tools.bookings import tool_get_available_slots, tool_get_my_consultations, tool_get_my_pets
            from tools.actions import tool_book_consultation, tool_cancel_order, tool_cancel_consultation

            def safe_wrap(func: Any, name: str) -> Any:
                from unittest.mock import Mock
                if isinstance(func, Mock):
                    if name == "cancel_order":
                        def cancel_order(session_user_id: int, order_id: int, idempotency_key: str) -> Any:
                            """Cancel a pending or active order."""
                            return func(session_user_id, order_id, idempotency_key)
                        return cancel_order
                    elif name == "book_consultation":
                        def book_consultation(session_user_id: int, doctor_id: int, pet_id: int, scheduled_at_iso: str, reason: str, customer_notes: str | None = None) -> Any:
                            """Book a new consultation."""
                            return func(session_user_id, doctor_id, pet_id, scheduled_at_iso, reason, customer_notes)
                        return book_consultation
                    elif name == "cancel_consultation":
                        def cancel_consultation(session_user_id: int, consultation_id: int, idempotency_key: str) -> Any:
                            """Cancel a consultation booking."""
                            return func(session_user_id, consultation_id, idempotency_key)
                        return cancel_consultation
                    elif name == "get_my_orders":
                        # A mocked tool_get_my_orders (e.g. in a test that
                        # patches it directly rather than mocking the HTTP
                        # layer) reaches here via the same fresh `from
                        # tools.orders import ...` this function does — a
                        # bare Mock has no clean signature for
                        # StructuredTool.from_function() to introspect,
                        # which previously made the whole fallback tool
                        # list construction below raise and silently
                        # collapse to [] (empty), taking every other tool
                        # down with it.
                        def get_my_orders(session_user_id: int, limit: int = 10) -> Any:
                            """Get all past and current orders for the logged-in customer."""
                            return func(session_user_id, limit)
                        return get_my_orders
                    elif name == "get_order_status":
                        def get_order_status(session_user_id: int, order_id: int) -> Any:
                            """Get the current status, items, and details for an order."""
                            return func(session_user_id, order_id)
                        return get_order_status
                return func

            return [
                StructuredTool.from_function(func=safe_wrap(tool_get_order_status, "get_order_status"), name="get_order_status"),
                StructuredTool.from_function(func=safe_wrap(tool_get_order_tracking, "get_order_tracking"), name="get_order_tracking"),
                StructuredTool.from_function(func=safe_wrap(tool_get_my_orders, "get_my_orders"), name="get_my_orders"),
                StructuredTool.from_function(func=safe_wrap(tool_search_products, "search_products"), name="search_products"),
                StructuredTool.from_function(func=safe_wrap(tool_get_product_stock, "get_product_stock"), name="get_product_stock"),
                StructuredTool.from_function(func=safe_wrap(tool_get_available_slots, "get_available_slots"), name="get_available_slots"),
                StructuredTool.from_function(func=safe_wrap(tool_get_my_consultations, "get_my_consultations"), name="get_my_consultations"),
                StructuredTool.from_function(func=safe_wrap(tool_get_my_pets, "get_my_pets"), name="get_my_pets"),
                StructuredTool.from_function(func=safe_wrap(tool_book_consultation, "book_consultation"), name="book_consultation"),
                StructuredTool.from_function(func=safe_wrap(tool_cancel_order, "cancel_order"), name="cancel_order"),
                StructuredTool.from_function(func=safe_wrap(tool_cancel_consultation, "cancel_consultation"), name="cancel_consultation"),
            ]
        except Exception:
            return []


mcp_client = MCPClientManager()
