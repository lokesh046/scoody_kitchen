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

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
INTERNAL_SERVICE_API_KEY = os.getenv("INTERNAL_SERVICE_API_KEY", "")


def _get_headers() -> dict:
    """Generate dynamic X-Internal-Api-Key header using short-lived JWT."""
    payload = {
        "iss": "pet-platform-mcp-server",
        "exp": datetime.now(timezone.utc) + timedelta(seconds=60),
    }
    token = jwt.encode(payload, INTERNAL_SERVICE_API_KEY, algorithm="HS256")
    return {"X-Internal-Api-Key": token}


def backend_get(path: str, params: dict | None = None) -> dict:
    resp = httpx.get(f"{BACKEND_URL}{path}", params=params, headers=_get_headers(), timeout=5.0)
    return _handle(resp)


def backend_post(path: str, params: dict | None = None) -> dict:
    resp = httpx.post(f"{BACKEND_URL}{path}", params=params, headers=_get_headers(), timeout=5.0)
    return _handle(resp)


def _handle(resp: httpx.Response) -> dict:
    if resp.status_code == 404:
        return {"error": resp.json().get("detail", "Not found.")}
    if resp.status_code == 403:
        return {"error": "Access denied: this resource does not belong to the acting user."}
    if resp.status_code >= 400:
        return {"error": f"Backend error ({resp.status_code}): {resp.text}"}
    return resp.json()
