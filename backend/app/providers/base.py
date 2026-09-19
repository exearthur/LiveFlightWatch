from abc import ABC, abstractmethod

from app.models.flight import Flight, FlightType


class ProviderError(Exception):
    """Raised when the upstream flight-data provider fails or returns
    something the adapter can't make sense of."""


class FlightProvider(ABC):
    @abstractmethod
    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        raise NotImplementedError
