from datetime import datetime, timezone

from fastapi.testclient import TestClient

import app.routers.flights as flights_router_module
from app.main import app
from app.models.flight import FlightLookupResponse, FlightsResponse
from app.providers.base import ProviderError, RateLimitError

client = TestClient(app)


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
    # get_flight_service() is called directly inside the handler (not via
    # FastAPI's Depends()), so app.dependency_overrides won't intercept it.
    # Patch the name in the flights router module instead.
    monkeypatch.setattr(flights_router_module, "get_flight_service", lambda: fake_service)

    response = client.get("/api/flights", params={"airport": "JFK", "type": "departures"})

    assert response.status_code == 502
    assert "upstream failed" in response.json()["detail"]


def test_rate_limit_error_is_mapped_to_429(monkeypatch):
    fake_service = _FakeService(error=RateLimitError("monthly quota exceeded"))
    monkeypatch.setattr(flights_router_module, "get_flight_service", lambda: fake_service)

    response = client.get("/api/flights", params={"airport": "JFK", "type": "departures"})

    assert response.status_code == 429
    assert "monthly quota exceeded" in response.json()["detail"]


def test_valid_request_returns_flights_response(monkeypatch):
    sample_response = FlightsResponse(
        airport="JFK",
        type="departures",
        fetched_at=datetime.now(timezone.utc),
        cached=False,
        flights=[],
    )
    fake_service = _FakeService(response=sample_response)
    monkeypatch.setattr(flights_router_module, "get_flight_service", lambda: fake_service)

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

    monkeypatch.setattr(flights_router_module, "get_flight_service", lambda: RecordingService())

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
    monkeypatch.setattr(flights_router_module, "get_flight_service", lambda: fake_service)

    response = client.get("/api/flights/lookup", params={"flight_number": "AA100"})

    assert response.status_code == 502
    assert "upstream failed" in response.json()["detail"]


def test_lookup_valid_request_returns_flight_lookup_response(monkeypatch):
    sample_response = FlightLookupResponse(
        flight_number="AA100",
        fetched_at=datetime.now(timezone.utc),
        cached=False,
        flights=[],
    )
    fake_service = _FakeService(response=sample_response)
    monkeypatch.setattr(flights_router_module, "get_flight_service", lambda: fake_service)

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
    monkeypatch.setattr(flights_router_module, "get_flight_service", lambda: fake_service)

    response = client.get("/api/flights/lookup", params={"flight_number": "ZZ9999"})

    assert response.status_code == 200
    assert response.json()["flights"] == []
