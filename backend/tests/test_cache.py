from unittest.mock import patch

import pytest

from app.core.cache import DEFAULT_MAX_ENTRIES, TTLCache


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


class FakeClock:
    """Injectable stand-in for time.monotonic that only moves when told to."""

    def __init__(self, now: float = 1_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def test_injected_clock_drives_expiry() -> None:
    clock = FakeClock()
    cache: TTLCache[str] = TTLCache(ttl_seconds=10, clock=clock)
    cache.set("key", "value")

    clock.advance(9)
    assert cache.get("key") == "value"

    clock.advance(1)
    assert cache.get("key") is None


def test_max_entries_defaults_to_default_max_entries() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60)

    assert cache.max_entries == DEFAULT_MAX_ENTRIES


@pytest.mark.parametrize("max_entries", [0, -1])
def test_max_entries_below_one_is_rejected(max_entries: int) -> None:
    with pytest.raises(ValueError, match="max_entries must be at least 1"):
        TTLCache(ttl_seconds=60, max_entries=max_entries)


def test_exceeding_max_entries_evicts_least_recently_used_entry() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, max_entries=2, clock=FakeClock())
    cache.set("a", "1")
    cache.set("b", "2")

    cache.set("c", "3")

    assert len(cache) == 2
    assert cache.get("a") is None
    assert cache.get("b") == "2"
    assert cache.get("c") == "3"


def test_cache_never_holds_more_than_max_entries() -> None:
    cache: TTLCache[int] = TTLCache(ttl_seconds=60, max_entries=3, clock=FakeClock())

    for i in range(50):
        cache.set(f"key-{i}", i)
        assert len(cache) <= 3

    # only the three most recently written keys survive
    assert [cache.get(f"key-{i}") for i in range(46, 50)] == [None, 47, 48, 49]


def test_max_entries_of_one_keeps_only_the_latest_entry() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, max_entries=1, clock=FakeClock())

    cache.set("a", "1")
    cache.set("b", "2")

    assert len(cache) == 1
    assert cache.get("a") is None
    assert cache.get("b") == "2"


def test_get_hit_protects_entry_from_eviction() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, max_entries=2, clock=FakeClock())
    cache.set("a", "1")
    cache.set("b", "2")

    # "a" is the oldest write, but reading it makes "b" the least recently used
    assert cache.get("a") == "1"
    cache.set("c", "3")

    assert cache.get("a") == "1"
    assert cache.get("b") is None
    assert cache.get("c") == "3"


def test_get_miss_does_not_change_eviction_order() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, max_entries=2, clock=FakeClock())
    cache.set("a", "1")
    cache.set("b", "2")

    assert cache.get("missing-key") is None
    cache.set("c", "3")

    assert len(cache) == 2
    assert cache.get("a") is None
    assert cache.get("b") == "2"


def test_overwriting_existing_key_does_not_grow_or_evict() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, max_entries=2, clock=FakeClock())
    cache.set("a", "1")
    cache.set("b", "2")

    cache.set("a", "updated")

    assert len(cache) == 2
    assert cache.get("a") == "updated"
    assert cache.get("b") == "2"


def test_overwriting_existing_key_protects_it_from_eviction() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, max_entries=2, clock=FakeClock())
    cache.set("a", "1")
    cache.set("b", "2")

    cache.set("a", "updated")
    cache.set("c", "3")

    assert cache.get("a") == "updated"
    assert cache.get("b") is None
    assert cache.get("c") == "3"


def test_overwriting_existing_key_restarts_its_ttl() -> None:
    clock = FakeClock()
    cache: TTLCache[str] = TTLCache(ttl_seconds=10, clock=clock)
    cache.set("key", "value")

    clock.advance(8)
    cache.set("key", "updated")

    clock.advance(8)
    assert cache.get("key") == "updated"


def test_get_hit_does_not_extend_ttl() -> None:
    clock = FakeClock()
    cache: TTLCache[str] = TTLCache(ttl_seconds=10, clock=clock)
    cache.set("key", "value")

    clock.advance(8)
    assert cache.get("key") == "value"

    clock.advance(2)
    assert cache.get("key") is None


def test_expired_entry_is_evicted_before_a_live_one() -> None:
    clock = FakeClock()
    cache: TTLCache[str] = TTLCache(ttl_seconds=10, max_entries=2, clock=clock)
    cache.set("a", "1")
    clock.advance(8)
    cache.set("b", "2")
    # "a" is now the most recently used entry and "b" the least
    assert cache.get("a") == "1"

    # "a" has expired, "b" has not: "a" goes even though "b" is older in LRU order
    clock.advance(4)
    cache.set("c", "3")

    assert "a" not in cache._store
    assert cache.get("b") == "2"
    assert cache.get("c") == "3"


def test_only_one_expired_entry_is_evicted_per_new_key() -> None:
    clock = FakeClock()
    cache: TTLCache[str] = TTLCache(ttl_seconds=10, max_entries=3, clock=clock)
    cache.set("a", "1")
    cache.set("b", "2")
    cache.set("c", "3")

    # all three have expired; a new key takes the least recently used one's slot
    clock.advance(100)
    cache.set("d", "4")

    assert list(cache._store) == ["b", "c", "d"]


def test_expired_entry_is_kept_while_there_is_room() -> None:
    clock = FakeClock()
    cache: TTLCache[str] = TTLCache(ttl_seconds=10, max_entries=3, clock=clock)
    cache.set("a", "1")

    clock.advance(100)
    cache.set("b", "2")

    # writes do not sweep: the expired entry still occupies a slot...
    assert "a" in cache._store
    assert len(cache) == 2
    # ...but it is never returned, and reading it drops it
    assert cache.get("a") is None
    assert len(cache) == 1
