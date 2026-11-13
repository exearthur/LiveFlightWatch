import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")

DEFAULT_MAX_ENTRIES = 256


@dataclass
class _Entry(Generic[T]):
    value: T
    expires_at: float


class TTLCache(Generic[T]):
    """Minimal in-process TTL cache, bounded to ``max_entries`` entries.

    Not safe to share across multiple uvicorn workers/processes — each process
    gets its own cache.

    The bound is enforced on write: storing a new key in a full cache evicts
    exactly one entry first. The victim is the least recently used entry that
    has already expired, or the least recently used entry overall when none
    has. A ``get`` hit and any ``set`` count as use. Expired entries are
    otherwise left in place until they are read or their slot is needed, so
    they always count towards ``max_entries``.
    """

    def __init__(
        self,
        ttl_seconds: int,
        max_entries: int = DEFAULT_MAX_ENTRIES,
        clock: Callable[[], float] | None = None,
    ) -> None:
        if max_entries < 1:
            raise ValueError(f"max_entries must be at least 1, got {max_entries}")
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._clock = clock
        # Ordered from least to most recently used.
        self._store: OrderedDict[str, _Entry[T]] = OrderedDict()

    @property
    def max_entries(self) -> int:
        return self._max_entries

    def __len__(self) -> int:
        """Number of stored entries, including expired ones not yet evicted."""
        return len(self._store)

    def get(self, key: str) -> T | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        if self._now() >= entry.expires_at:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return entry.value

    def set(self, key: str, value: T) -> None:
        now = self._now()
        if key not in self._store:
            while len(self._store) >= self._max_entries:
                self._evict_one(now)
        self._store[key] = _Entry(value=value, expires_at=now + self._ttl_seconds)
        self._store.move_to_end(key)

    def _now(self) -> float:
        # time.monotonic is resolved per call, not bound as a default argument,
        # so patching it still works when no clock is injected.
        return time.monotonic() if self._clock is None else self._clock()

    def _evict_one(self, now: float) -> None:
        for key, entry in self._store.items():
            if now >= entry.expires_at:
                del self._store[key]
                return
        self._store.popitem(last=False)
