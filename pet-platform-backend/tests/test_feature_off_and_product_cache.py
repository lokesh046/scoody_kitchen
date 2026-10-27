"""Background jobs stand down when their feature is off, and the product caches clear
themselves whenever products, stock or product reviews change."""
import uuid
from decimal import Decimal

import pytest

from app.core.cache import cache
from app.core.database import SessionLocal
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.product import Product
from app.services import feature_flag_service as ffs


# ---- is_feature_enabled -----------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clean_flag_cache():
    cache.delete(ffs.PUBLIC_FLAGS_CACHE_KEY)
    yield
    cache.delete(ffs.PUBLIC_FLAGS_CACHE_KEY)


def _prime(flags):
    cache.set(ffs.PUBLIC_FLAGS_CACHE_KEY, flags, ttl_seconds=60)


def test_feature_off_is_read_from_cache_without_database(monkeypatch):
    _prime({"consultations_booking": {"enabled": False, "fallback_behavior": "hide"}})

    def no_db(*a, **k):
        raise AssertionError("database must not be touched when the flags are cached")

    monkeypatch.setattr("app.core.database.SessionLocal", no_db)
    assert ffs.is_feature_enabled("consultations_booking") is False


def test_feature_on_missing_key_and_cache_miss_default_to_enabled():
    _prime({"consultations_booking": {"enabled": True, "fallback_behavior": "hide"}})
    assert ffs.is_feature_enabled("consultations_booking") is True
    assert ffs.is_feature_enabled("some_unknown_flag") is True


def test_flag_lookup_failure_fails_open(monkeypatch):
    def broken(*a, **k):
        raise RuntimeError("database down")

    monkeypatch.setattr("app.core.database.SessionLocal", broken)
    assert ffs.is_feature_enabled("consultations_booking") is True
    assert ffs.is_feature_enabled("consultations_booking", default=False) is False


# ---- the consultation job stands down when the feature is off ---------------------------

def test_consultation_job_skips_everything_when_off(monkeypatch):
    from app.tasks import notification_tasks as nt

    _prime({"consultations_booking": {"enabled": False, "fallback_behavior": "hide"}})

    def boom(*a, **k):
        raise AssertionError("no database connection while the feature is off")

    monkeypatch.setattr(nt, "SessionLocal", boom)
    assert nt.check_and_complete_expired_consultations_task() == 0


def test_consultation_job_runs_when_on(monkeypatch):
    from app.tasks import notification_tasks as nt

    _prime({"consultations_booking": {"enabled": True, "fallback_behavior": "hide"}})
    opened = []

    class FakeDb:
        def close(self):
            pass

    monkeypatch.setattr(nt, "SessionLocal", lambda: opened.append(1) or FakeDb())
    monkeypatch.setattr("app.services.consultation_service.auto_complete_expired_consultations", lambda db: [])
    assert nt.check_and_complete_expired_consultations_task() == 0
    assert opened == [1]


# ---- product caches clear on commit -----------------------------------------------------

@pytest.fixture()
def product_with_stock():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    category = Category(name=f"zz-test-cat-{suffix}")
    db.add(category)
    db.flush()
    product = Product(
        category_id=category.id,
        name=f"zz-test-product-{suffix}",
        sku=f"ZZ-TEST-{suffix}",
        price=Decimal("10.00"),
    )
    db.add(product)
    db.flush()
    db.add(Inventory(product_id=product.id, stock_quantity=10, reserved_quantity=0))
    db.commit()
    ids = (category.id, product.id)
    yield db, product.id
    db.rollback()
    db.query(Inventory).filter(Inventory.product_id == ids[1]).delete()
    db.query(Product).filter(Product.id == ids[1]).delete()
    db.query(Category).filter(Category.id == ids[0]).delete()
    db.commit()
    db.close()


def _fill():
    cache.set("products:test-list", {"items": []}, ttl_seconds=600)
    cache.set("product:detail:test", {"id": 1}, ttl_seconds=600)


def _filled():
    return cache.get("products:test-list") is not None and cache.get("product:detail:test") is not None


def test_stock_change_clears_product_caches(product_with_stock):
    db, product_id = product_with_stock
    _fill()
    inventory = db.query(Inventory).filter(Inventory.product_id == product_id).one()
    inventory.reserved_quantity += 1  # what checkout does
    db.commit()
    assert cache.get("products:test-list") is None
    assert cache.get("product:detail:test") is None


def test_rolled_back_change_keeps_caches(product_with_stock):
    db, product_id = product_with_stock
    _fill()
    inventory = db.query(Inventory).filter(Inventory.product_id == product_id).one()
    inventory.stock_quantity = 99
    db.flush()
    db.rollback()
    assert _filled()
    cache.delete("products:test-list")
    cache.delete("product:detail:test")


def test_unrelated_commit_keeps_caches(product_with_stock):
    db, _ = product_with_stock
    _fill()
    from app.models.faq import FAQ

    faq = FAQ(question="zz test", answer="zz test", page="home")
    db.add(faq)
    db.commit()
    still = _filled()
    db.delete(faq)
    db.commit()
    assert still
    cache.delete("products:test-list")
    cache.delete("product:detail:test")
