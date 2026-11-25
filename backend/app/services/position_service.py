from collections.abc import Callable
from datetime import datetime, timezone
from typing import Protocol

from app.core.cache import TTLCache
from app.models.position import Aircraft, PositionResponse, PositionSnapshot


class PositionSource(Protocol):
    async def get_by_callsign(self, callsign: str) -> Aircraft | None: ...


class PositionService:
    """Serves an aircraft's live position by callsign through a short TTL cache.

    The source allows a few hundred requests a day for the whole app, so
    every viewer of the same flight shares one lookup per TTL, and "nothing
    transmitting that callsign" is cached the same way.
    """

    def __init__(
        self,
        source: PositionSource,
        cache: TTLCache[PositionSnapshot],
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._source = source
        self._cache = cache
        self._clock = clock

    async def get_position(self, callsign: str) -> PositionResponse:
        key = callsign.strip().upper()
        snapshot = self._cache.get(key)
        cached = snapshot is not None
        if snapshot is None:
            aircraft = await self._source.get_by_callsign(key)
            snapshot = PositionSnapshot(aircraft=aircraft, fetched_at=self._now())
            self._cache.set(key, snapshot)
        return PositionResponse(
            callsign=key,
            fetched_at=snapshot.fetched_at,
            cached=cached,
            aircraft=snapshot.aircraft,
        )

    def _now(self) -> datetime:
        return self._clock() if self._clock is not None else datetime.now(timezone.utc)
