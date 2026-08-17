import time
import pytest
from app.core.cache import InMemoryTTLCache, RedisCacheManager, cache


def test_in_memory_cache_set_and_get():
    c = InMemoryTTLCache(default_ttl_seconds=60)
    c.set("key1", "value1")
    assert c.get("key1") == "value1"


def test_in_memory_cache_ttl_expiration():
    c = InMemoryTTLCache(default_ttl_seconds=1)
    c.set("key_short", "temp_value", ttl_seconds=1)
    assert c.get("key_short") == "temp_value"
    time.sleep(1.1)
    assert c.get("key_short") is None


def test_in_memory_cache_delete_and_clear_prefix():
    c = InMemoryTTLCache()
    c.set("products:1", "p1")
    c.set("products:2", "p2")
    c.set("categories:all", "cats")

    assert c.get("products:1") == "p1"
    c.delete("products:1")
    assert c.get("products:1") is None

    c.clear_prefix("products:")
    assert c.get("products:2") is None
    assert c.get("categories:all") == "cats"


def test_redis_cache_manager_set_get_and_clear_prefix():
    mgr = RedisCacheManager(default_ttl_seconds=60)
    mgr.set("products:test_1", {"id": 1, "name": "Dog Food"})
    assert mgr.get("products:test_1") == {"id": 1, "name": "Dog Food"}

    mgr.delete("products:test_1")
    assert mgr.get("products:test_1") is None

    mgr.set("products:test_2", "item2")
    mgr.set("categories:test_all", "cats")
    mgr.clear_prefix("products:")

    assert mgr.get("products:test_2") is None
    assert mgr.get("categories:test_all") == "cats"
    mgr.delete("categories:test_all")
