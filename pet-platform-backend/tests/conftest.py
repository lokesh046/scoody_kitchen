"""Safety guard: the test suite writes real rows and clears cache keys, so it must only
ever run against a local database and a local Redis.

The backend reads DATABASE_URL and REDIS_URL from .env, and in this project that file points
at the production Neon database. Without this guard, `pytest` quietly ran against production.
Point the tests at the local containers instead, for example:

    DATABASE_URL=postgresql+psycopg://pet_user:<password>@127.0.0.1:5432/pet_platform \
    REDIS_URL=redis://localhost:6379/0 pytest

Set ALLOW_REMOTE_TEST_DB=1 only if you really mean to test against a remote database.
"""
import os
from urllib.parse import urlparse

import pytest

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "hearth-local-pg"}


def _host(url: str | None) -> str | None:
    if not url:
        return None
    return urlparse(url.replace("postgresql+psycopg", "postgresql")).hostname


def pytest_configure(config):
    if os.getenv("ALLOW_REMOTE_TEST_DB") == "1":
        return
    from app.core.config import settings

    db_host = _host(settings.DATABASE_URL)
    redis_host = _host(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    problems = []
    if db_host not in _LOCAL_HOSTS:
        problems.append(f"DATABASE_URL points at '{db_host}'")
    if redis_host not in _LOCAL_HOSTS:
        problems.append(f"REDIS_URL points at '{redis_host}'")
    if problems:
        raise pytest.UsageError(
            "Refusing to run tests: " + "; ".join(problems) + ". The tests write data and clear caches, "
            "so they must use local services. See tests/conftest.py for how to point them at the local "
            "database, or set ALLOW_REMOTE_TEST_DB=1 to override."
        )
