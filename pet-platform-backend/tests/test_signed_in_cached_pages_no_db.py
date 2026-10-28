"""A signed-in visitor opening cached public pages must not query the database.

These endpoints used to look the visitor up in the database before checking their cache, so every
signed-in click woke the Neon compute even when the response came straight from Redis."""
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.core.cache import cache
from app.core.config import settings
from app.core.database import engine
from app.main import app

client = TestClient(app)


def _token(role="customer", token_type="access", secret=None):
    return jwt.encode(
        {"sub": "987654321", "role": role, "type": token_type},
        secret or settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


class Counter:
    def __init__(self):
        self.n = 0

    def __call__(self, *a, **k):
        self.n += 1


@pytest.fixture()
def statements():
    counter = Counter()
    event.listen(engine, "before_cursor_execute", counter)
    yield counter
    event.remove(engine, "before_cursor_execute", counter)


@pytest.fixture(autouse=True)
def _clean():
    for p in ("products:", "product:detail:", "categories:"):
        cache.clear_prefix(p)
    yield
    for p in ("products:", "product:detail:", "categories:"):
        cache.clear_prefix(p)


@pytest.mark.parametrize("path", ["/categories", "/categories/tree", "/product?limit=6"])
@pytest.mark.parametrize("role", [None, "customer", "admin"])
def test_second_visit_costs_no_database_statement(path, role, statements):
    headers = {"Authorization": f"Bearer {_token(role)}"} if role else {}
    assert client.get(path, headers=headers).status_code == 200  # first visit may fill the cache
    before = statements.n
    assert client.get(path, headers=headers).status_code == 200
    assert statements.n == before, f"{path} as {role} ran {statements.n - before} statement(s) on a cached visit"


def test_role_reader():
    from starlette.requests import Request
    from app.dependencies.auth import get_optional_role

    def req(token=None):
        headers = [(b"authorization", f"Bearer {token}".encode())] if token else []
        return Request({"type": "http", "headers": headers})

    assert get_optional_role(req()) is None
    assert get_optional_role(req(_token("admin"))) == "admin"
    assert get_optional_role(req(_token("customer"))) == "customer"
    assert get_optional_role(req(_token("admin", token_type="refresh"))) is None
    assert get_optional_role(req(_token("admin", secret="x" * 40))) is None
    assert get_optional_role(req("garbage")) is None
