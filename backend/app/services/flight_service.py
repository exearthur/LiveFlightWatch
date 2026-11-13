from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from app.core.cache import TTLCache
from app.models.flight import (
    Flight,
    FlightLookupResponse,
    FlightSnapshot,
    FlightsResponse,
    FlightType,
)
from app.providers.base import FlightProvider


class FlightService:
    """Serves flight data from the provider through a TTL cache.

    The cache holds ``FlightSnapshot`` records, so the time a result was
    fetched travels with it and a cache hit reports that time, not the time
    of the request.

    ``clock`` supplies the wall-clock time stamped on each fetch. It defaults
    to the current UTC time and exists so tests can control it. It is
    separate from the cache's own monotonic clock, which only decides expiry.
    """

    def __init__(
        self,
        provider: FlightProvider,
        cache: TTLCache[FlightSnapshot],
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._provider = provider
        self._cache = cache
        self._clock = clock

    async def get_flights(self, airport: str, flight_type: FlightType) -> FlightsResponse:
        snapshot, cached = await self._get_snapshot(
            f"{airport}:{flight_type}",
            lambda: self._provider.get_flights(airport, flight_type),
        )
        return FlightsResponse(
            airport=airport,
            type=flight_type,
            fetched_at=snapshot.fetched_at,
            cached=cached,
            flights=snapshot.flights,
        )

    async def get_flight_by_number(self, flight_number: str) -> FlightLookupResponse:
        snapshot, cached = await self._get_snapshot(
            f"lookup:{flight_number}",
            lambda: self._provider.get_flight_by_number(flight_number),
        )
        return FlightLookupResponse(
            flight_number=flight_number,
            fetched_at=snapshot.fetched_at,
            cached=cached,
            flights=snapshot.flights,
        )

    async def _get_snapshot(
        self,
        cache_key: str,
        fetch: Callable[[], Awaitable[list[Flight]]],
    ) -> tuple[FlightSnapshot, bool]:
        """Return the snapshot for ``cache_key`` and whether it came from cache.

        On a miss, ``fetch`` is awaited and its result is cached together
        with the time it completed.
        """
        cached_snapshot = self._cache.get(cache_key)
        if cached_snapshot is not None:
            return cached_snapshot, True

        flights = await fetch()
        snapshot = FlightSnapshot(flights=flights, fetched_at=self._now())
        self._cache.set(cache_key, snapshot)
        return snapshot, False

    def _now(self) -> datetime:
        return datetime.now(timezone.utc) if self._clock is None else self._clock()
