import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from functools import partial

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

    Requests that miss the cache for the same key at the same time share one
    provider call instead of each making their own (see ``_get_snapshot``).
    Like the cache, this only holds within one process.

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
        # The provider call currently running for each cache key, if any.
        self._in_flight: dict[str, asyncio.Task[FlightSnapshot]] = {}

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

        On a miss the caller joins the fetch already running for the key, or
        starts one when there is none, so requests that overlap on a cold key
        cost a single provider call. Everyone who shared that call gets its
        snapshot, and so the same ``fetched_at``, reported as not cached; if
        it failed, everyone gets its exception.
        """
        cached_snapshot = self._cache.get(cache_key)
        if cached_snapshot is not None:
            return cached_snapshot, True

        task = self._in_flight.get(cache_key)
        # A finished task can still be listed for an instant, until its done
        # callback runs. Joining it would hand this request an old outcome.
        if task is None or task.done():
            task = self._start_fetch(cache_key, fetch)
        # wait() leaves the task running if this caller is cancelled (awaiting
        # the task directly would cancel it for everyone), and unlike shield()
        # it never logs the task's failure on a cancelled caller's behalf.
        await asyncio.wait([task])
        return task.result(), False

    def _start_fetch(
        self,
        cache_key: str,
        fetch: Callable[[], Awaitable[list[Flight]]],
    ) -> asyncio.Task[FlightSnapshot]:
        """Start the provider call for ``cache_key`` in a task of its own.

        The fetch belongs to no single request: it carries on, and fills the
        cache, even if the request that started it is cancelled.
        """
        task = asyncio.create_task(self._fetch_snapshot(cache_key, fetch))
        self._in_flight[cache_key] = task
        task.add_done_callback(partial(self._forget_fetch, cache_key))
        return task

    async def _fetch_snapshot(
        self,
        cache_key: str,
        fetch: Callable[[], Awaitable[list[Flight]]],
    ) -> FlightSnapshot:
        """Await ``fetch`` and cache its result with the time it completed.

        A failure propagates to the callers waiting on the task and nothing
        is cached.
        """
        flights = await fetch()
        snapshot = FlightSnapshot(flights=flights, fetched_at=self._now())
        self._cache.set(cache_key, snapshot)
        return snapshot

    def _forget_fetch(self, cache_key: str, task: asyncio.Task[FlightSnapshot]) -> None:
        """Drop a finished fetch, however it ended: result, error or cancelled."""
        # Only if the key still points at this task: a newer fetch may have
        # replaced it between the task finishing and this callback running.
        if self._in_flight.get(cache_key) is task:
            del self._in_flight[cache_key]
        if not task.cancelled():
            # Callers read a failure from the task themselves. When they were
            # all cancelled first nobody does, and asyncio would report "Task
            # exception was never retrieved"; reading it here prevents that.
            task.exception()

    def _now(self) -> datetime:
        return datetime.now(timezone.utc) if self._clock is None else self._clock()
