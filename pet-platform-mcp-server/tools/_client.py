"""Shared internal HTTP client for calling pet-platform-backend.

This is the ONLY way tools in this server talk to the backend — no direct
database access, no importing the backend's Python code. That keeps this a
real, independently-deployable service rather than a second process sharing
the backend's codebase and database connection.
"""

import os
from datetime import datetime, timedelta, timezone
import httpx
import jwt

BACKEND_URL = os.getenv("BACKEND_URL")
if not BACKEND_URL:
    raise RuntimeError("BACKEND_URL environment variable is not configured.")

MCP_INTERNAL_SECRET = os.getenv("MCP_INTERNAL_SECRET") or os.getenv("INTERNAL_SERVICE_API_KEY")
if not MCP_INTERNAL_SECRET:
    raise RuntimeError("MCP_INTERNAL_SECRET environment variable is not configured.")


def _get_headers() -> dict:
    """Generate dynamic X-Internal-Api-Key header using short-lived JWT."""
    payload = {
        "iss": "pet-platform-mcp-server",
        "exp": datetime.now(timezone.utc) + timedelta(seconds=60),
    }
    token = jwt.encode(payload, MCP_INTERNAL_SECRET, algorithm="HS256")
    return {"X-Internal-Api-Key": token}


def backend_get(path: str, params: dict | None = None) -> dict:
    if params:
        params = {k: v for k, v in params.items() if v is not None}
    resp = httpx.get(f"{BACKEND_URL}{path}", params=params, headers=_get_headers(), timeout=5.0)
    return _handle(resp)


def backend_post(path: str, params: dict | None = None) -> dict:
    if params:
        params = {k: v for k, v in params.items() if v is not None}
    resp = httpx.post(f"{BACKEND_URL}{path}", params=params, headers=_get_headers(), timeout=5.0)
    return _handle(resp)


def _handle(resp: httpx.Response) -> dict:
    request_id = resp.headers.get("x-request-id", "req_unknown")

    if resp.status_code == 400:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": resp.json().get("detail", "Validation failed.")
            },
            "request_id": request_id
        }
    if resp.status_code == 401:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "UNAUTHENTICATED",
                "message": "Authentication failed."
            },
            "request_id": request_id
        }
    if resp.status_code == 403:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "UNAUTHORIZED",
                "message": "Access denied: this resource does not belong to the acting user."
            },
            "request_id": request_id
        }
    if resp.status_code == 404:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "NOT_FOUND",
                "message": resp.json().get("detail", "The requested resource could not be found.")
            },
            "request_id": request_id
        }
    if resp.status_code == 409:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "CONFLICT",
                "message": resp.json().get("detail", "A conflict occurred.")
            },
            "request_id": request_id
        }
    if resp.status_code == 422:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "UNPROCESSABLE_ENTITY",
                "message": resp.json().get("detail", "Unprocessable parameters.")
            },
            "request_id": request_id
        }
    if resp.status_code == 429:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please try again later."
            },
            "request_id": request_id
        }
    if resp.status_code >= 400:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "The backend service is temporarily unavailable."
            },
            "request_id": request_id
        }

    try:
        data = resp.json()
        return {
            "ok": True,
            "data": data,
            "error": None,
            "request_id": request_id
        }
    except Exception:
        return {
            "ok": True,
            "data": {"text": resp.text},
            "error": None,
            "request_id": request_id
        }
