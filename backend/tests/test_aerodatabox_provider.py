"""AeroDataBoxProvider against mocked HTTP responses.

The response shapes here follow AeroDataBox's published OpenAPI description
(AirportFidsContract and FlightContract, v1.15.4.0). Nothing in this file
talks to the live API.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.models.flight import Flight, FlightType
from app.providers.aerodatabox import AeroDataBoxProvider
from app.providers.base import ProviderError, RateLimitError

BASE_URL = "https://aerodatabox.example.invalid"
PROVIDER = AeroDataBoxProvider(api_key="test-key", base_url=BASE_URL)


def _make_response(status_code: int = 200, json_body: Any = None, text: str = "") -> MagicMock:
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    if json_body is not None:
        response.json.return_value = json_body
    else:
        response.json.side_effect = ValueError("no json body")
    response.text = text
    return response


def _mock_client(response: MagicMock | None = None, error: Exception | None = None) -> AsyncMock:
    """Stands in for `httpx.AsyncClient(...)` used as an async context
    manager, with `client.get(...)` resolving to `response` or raising."""
    client = AsyncMock()
    if error is not None:
        client.get.side_effect = error
    else:
        client.get.return_value = response
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


def _get_flights(
    client: AsyncMock, airport: str = "JFK", flight_type: FlightType = "departures"
) -> list[Flight]:
    with patch("app.providers.aerodatabox.httpx.AsyncClient", return_value=client):
        return asyncio.run(PROVIDER.get_flights(airport, flight_type))


def _get_flight_by_number(client: AsyncMock, flight_number: str = "DL123") -> list[Flight]:
    with patch("app.providers.aerodatabox.httpx.AsyncClient", return_value=client):
        return asyncio.run(PROVIDER.get_flight_by_number(flight_number))


def _time(utc: str, local: str) -> dict[str, str]:
    return {"utc": utc, "local": local}


def _board_row(**overrides: Any) -> dict[str, Any]:
    """One AirportFlightContract as returned without the opposite leg: the
    `movement` holds this airport's times/terminal/gate, and its `airport`
    is the one at the other end of the route."""
    row: dict[str, Any] = {
        "movement": {
            "airport": {"icao": "KLAX", "iata": "LAX", "name": "Los Angeles"},
            "scheduledTime": _time("2026-11-13 15:00Z", "2026-11-13 10:00-05:00"),
            "revisedTime": _time("2026-11-13 15:05Z", "2026-11-13 10:05-05:00"),
            "terminal": "4",
            "gate": "B22",
            "quality": ["Basic", "Live"],
        },
        "number": "DL 123",
        "status": "Expected",
        "codeshareStatus": "IsOperator",
        "isCargo": False,
        "airline": {"name": "Delta Air Lines", "iata": "DL", "icao": "DAL"},
    }
    row.update(overrides)
    return row


def _flight_status(**overrides: Any) -> dict[str, Any]:
    """One FlightContract, as returned by the flight-status endpoint."""
    flight: dict[str, Any] = {
        "departure": {
            "airport": {"icao": "KJFK", "iata": "JFK", "name": "New York John F Kennedy"},
            "scheduledTime": _time("2026-11-13 15:00Z", "2026-11-13 10:00-05:00"),
            "revisedTime": _time("2026-11-13 15:04Z", "2026-11-13 10:04-05:00"),
            "terminal": "4",
            "gate": "B22",
            "quality": ["Basic", "Live"],
        },
        "arrival": {
            "airport": {"icao": "KLAX", "iata": "LAX", "name": "Los Angeles"},
            "scheduledTime": _time("2026-11-13 21:10Z", "2026-11-13 13:10-08:00"),
            "terminal": "3",
            "quality": ["Basic"],
        },
        "lastUpdatedUtc": "2026-11-13 15:10Z",
        "number": "DL 123",
        "status": "EnRoute",
        "codeshareStatus": "IsOperator",
        "isCargo": False,
        "airline": {"name": "Delta Air Lines", "iata": "DL", "icao": "DAL"},
    }
    flight.update(overrides)
    return flight


# --- get_flights(): the request ----------------------------------------------


def test_get_flights_requests_the_departure_board_by_iata_code() -> None:
    client = _mock_client(_make_response(json_body={"departures": []}))

    _get_flights(client, "JFK", "departures")

    args, kwargs = client.get.call_args
    assert args[0] == f"{BASE_URL}/flights/airports/iata/JFK"
    assert kwargs["params"]["direction"] == "Departure"
    assert kwargs["params"]["withLeg"] == "false"
    assert kwargs["params"]["offsetMinutes"] == "-120"
    assert kwargs["params"]["durationMinutes"] == "720"
    # one row per aircraft movement, cancelled flights included
    assert kwargs["params"]["withCodeshared"] == "false"
    assert kwargs["params"]["withPrivate"] == "false"
    assert kwargs["params"]["withCancelled"] == "true"


def test_get_flights_requests_the_arrival_board_for_arrivals() -> None:
    client = _mock_client(_make_response(json_body={"arrivals": []}))

    _get_flights(client, "JFK", "arrivals")

    _, kwargs = client.get.call_args
    assert kwargs["params"]["direction"] == "Arrival"


def test_requests_authenticate_with_rapidapi_headers_not_query_params() -> None:
    client = _mock_client(_make_response(json_body={"departures": []}))

    _get_flights(client)

    _, kwargs = client.get.call_args
    assert kwargs["headers"]["X-RapidAPI-Key"] == "test-key"
    # the gateway host header is derived from the configured base URL
    assert kwargs["headers"]["X-RapidAPI-Host"] == "aerodatabox.example.invalid"
    assert "test-key" not in kwargs["params"].values()


def test_trailing_slash_on_base_url_does_not_double_up() -> None:
    provider = AeroDataBoxProvider(api_key="k", base_url=f"{BASE_URL}/")
    client = _mock_client(_make_response(json_body={"departures": []}))

    with patch("app.providers.aerodatabox.httpx.AsyncClient", return_value=client):
        asyncio.run(provider.get_flights("JFK", "departures"))

    args, _ = client.get.call_args
    assert args[0] == f"{BASE_URL}/flights/airports/iata/JFK"


# --- get_flights(): mapping to Flight ------------------------------------------


def test_departure_row_maps_to_flight() -> None:
    client = _mock_client(_make_response(json_body={"departures": [_board_row()]}))

    flights = _get_flights(client, "JFK", "departures")

    assert len(flights) == 1
    flight = flights[0]
    assert flight.flight_number == "DL123"
    assert flight.airline == "Delta Air Lines"
    # the queried airport is the origin; the row only describes the far end
    assert flight.origin.iata == "JFK"
    assert flight.origin.name is None
    assert flight.destination.iata == "LAX"
    assert flight.destination.name == "Los Angeles"
    assert flight.scheduled_time == datetime(2026, 11, 13, 15, 0, tzinfo=timezone.utc)
    assert flight.estimated_time == datetime(2026, 11, 13, 15, 5, tzinfo=timezone.utc)
    assert flight.actual_time is None
    assert flight.status == "scheduled"
    assert flight.terminal == "4"
    assert flight.gate == "B22"


def test_arrival_row_maps_queried_airport_as_destination() -> None:
    row = _board_row(status="Arrived")
    row["movement"]["airport"] = {"icao": "EGLL", "iata": "LHR", "name": "London Heathrow"}
    client = _mock_client(_make_response(json_body={"arrivals": [row]}))

    flights = _get_flights(client, "JFK", "arrivals")

    flight = flights[0]
    assert flight.origin.iata == "LHR"
    assert flight.origin.name == "London Heathrow"
    assert flight.destination.iata == "JFK"
    assert flight.status == "landed"
    # an arrived flight's revised time is when it actually arrived
    assert flight.actual_time == datetime(2026, 11, 13, 15, 5, tzinfo=timezone.utc)


def test_only_the_requested_direction_is_returned() -> None:
    body = {
        "departures": [_board_row(number="DL 1")],
        "arrivals": [_board_row(number="DL 2")],
    }
    client = _mock_client(_make_response(json_body=body))

    flights = _get_flights(client, "JFK", "arrivals")

    assert [flight.flight_number for flight in flights] == ["DL2"]


def test_null_direction_list_returns_no_flights() -> None:
    # the spec marks both `departures` and `arrivals` as nullable
    client = _mock_client(_make_response(json_body={"departures": None, "arrivals": None}))

    assert _get_flights(client, "JFK", "departures") == []


def test_204_no_content_returns_no_flights() -> None:
    client = _mock_client(_make_response(status_code=204))

    assert _get_flights(client) == []


def test_schedule_only_row_has_no_estimate_terminal_or_gate() -> None:
    # airports without live coverage return scheduled times only
    row = _board_row()
    row["movement"] = {
        "airport": {"iata": "LAX", "name": "Los Angeles"},
        "scheduledTime": _time("2026-11-13 15:00Z", "2026-11-13 10:00-05:00"),
        "quality": ["Basic"],
    }
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    flight = _get_flights(client)[0]

    assert flight.scheduled_time is not None
    assert flight.estimated_time is None
    assert flight.actual_time is None
    assert flight.terminal is None
    assert flight.gate is None


def test_runway_time_is_used_when_there_is_no_revised_time() -> None:
    row = _board_row(status="Departed")
    del row["movement"]["revisedTime"]
    row["movement"]["runwayTime"] = _time("2026-11-13 15:12Z", "2026-11-13 10:12-05:00")
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    flight = _get_flights(client)[0]

    assert flight.estimated_time == datetime(2026, 11, 13, 15, 12, tzinfo=timezone.utc)
    assert flight.actual_time == flight.estimated_time


def test_missing_optional_objects_do_not_break_mapping() -> None:
    row = {"number": "DL 123", "status": "Unknown", "codeshareStatus": "Unknown", "isCargo": False}
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    flight = _get_flights(client)[0]

    assert flight.flight_number == "DL123"
    assert flight.airline is None
    assert flight.destination.iata == ""
    assert flight.scheduled_time is None
    assert flight.status == "unknown"


def test_unparseable_time_becomes_none() -> None:
    row = _board_row()
    row["movement"]["scheduledTime"] = _time("not a time", "not a time")
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    assert _get_flights(client)[0].scheduled_time is None


@pytest.mark.parametrize(
    "utc_value",
    ["2026-11-13 15:00Z", "2026-11-13T15:00:00Z", "2026-11-13T15:00:00+00:00", "2026-11-13 15:00"],
)
def test_utc_time_is_read_in_each_iso_8601_spelling(utc_value: str) -> None:
    # the spec only says `date-time`; a value without an offset is taken as
    # UTC, because it comes from the field named `utc`
    row = _board_row()
    row["movement"]["scheduledTime"] = _time(utc_value, "2026-11-13 10:00-05:00")
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    scheduled = _get_flights(client)[0].scheduled_time

    assert scheduled == datetime(2026, 11, 13, 15, 0, tzinfo=timezone.utc)


def test_blank_flight_number_falls_back_to_unknown() -> None:
    client = _mock_client(_make_response(json_body={"departures": [_board_row(number=" ")]}))

    assert _get_flights(client)[0].flight_number == "Unknown"


# --- status normalization -------------------------------------------------------


@pytest.mark.parametrize(
    ("raw_status", "expected"),
    [
        ("Unknown", "unknown"),
        ("Expected", "scheduled"),
        ("CheckIn", "scheduled"),
        ("Boarding", "scheduled"),
        ("GateClosed", "scheduled"),
        ("Departed", "active"),
        ("EnRoute", "active"),
        ("Approaching", "active"),
        ("Delayed", "delayed"),
        ("Arrived", "landed"),
        ("Canceled", "cancelled"),
        ("Diverted", "diverted"),
        ("CanceledUncertain", "unknown"),
        ("SomethingNew", "unknown"),
    ],
)
def test_raw_status_is_normalized(raw_status: str, expected: str) -> None:
    client = _mock_client(_make_response(json_body={"departures": [_board_row(status=raw_status)]}))

    assert _get_flights(client)[0].status == expected


def test_revised_time_over_threshold_marks_scheduled_flight_delayed() -> None:
    row = _board_row(status="Expected")
    row["movement"]["revisedTime"] = _time("2026-11-13 15:16Z", "2026-11-13 10:16-05:00")
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    assert _get_flights(client)[0].status == "delayed"


def test_revised_time_at_threshold_does_not_mark_delayed() -> None:
    row = _board_row(status="Expected")
    row["movement"]["revisedTime"] = _time("2026-11-13 15:15Z", "2026-11-13 10:15-05:00")
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    assert _get_flights(client)[0].status == "scheduled"


def test_late_revised_time_does_not_override_a_finished_flight() -> None:
    row = _board_row(status="Arrived")
    row["movement"]["revisedTime"] = _time("2026-11-13 16:30Z", "2026-11-13 11:30-05:00")
    client = _mock_client(_make_response(json_body={"departures": [row]}))

    assert _get_flights(client)[0].status == "landed"


# --- get_flight_by_number() -----------------------------------------------------


def test_get_flight_by_number_requests_flight_status_by_number() -> None:
    client = _mock_client(_make_response(json_body=[_flight_status()]))

    _get_flight_by_number(client, "DL123")

    args, kwargs = client.get.call_args
    assert args[0] == f"{BASE_URL}/flights/number/DL123"
    # a found flight plan would double the cost of the call on some plans
    assert kwargs["params"]["withFlightPlan"] == "false"
    assert kwargs["headers"]["X-RapidAPI-Key"] == "test-key"


def test_get_flight_by_number_maps_both_airports_and_the_departure_leg() -> None:
    client = _mock_client(_make_response(json_body=[_flight_status()]))

    flights = _get_flight_by_number(client)

    assert len(flights) == 1
    flight = flights[0]
    assert flight.flight_number == "DL123"
    assert flight.airline == "Delta Air Lines"
    assert flight.origin.iata == "JFK"
    assert flight.origin.name == "New York John F Kennedy"
    assert flight.destination.iata == "LAX"
    assert flight.destination.name == "Los Angeles"
    assert flight.scheduled_time == datetime(2026, 11, 13, 15, 0, tzinfo=timezone.utc)
    assert flight.estimated_time == datetime(2026, 11, 13, 15, 4, tzinfo=timezone.utc)
    # en route, so the departure-leg time is an actual time
    assert flight.actual_time == flight.estimated_time
    assert flight.status == "active"
    assert flight.terminal == "4"
    assert flight.gate == "B22"


def test_get_flight_by_number_with_no_match_returns_empty_list() -> None:
    # the flight-status endpoint answers 204 when it finds nothing
    client = _mock_client(_make_response(status_code=204))

    assert _get_flight_by_number(client, "ZZ9999") == []


def test_get_flight_by_number_rejects_a_non_list_body() -> None:
    client = _mock_client(_make_response(json_body={"message": "unexpected"}))

    with pytest.raises(ProviderError):
        _get_flight_by_number(client)


# --- rate limit and other upstream failures -------------------------------------


def test_http_429_raises_rate_limit_error_with_upstream_message() -> None:
    client = _mock_client(
        _make_response(429, json_body={"message": "You have exceeded the MONTHLY quota"})
    )

    with pytest.raises(RateLimitError, match="exceeded the MONTHLY quota"):
        _get_flights(client)


def test_http_429_without_json_body_still_raises_rate_limit_error() -> None:
    client = _mock_client(_make_response(429, text="Too many requests"))

    with pytest.raises(RateLimitError):
        _get_flights(client)


def test_http_429_on_lookup_raises_rate_limit_error() -> None:
    client = _mock_client(_make_response(429, json_body={"message": "Too many requests"}))

    with pytest.raises(RateLimitError):
        _get_flight_by_number(client)


@pytest.mark.parametrize("status_code", [400, 401, 403, 451, 500, 503])
def test_other_error_status_raises_provider_error_not_rate_limit(status_code: int) -> None:
    client = _mock_client(
        _make_response(status_code, json_body={"message": "nope"}, text='{"message": "nope"}')
    )

    with pytest.raises(ProviderError, match=str(status_code)) as exc_info:
        _get_flights(client)
    assert not isinstance(exc_info.value, RateLimitError)


def test_network_failure_raises_provider_error() -> None:
    client = _mock_client(error=httpx.ConnectTimeout("timed out"))

    with pytest.raises(ProviderError, match="Request to AeroDataBox failed") as exc_info:
        _get_flights(client)
    assert not isinstance(exc_info.value, RateLimitError)


def test_non_json_200_raises_provider_error() -> None:
    client = _mock_client(_make_response(200, text="<html>gateway page</html>"))

    with pytest.raises(ProviderError, match="non-JSON"):
        _get_flights(client)


def test_unexpected_board_shape_raises_provider_error() -> None:
    client = _mock_client(_make_response(json_body=[_board_row()]))

    with pytest.raises(ProviderError):
        _get_flights(client)
