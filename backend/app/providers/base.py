from abc import ABC, abstractmethod

from app.models.flight import Flight, FlightType


class ProviderError(Exception):
    """Raised when the upstream flight-data provider fails or returns
    something the adapter can't make sense of."""


class RateLimitError(ProviderError):
    """Raised when the upstream provider reports its rate limit or usage
    quota has been exceeded, so callers can surface a distinct, actionable
    message instead of a generic upstream failure."""


class FlightProvider(ABC):
    @abstractmethod
    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        raise NotImplementedError
