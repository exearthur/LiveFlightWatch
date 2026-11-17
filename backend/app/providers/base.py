from abc import ABC, abstractmethod

from app.models.flight import Flight, FlightType


class ProviderError(Exception):
    """Raised when the upstream flight-data provider fails or returns
    something the adapter can't make sense of.

    The message is for the server log only. It is never sent to a client
    (app/errors.py answers with a fixed, generic message), and it must not
    contain an API key: a provider that puts upstream text in it (a response
    body, an exception string, a URL) passes that text through its
    `SecretRedactor` first.
    """


class RateLimitError(ProviderError):
    """Raised when the upstream provider reports its rate limit or usage
    quota has been exceeded, so callers can surface a distinct, actionable
    message instead of a generic upstream failure."""


class FlightProvider(ABC):
    @abstractmethod
    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        raise NotImplementedError

    @abstractmethod
    async def get_flight_by_number(self, flight_number: str) -> list[Flight]:
        raise NotImplementedError
