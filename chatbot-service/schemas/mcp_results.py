"""Typed contracts for MCP tool results.

Every tool call to pet-platform-mcp-server comes back wrapped in the same
{"ok", "data", "error", "request_id"} envelope (see
pet-platform-mcp-server/tools/_client.py::_handle) — this is uniform across
every tool, not something each caller should re-guess.

Parsing that envelope by hand at each call site is exactly how a real bug
shipped: code assumed a tool's data lived at the top level when it was
actually nested one level deeper under "data", and nothing checked that
assumption — it just silently returned empty/wrong values instead of erroring.

This module defines the envelope once, plus the specific payload shape for
each tool actually consumed here, and a single parse_mcp_result() every call
site should go through instead of ad-hoc dict/string parsing. A shape
mismatch now fails loudly (a clear, logged CONTRACT_VIOLATION) instead of
silently returning nothing.
"""

import json
import logging
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class MCPError(BaseModel):
    code: str
    message: str


class MCPEnvelope(BaseModel, Generic[T]):
    ok: bool
    data: T | None = None
    error: MCPError | None = None
    request_id: str | None = None


# --- Payload shapes for each tool result consumed by the commerce agent ---

class ProductRecord(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float = 0.0
    category_id: int | None = None
    in_stock: bool = True
    image_url: str | None = None


class ProductSearchData(BaseModel):
    total: int = 0
    page: int = 1
    products: list[ProductRecord] = []


class CancelOrderData(BaseModel):
    order_id: int
    status: str | None = None
    idempotency_key: str | None = None


class ConsultationActionData(BaseModel):
    """Shared shape for both book_consultation and cancel_consultation
    results — the backend returns the same {consultation_id, status} for
    both, only the idempotency_key is tacked on by the MCP tool wrapper."""

    consultation_id: int
    status: str | None = None
    idempotency_key: str | None = None


def parse_mcp_result(tool_res: Any, data_model: type[T]) -> tuple[T | None, MCPError | None]:
    """Validate a raw MCP tool result against the shared envelope plus a
    specific payload contract.

    Returns (data, error): exactly one is non-None. Any mismatch — invalid
    JSON, a missing envelope field, or a payload that doesn't match
    data_model — is treated as a contract violation and returned as a clear
    error instead of silently yielding empty/default data.
    """
    raw = tool_res
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception as exc:
            logger.warning("MCP result was not valid JSON: %s | raw=%r", exc, tool_res)
            return None, MCPError(
                code="CONTRACT_VIOLATION",
                message="Tool result was not valid JSON.",
            )

    try:
        envelope = MCPEnvelope[data_model].model_validate(raw)
    except ValidationError as exc:
        logger.warning(
            "MCP result did not match expected shape for %s: %s | raw=%r",
            data_model.__name__, exc, raw,
        )
        return None, MCPError(
            code="CONTRACT_VIOLATION",
            message=f"Unexpected response shape from tool (expected {data_model.__name__}).",
        )

    if not envelope.ok:
        return None, envelope.error or MCPError(
            code="UNKNOWN_ERROR",
            message="Tool call failed with no error detail.",
        )

    if envelope.data is None:
        return None, MCPError(
            code="EMPTY_RESPONSE",
            message="Tool reported success but returned no data.",
        )

    return envelope.data, None
