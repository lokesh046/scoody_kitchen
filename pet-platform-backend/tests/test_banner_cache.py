import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.cache import cache
from app.models.banner import Banner

client = TestClient(app)

DEFAULT_TEST_BANNERS = [
    {
        "title": "Welcome to Scooby's Kitchen",
        "subtitle": "Human-grade, small-batch recipes cooked for active pet health. Sourced with 100% transparent ingredients.",
        "image_url": "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=1200",
        "link_url": "/shop",
        "display_order": 1,
        "is_active": True,
    },
    {
        "title": "Honest Ingredients. Zero Filler.",
        "subtitle": "Every single recipe batch contains zero corn, wheat, soy, or rendering byproducts. Certified by pet nutritionists.",
        "image_url": "https://images.unsplash.com/photo-1589924691106-07a3c22a12e7?auto=format&fit=crop&q=80&w=1200",
        "link_url": "/shop",
        "display_order": 2,
        "is_active": True,
    },
    {
        "title": "Veterinary Audited Diets",
        "subtitle": "Schedule online consultations and log active nutritional diagnostics directly with certified pet doctors.",
        "image_url": "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=1200",
        "link_url": "/consultations",
        "display_order": 3,
        "is_active": True,
    },
]

@pytest.fixture(autouse=True)
def clean_cache_before_and_after():
    cache.clear()
    yield
    cache.clear()
    # Restore valid banners after tests run
    db = SessionLocal()
    try:
        db.query(Banner).delete()
        for b_data in DEFAULT_TEST_BANNERS:
            db.add(Banner(**b_data))
        db.commit()
    finally:
        db.close()

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
            image_url="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=1200",
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

