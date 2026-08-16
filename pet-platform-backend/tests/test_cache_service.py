import time
import pytest
from app.core.cache import InMemoryTTLCache, cache


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
