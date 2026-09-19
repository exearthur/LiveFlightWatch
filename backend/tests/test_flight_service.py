import asyncio

from app.core.cache import TTLCache
from app.models.flight import Airport, Flight, FlightType
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
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    response = asyncio.run(service.get_flights("JFK", "departures"))

    assert response.cached is False
    assert provider.call_count == 1
    assert len(response.flights) == 1


def test_second_call_within_ttl_is_served_from_cache():
    provider = FakeProvider([_make_flight()])
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
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
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    asyncio.run(service.get_flights("JFK", "departures"))
    asyncio.run(service.get_flights("JFK", "arrivals"))
    asyncio.run(service.get_flights("LAX", "departures"))

    assert provider.call_count == 3


def test_expired_cache_entry_triggers_another_provider_call():
    provider = FakeProvider([_make_flight()])
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
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
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    response = asyncio.run(service.get_flight_by_number("DL2042"))

    assert response.cached is False
    assert response.flight_number == "DL2042"
    assert provider.lookup_call_count == 1
    assert len(response.flights) == 1


def test_lookup_second_call_within_ttl_is_served_from_cache():
    provider = FakeProvider([_make_flight("DL2042")])
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    first = asyncio.run(service.get_flight_by_number("DL2042"))
    second = asyncio.run(service.get_flight_by_number("DL2042"))

    assert first.cached is False
    assert second.cached is True
    assert provider.lookup_call_count == 1
    assert second.flights == first.flights


def test_lookup_and_airport_search_use_independent_cache_keys():
    provider = FakeProvider([_make_flight("DL2042")])
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    asyncio.run(service.get_flights("JFK", "departures"))
    asyncio.run(service.get_flight_by_number("DL2042"))

    assert provider.call_count == 1
    assert provider.lookup_call_count == 1


def test_lookup_with_no_matching_flights_returns_empty_list_not_error():
    provider = FakeProvider([])
    cache: TTLCache[list[Flight]] = TTLCache(ttl_seconds=60)
    service = FlightService(provider=provider, cache=cache)

    response = asyncio.run(service.get_flight_by_number("ZZ9999"))

    assert response.cached is False
    assert response.flights == []
