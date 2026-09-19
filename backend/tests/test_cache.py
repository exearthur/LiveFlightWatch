from unittest.mock import patch

from app.core.cache import TTLCache


def test_set_then_get_returns_value():
    cache: TTLCache[str] = TTLCache(ttl_seconds=60)

    cache.set("key", "value")

    assert cache.get("key") == "value"


def test_unset_key_returns_none():
    cache: TTLCache[str] = TTLCache(ttl_seconds=60)

    assert cache.get("missing-key") is None


def test_entry_still_valid_before_ttl_elapses():
    cache: TTLCache[str] = TTLCache(ttl_seconds=10)

    with patch("app.core.cache.time.monotonic") as mock_monotonic:
        mock_monotonic.return_value = 1_000.0
        cache.set("key", "value")

        mock_monotonic.return_value = 1_005.0
        assert cache.get("key") == "value"


def test_expired_entry_returns_none():
    cache: TTLCache[str] = TTLCache(ttl_seconds=10)

    with patch("app.core.cache.time.monotonic") as mock_monotonic:
        mock_monotonic.return_value = 1_000.0
        cache.set("key", "value")

        # exactly at expiry: get() uses >=, so this counts as expired
        mock_monotonic.return_value = 1_010.0
        assert cache.get("key") is None


def test_expired_entry_is_evicted_from_store():
    cache: TTLCache[str] = TTLCache(ttl_seconds=10)

    with patch("app.core.cache.time.monotonic") as mock_monotonic:
        mock_monotonic.return_value = 1_000.0
        cache.set("key", "value")

        mock_monotonic.return_value = 2_000.0
        assert cache.get("key") is None
        # entry should have been removed, not just reported as missing
        assert "key" not in cache._store
