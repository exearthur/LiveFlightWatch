from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.cache import TTLCache
from app.errors import RATE_LIMIT_DETAIL, UPSTREAM_FAILURE_DETAIL
from app.main import app
from app.models.flight import (
    Flight,
    FlightLookupResponse,
    FlightSnapshot,
    FlightsResponse,
    FlightType,
)
from app.providers.base import FlightProvider, ProviderError, RateLimitError
from app.routers.flights import get_flight_service
from app.services.flight_service import FlightService

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def _running_app():
    """Starts the app for the tests in this module. TestClient only runs the
    lifespan, which builds the HTTP client and the flight service, when it
    is used as a context manager."""
    with client:
        yield


def _use_service(monkeypatch, service) -> None:
    """Makes the routes use `service` instead of the one the lifespan built.
    monkeypatch removes the override again when the test ends."""
    monkeypatch.setitem(app.dependency_overrides, get_flight_service, lambda: service)


class _FakeService:
    """Stand-in for FlightService used to control what the router sees,
    without making a real AviationStack call."""

    def __init__(self, response=None, error: Exception | None = None):
        self._response = response
        self._error = error

    async def get_flights(self, airport, flight_type):
        if self._error is not None:
            raise self._error
        return self._response

    async def get_flight_by_number(self, flight_number):
        if self._error is not None:
            raise self._error
        return self._response


def test_invalid_airport_code_returns_422():
    response = client.get("/api/flights", params={"airport": "TOOLONG", "type": "departures"})

    assert response.status_code == 422


def test_missing_airport_returns_422():
    response = client.get("/api/flights")

    assert response.status_code == 422


def test_provider_error_is_mapped_to_502(monkeypatch):
    fake_service = _FakeService(error=ProviderError("upstream failed"))
    _use_service(monkeypatch, fake_service)

    response = client.get("/api/flights", params={"airport": "JFK", "type": "departures"})

    assert response.status_code == 502
    # the client gets a fixed message; the provider's own goes to the log
    assert response.json() == {"detail": UPSTREAM_FAILURE_DETAIL}
    assert "upstream failed" not in response.text


def test_rate_limit_error_is_mapped_to_429(monkeypatch):
    fake_service = _FakeService(error=RateLimitError("monthly quota exceeded"))
    _use_service(monkeypatch, fake_service)

    response = client.get("/api/flights", params={"airport": "JFK", "type": "departures"})

    assert response.status_code == 429
    assert response.json() == {"detail": RATE_LIMIT_DETAIL}
    assert "monthly quota exceeded" not in response.text


def test_valid_request_returns_flights_response(monkeypatch):
    sample_response = FlightsResponse(
        airport="JFK",
        type="departures",
        fetched_at=datetime.now(timezone.utc),
        cached=False,
        flights=[],
    )
    fake_service = _FakeService(response=sample_response)
    _use_service(monkeypatch, fake_service)

    response = client.get("/api/flights", params={"airport": "jfk", "type": "departures"})

    assert response.status_code == 200
    body = response.json()
    assert body["airport"] == "JFK"
    assert body["type"] == "departures"
    assert body["flights"] == []


def test_flight_type_defaults_to_departures(monkeypatch):
    seen: dict = {}

    class RecordingService(_FakeService):
        async def get_flights(self, airport, flight_type):
            seen["flight_type"] = flight_type
            return FlightsResponse(
                airport=airport,
                type=flight_type,
                fetched_at=datetime.now(timezone.utc),
                cached=False,
                flights=[],
            )

    _use_service(monkeypatch, RecordingService())

    response = client.get("/api/flights", params={"airport": "JFK"})

    assert response.status_code == 200
    assert seen["flight_type"] == "departures"


# --- GET /api/flights/lookup -------------------------------------------------


def test_lookup_invalid_flight_number_returns_422():
    response = client.get("/api/flights/lookup", params={"flight_number": "!!invalid!!"})

    assert response.status_code == 422


def test_lookup_missing_flight_number_returns_422():
    response = client.get("/api/flights/lookup")

    assert response.status_code == 422


def test_lookup_provider_error_is_mapped_to_502(monkeypatch):
    fake_service = _FakeService(error=ProviderError("upstream failed"))
    _use_service(monkeypatch, fake_service)

    response = client.get("/api/flights/lookup", params={"flight_number": "AA100"})

    assert response.status_code == 502
    assert response.json() == {"detail": UPSTREAM_FAILURE_DETAIL}
    assert "upstream failed" not in response.text


def test_lookup_rate_limit_error_is_mapped_to_429(monkeypatch):
    fake_service = _FakeService(error=RateLimitError("monthly quota exceeded"))
    _use_service(monkeypatch, fake_service)

    response = client.get("/api/flights/lookup", params={"flight_number": "AA100"})

    assert response.status_code == 429
    assert response.json() == {"detail": RATE_LIMIT_DETAIL}
    assert "monthly quota exceeded" not in response.text


def test_lookup_valid_request_returns_flight_lookup_response(monkeypatch):
    sample_response = FlightLookupResponse(
        flight_number="AA100",
        fetched_at=datetime.now(timezone.utc),
        cached=False,
        flights=[],
    )
    fake_service = _FakeService(response=sample_response)
    _use_service(monkeypatch, fake_service)

    response = client.get("/api/flights/lookup", params={"flight_number": "aa100"})

    assert response.status_code == 200
    body = response.json()
    assert body["flight_number"] == "AA100"
    assert body["flights"] == []


def test_lookup_with_no_matching_flights_returns_200_with_empty_list(monkeypatch):
    # AviationStack returning zero matches for a flight number is a normal,
    # successful outcome (e.g. flight not operating today) -- not an error.
    sample_response = FlightLookupResponse(
        flight_number="ZZ9999",
        fetched_at=datetime.now(timezone.utc),
        cached=False,
        flights=[],
    )
    fake_service = _FakeService(response=sample_response)
    _use_service(monkeypatch, fake_service)

    response = client.get("/api/flights/lookup", params={"flight_number": "ZZ9999"})

    assert response.status_code == 200
    assert response.json()["flights"] == []


# --- fetched_at on cached responses ------------------------------------------


class _StubProvider(FlightProvider):
    """Returns no flights and counts upstream calls."""

    def __init__(self) -> None:
        self.call_count = 0

    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        self.call_count += 1
        return []

    async def get_flight_by_number(self, flight_number: str) -> list[Flight]:
        self.call_count += 1
        return []


@pytest.mark.parametrize(
    ("path", "params"),
    [
        pytest.param("/api/flights", {"airport": "JFK", "type": "departures"}, id="airport"),
        pytest.param("/api/flights/lookup", {"flight_number": "AA100"}, id="lookup"),
    ],
)
def test_cached_response_reports_the_original_fetch_time(
    monkeypatch: pytest.MonkeyPatch, path: str, params: dict[str, str]
) -> None:
    # A real FlightService behind the endpoint, on clocks the test controls.
    fetched = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    elapsed = timedelta(0)
    provider = _StubProvider()
    cache: TTLCache[FlightSnapshot] = TTLCache(
        ttl_seconds=300, clock=lambda: elapsed.total_seconds()
    )
    service = FlightService(provider=provider, cache=cache, clock=lambda: fetched + elapsed)
    _use_service(monkeypatch, service)

    first = client.get(path, params=params).json()
    elapsed = timedelta(minutes=4)
    second = client.get(path, params=params).json()

    assert provider.call_count == 1
    assert (first["cached"], second["cached"]) == (False, True)
    assert datetime.fromisoformat(first["fetched_at"]) == fetched
    assert second["fetched_at"] == first["fetched_at"]
