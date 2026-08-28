import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.cache import cache
from app.models.banner import Banner

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_cache_before_and_after():
    cache.clear()
    yield
    cache.clear()

def test_banner_caching_and_invalidation():
    # 1. Clear any active banners from db first so we have a clean test state
    db = SessionLocal()
    try:
        db.query(Banner).delete()
        db.commit()
    finally:
        db.close()

    # 2. Add an active banner to DB
    db = SessionLocal()
    try:
        banner = Banner(
            title="Initial Banner",
            subtitle="Promo 1",
            image_url="http://test.com/img1.jpg",
            display_order=1,
            is_active=True
        )
        db.add(banner)
        db.commit()
        db.refresh(banner)
        banner_id = banner.id
    finally:
        db.close()

    # 3. Call GET /banners/ -> Should be a cache MISS first, then set in cache
    res1 = client.get("/banners/")
    assert res1.status_code == 200
    data1 = res1.json()
    assert len(data1) == 1
    assert data1[0]["title"] == "Initial Banner"

    # Verify key is set in cache
    assert cache.get("banners:active") is not None

    # 4. Modify the banner in the DB directly (bypassing API)
    db = SessionLocal()
    try:
        db_banner = db.get(Banner, banner_id)
        db_banner.title = "Direct DB Edit Title"
        db.commit()
    finally:
        db.close()

    # 5. Call GET /banners/ again -> Should fetch from CACHE (return old title "Initial Banner")
    res2 = client.get("/banners/")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2[0]["title"] == "Initial Banner"

    # 6. Delete the cache key (simulating invalidation)
    cache.delete("banners:active")

    # 7. Call GET /banners/ again -> Should fetch from DB (return updated title "Direct DB Edit Title")
    res3 = client.get("/banners/")
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3[0]["title"] == "Direct DB Edit Title"
