from datetime import datetime, timezone

from app.core.cache import TTLCache
from app.models.flight import Flight, FlightsResponse, FlightType
from app.providers.base import FlightProvider


class FlightService:
    def __init__(self, provider: FlightProvider, cache: TTLCache[list[Flight]]):
        self._provider = provider
        self._cache = cache

    async def get_flights(self, airport: str, flight_type: FlightType) -> FlightsResponse:
        cache_key = f"{airport}:{flight_type}"
        cached_flights = self._cache.get(cache_key)

        if cached_flights is not None:
            return FlightsResponse(
                airport=airport,
                type=flight_type,
                fetched_at=datetime.now(timezone.utc),
                cached=True,
                flights=cached_flights,
            )

        flights = await self._provider.get_flights(airport, flight_type)
        self._cache.set(cache_key, flights)

        return FlightsResponse(
            airport=airport,
            type=flight_type,
            fetched_at=datetime.now(timezone.utc),
            cached=False,
            flights=flights,
        )
