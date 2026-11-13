import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone

import pytest

from app.core.cache import TTLCache
from app.models.flight import (
    Airport,
    Flight,
    FlightLookupResponse,
    FlightSnapshot,
    FlightsResponse,
    FlightType,
)
from app.providers.base import FlightProvider
from app.services.flight_service import FlightService


class FakeProvider(FlightProvider):
    """A FlightProvider stand-in that records how many times it was called,
    so tests can assert whether the cache was used."""

    def __init__(self, flights: list[Flight]):
        self._flights = flights
        self.call_count = 0
        self.lookup_call_count = 0

    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        self.call_count += 1
        return self._flights

    async def get_flight_by_number(self, flight_number: str) -> list[Flight]:
        self.lookup_call_count += 1
        return self._flights


def _make_flight(flight_number: str = "AA1") -> Flight:
    return Flight(
        flight_number=flight_number,
        airline="Test Air",
        origin=Airport(iata="JFK"),
        destination=Airport(iata="LAX"),
        status="scheduled",
    )


def test_first_call_is_a_cache_miss_and_hits_the_provider():
    provider = FakeProvider([_make_flight()])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    response = asyncio.run(service.get_flights("JFK", "departures"))

    assert response.cached is False
    assert provider.call_count == 1
    assert len(response.flights) == 1


def test_second_call_within_ttl_is_served_from_cache():
    provider = FakeProvider([_make_flight()])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    first = asyncio.run(service.get_flights("JFK", "departures"))
    second = asyncio.run(service.get_flights("JFK", "departures"))

    assert first.cached is False
    assert second.cached is True
    # the provider must NOT be called again on a cache hit
    assert provider.call_count == 1
    assert second.flights == first.flights


def test_different_cache_keys_each_trigger_their_own_fetch():
    provider = FakeProvider([_make_flight()])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    asyncio.run(service.get_flights("JFK", "departures"))
    asyncio.run(service.get_flights("JFK", "arrivals"))
    asyncio.run(service.get_flights("LAX", "departures"))

    assert provider.call_count == 3


def test_expired_cache_entry_triggers_another_provider_call():
    provider = FakeProvider([_make_flight()])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    asyncio.run(service.get_flights("JFK", "departures"))

    # simulate TTL expiry by clearing the cache directly, the same
    # observable effect as time passing beyond the TTL
    cache._store.clear()

    response = asyncio.run(service.get_flights("JFK", "departures"))

    assert response.cached is False
    assert provider.call_count == 2


# --- get_flight_by_number() -------------------------------------------------


def test_lookup_first_call_is_a_cache_miss_and_hits_the_provider():
    provider = FakeProvider([_make_flight("DL2042")])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    response = asyncio.run(service.get_flight_by_number("DL2042"))

    assert response.cached is False
    assert response.flight_number == "DL2042"
    assert provider.lookup_call_count == 1
    assert len(response.flights) == 1


def test_lookup_second_call_within_ttl_is_served_from_cache():
    provider = FakeProvider([_make_flight("DL2042")])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    first = asyncio.run(service.get_flight_by_number("DL2042"))
    second = asyncio.run(service.get_flight_by_number("DL2042"))

    assert first.cached is False
    assert second.cached is True
    assert provider.lookup_call_count == 1
    assert second.flights == first.flights


def test_lookup_and_airport_search_use_independent_cache_keys():
    provider = FakeProvider([_make_flight("DL2042")])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    asyncio.run(service.get_flights("JFK", "departures"))
    asyncio.run(service.get_flight_by_number("DL2042"))

    assert provider.call_count == 1
    assert provider.lookup_call_count == 1


def test_lookup_with_no_matching_flights_returns_empty_list_not_error():
    provider = FakeProvider([])
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    response = asyncio.run(service.get_flight_by_number("ZZ9999"))

    assert response.cached is False
    assert response.flights == []


# --- fetched_at -------------------------------------------------------------

CACHE_TTL_SECONDS = 300
START = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


class FakeTime:
    """One controllable time source for both clocks behind a response: the
    cache's monotonic clock (expiry) and the service's wall clock
    (``fetched_at``). Neither moves until ``advance`` is called."""

    def __init__(self) -> None:
        self._elapsed = 0.0

    def monotonic(self) -> float:
        return 1_000.0 + self._elapsed

    def wall(self) -> datetime:
        return START + timedelta(seconds=self._elapsed)

    def advance(self, seconds: float) -> None:
        self._elapsed += seconds


def _make_timed_service(
    fake_time: FakeTime, provider: FlightProvider | None = None
) -> FlightService:
    cache: TTLCache[FlightSnapshot] = TTLCache(
        ttl_seconds=CACHE_TTL_SECONDS, clock=fake_time.monotonic
    )
    return FlightService(
        provider=provider or FakeProvider([_make_flight()]),
        cache=cache,
        clock=fake_time.wall,
    )


Request = Callable[[FlightService], Awaitable[FlightsResponse | FlightLookupResponse]]

# The airport search and the flight-number lookup must report fetch times the
# same way, so every fetched_at test below runs against both.
both_paths = pytest.mark.parametrize(
    "request_flights",
    [
        pytest.param(lambda service: service.get_flights("JFK", "departures"), id="airport"),
        pytest.param(lambda service: service.get_flight_by_number("DL2042"), id="lookup"),
    ],
)


@both_paths
def test_cache_miss_reports_the_time_of_the_fetch(request_flights: Request) -> None:
    fake_time = FakeTime()
    service = _make_timed_service(fake_time)
    fake_time.advance(30)

    response = asyncio.run(request_flights(service))

    assert response.cached is False
    assert response.fetched_at == START + timedelta(seconds=30)


@both_paths
def test_cache_hit_reports_the_original_fetch_time(request_flights: Request) -> None:
    fake_time = FakeTime()
    service = _make_timed_service(fake_time)

    first = asyncio.run(request_flights(service))
    # four minutes later, still inside the five-minute TTL
    fake_time.advance(240)
    second = asyncio.run(request_flights(service))

    assert second.cached is True
    assert second.fetched_at == first.fetched_at == START
    # ...which is not the time of the second request
    assert second.fetched_at != fake_time.wall()


@both_paths
def test_repeated_cache_hits_keep_reporting_the_original_fetch_time(
    request_flights: Request,
) -> None:
    fake_time = FakeTime()
    service = _make_timed_service(fake_time)
    asyncio.run(request_flights(service))

    for _ in range(4):
        fake_time.advance(60)
        response = asyncio.run(request_flights(service))

        assert response.cached is True
        assert response.fetched_at == START


@both_paths
def test_refetch_after_expiry_reports_the_new_fetch_time(request_flights: Request) -> None:
    fake_time = FakeTime()
    service = _make_timed_service(fake_time)
    asyncio.run(request_flights(service))

    fake_time.advance(CACHE_TTL_SECONDS)
    refetched = asyncio.run(request_flights(service))
    fake_time.advance(10)
    cached_again = asyncio.run(request_flights(service))

    assert refetched.cached is False
    assert refetched.fetched_at == START + timedelta(seconds=CACHE_TTL_SECONDS)
    assert cached_again.cached is True
    assert cached_again.fetched_at == refetched.fetched_at


def test_each_cache_key_keeps_its_own_fetch_time() -> None:
    fake_time = FakeTime()
    service = _make_timed_service(fake_time)

    asyncio.run(service.get_flights("JFK", "departures"))
    fake_time.advance(100)
    asyncio.run(service.get_flights("LAX", "departures"))
    fake_time.advance(50)
    asyncio.run(service.get_flight_by_number("DL2042"))
    fake_time.advance(50)

    jfk = asyncio.run(service.get_flights("JFK", "departures"))
    lax = asyncio.run(service.get_flights("LAX", "departures"))
    lookup = asyncio.run(service.get_flight_by_number("DL2042"))

    assert (jfk.cached, lax.cached, lookup.cached) == (True, True, True)
    assert jfk.fetched_at == START
    assert lax.fetched_at == START + timedelta(seconds=100)
    assert lookup.fetched_at == START + timedelta(seconds=150)


def test_fetch_time_is_taken_when_the_provider_responds() -> None:
    fake_time = FakeTime()

    class SlowProvider(FakeProvider):
        """Takes two (fake) seconds to answer an airport search."""

        async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
            fake_time.advance(2)
            return await super().get_flights(airport, flight_type)

    service = _make_timed_service(fake_time, SlowProvider([_make_flight()]))

    response = asyncio.run(service.get_flights("JFK", "departures"))

    assert response.fetched_at == START + timedelta(seconds=2)


def test_fetch_time_defaults_to_the_current_utc_time() -> None:
    cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=FakeProvider([_make_flight()]), cache=cache)

    before = datetime.now(timezone.utc)
    first = asyncio.run(service.get_flights("JFK", "departures"))
    after = datetime.now(timezone.utc)
    second = asyncio.run(service.get_flights("JFK", "departures"))

    assert before <= first.fetched_at <= after
    assert first.fetched_at.utcoffset() == timedelta(0)
    assert second.cached is True
    assert second.fetched_at == first.fetched_at
