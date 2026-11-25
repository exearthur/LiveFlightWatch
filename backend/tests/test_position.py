import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.airport_codes import airport_for_iata
from app.core.cache import TTLCache
from app.main import app
from app.models.position import Aircraft
from app.providers.adsblol import USER_AGENT, AdsbLolClient, parse_aircraft
from app.providers.aerodatabox import AeroDataBoxProvider
from app.providers.aviationstack import AviationStackProvider
from app.providers.base import ProviderError, RateLimitError
from app.routers.position import get_position_service
from app.services.position_service import PositionService

# An airborne aircraft as adsb.lol returned it.
AIRBORNE = {
    "hex": "ac5afd",
    "flight": "SWA4601 ",
    "r": "N8955Q",
    "t": "B38M",
    "desc": "BOEING 737 MAX 8",
    "lat": 40.712997,
    "lon": -73.380005,
    "alt_baro": 22875,
    "gs": 444.8,
    "track": 36.41,
    "seen_pos": 0.077,
}


# ── Callsigns from the flight providers ──────────────────────────────

CAPTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "aviationstack_atl_departures.json").read_text(
        encoding="utf-8"
    )
)
ROWS: dict[str, dict[str, Any]] = {row["flight"]["iata"]: row for row in CAPTURE["data"]}
AVIATIONSTACK = AviationStackProvider(
    api_key="test-key", base_url="https://example.invalid", client=MagicMock(spec=httpx.AsyncClient)
)


def test_aviationstack_callsign_is_the_flights_icao_designator():
    assert AVIATIONSTACK._to_flight(ROWS["DL2204"], "departures").callsign == "DAL2204"


def test_aviationstack_codeshare_callsign_is_the_operating_flights():
    # KE5036 is Korean Air's number on Delta's DL27; the aircraft says DAL27.
    assert AVIATIONSTACK._to_flight(ROWS["KE5036"], "departures").callsign == "DAL27"


def test_aviationstack_callsign_is_none_without_a_designator():
    row = {**ROWS["DL2204"], "flight": {"iata": "DL2204", "icao": None, "codeshared": None}}
    assert AVIATIONSTACK._to_flight(row, "departures").callsign is None


def test_aerodatabox_reads_the_call_sign():
    status = {
        "departure": {"airport": {"iata": "JFK"}, "scheduledTime": {"utc": "2026-11-13 15:00Z"}},
        "arrival": {"airport": {"iata": "LAX"}},
        "number": "DL 123",
        "callSign": "dal123",
        "status": "EnRoute",
        "airline": {"name": "Delta Air Lines"},
    }
    client = AsyncMock(spec=httpx.AsyncClient)
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = [status]
    client.get.return_value = response
    provider = AeroDataBoxProvider(api_key="k", base_url="https://adb.invalid", client=client)

    [flight] = asyncio.run(provider.get_flight_by_number("DL123"))

    assert flight.callsign == "DAL123"


# ── Airport table ─────────────────────────────────────────────────────


def test_airport_table_has_names_and_positions():
    jfk = airport_for_iata("jfk")
    assert jfk is not None
    assert (jfk.icao, jfk.name) == ("KJFK", "John F. Kennedy International Airport")
    assert jfk.lat == pytest.approx(40.64, abs=0.01)
    assert jfk.lon == pytest.approx(-73.78, abs=0.01)
    assert airport_for_iata("QQQ") is None


# ── Parsing ───────────────────────────────────────────────────────────


def test_parses_an_airborne_aircraft():
    assert parse_aircraft(AIRBORNE) == Aircraft(
        hex="ac5afd",
        callsign="SWA4601",
        registration="N8955Q",
        type_code="B38M",
        type_name="BOEING 737 MAX 8",
        lat=40.712997,
        lon=-73.380005,
        altitude_ft=22875,
        on_ground=False,
        ground_speed_kt=445,
        track_deg=36.41,
        position_age_s=0.077,
    )


def test_an_aircraft_on_the_ground_has_no_altitude():
    aircraft = parse_aircraft({**AIRBORNE, "alt_baro": "ground", "gs": 12})
    assert aircraft is not None
    assert aircraft.on_ground is True
    assert aircraft.altitude_ft is None


@pytest.mark.parametrize("missing", ["hex", "flight", "lat", "lon"])
def test_needs_an_identity_and_a_position(missing):
    assert parse_aircraft({k: v for k, v in AIRBORNE.items() if k != missing}) is None


# ── HTTP client ───────────────────────────────────────────────────────


def _client(handler) -> AdsbLolClient:
    return AdsbLolClient(httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def test_asks_for_the_callsign_and_identifies_itself():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"ac": [AIRBORNE]})

    aircraft = asyncio.run(_client(handler).get_by_callsign("SWA4601"))

    assert aircraft is not None and aircraft.hex == "ac5afd"
    assert seen[0].url.path == "/v2/callsign/SWA4601"
    assert seen[0].headers["user-agent"] == USER_AGENT


def test_no_aircraft_means_none():
    handler = lambda r: httpx.Response(200, json={"ac": []})  # noqa: E731
    assert asyncio.run(_client(handler).get_by_callsign("DAL27")) is None


def test_prefers_the_exact_callsign_then_the_freshest_position():
    stale = {**AIRBORNE, "hex": "aaaaaa", "seen_pos": 40}
    fresh = {**AIRBORNE, "hex": "bbbbbb", "seen_pos": 1}
    other = {**AIRBORNE, "hex": "cccccc", "flight": "SWA4601X", "seen_pos": 0}
    handler = lambda r: httpx.Response(200, json={"ac": [other, stale, fresh]})  # noqa: E731

    aircraft = asyncio.run(_client(handler).get_by_callsign("SWA4601"))

    assert aircraft is not None and aircraft.hex == "bbbbbb"


def test_429_is_a_rate_limit():
    with pytest.raises(RateLimitError):
        asyncio.run(_client(lambda r: httpx.Response(429)).get_by_callsign("DAL27"))


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, text="oops"),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"not": "the shape"}),
    ],
)
def test_bad_responses_are_provider_errors(response):
    with pytest.raises(ProviderError):
        asyncio.run(_client(lambda r: response).get_by_callsign("DAL27"))


def test_network_failure_is_a_provider_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(ProviderError):
        asyncio.run(_client(handler).get_by_callsign("DAL27"))


# ── Service ───────────────────────────────────────────────────────────

FETCHED_AT = datetime(2026, 11, 25, 5, 0, tzinfo=timezone.utc)


class _FakeSource:
    def __init__(self, aircraft: Aircraft | None):
        self.aircraft = aircraft
        self.calls: list[str] = []

    async def get_by_callsign(self, callsign: str) -> Aircraft | None:
        self.calls.append(callsign)
        return self.aircraft


def _service(source) -> PositionService:
    return PositionService(source=source, cache=TTLCache(ttl_seconds=60), clock=lambda: FETCHED_AT)


def test_shares_one_lookup_per_callsign_while_cached():
    source = _FakeSource(parse_aircraft(AIRBORNE))
    service = _service(source)

    first = asyncio.run(service.get_position("swa4601"))
    second = asyncio.run(service.get_position("SWA4601"))

    assert source.calls == ["SWA4601"]
    assert first.cached is False and second.cached is True
    assert second.aircraft is not None and second.fetched_at == FETCHED_AT


def test_caches_nothing_transmitting_too():
    source = _FakeSource(None)
    service = _service(source)

    for _ in range(2):
        assert asyncio.run(service.get_position("DAL27")).aircraft is None

    assert source.calls == ["DAL27"]


# ── Routes ────────────────────────────────────────────────────────────

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def _running_app():
    with client:
        yield


def test_position_route_returns_the_aircraft(monkeypatch):
    service = _service(_FakeSource(parse_aircraft(AIRBORNE)))
    monkeypatch.setitem(app.dependency_overrides, get_position_service, lambda: service)

    response = client.get("/api/position", params={"callsign": "swa4601"})

    assert response.status_code == 200
    body = response.json()
    assert body["callsign"] == "SWA4601"
    assert body["aircraft"]["registration"] == "N8955Q"


def test_position_route_answers_null_when_nothing_transmits(monkeypatch):
    service = _service(_FakeSource(None))
    monkeypatch.setitem(app.dependency_overrides, get_position_service, lambda: service)

    response = client.get("/api/position", params={"callsign": "DAL27"})

    assert response.status_code == 200
    assert response.json()["aircraft"] is None


@pytest.mark.parametrize("callsign", ["DL27", "DAL", "DAL12345", "12345"])
def test_position_route_rejects_what_isnt_a_callsign(callsign):
    assert client.get("/api/position", params={"callsign": callsign}).status_code == 422


def test_position_route_maps_a_rate_limit_to_429(monkeypatch):
    class _Limited:
        async def get_by_callsign(self, callsign):
            raise RateLimitError("limit")

    service = _service(_Limited())
    monkeypatch.setitem(app.dependency_overrides, get_position_service, lambda: service)

    assert client.get("/api/position", params={"callsign": "DAL27"}).status_code == 429


def test_airports_route_returns_known_codes_once_and_skips_unknown_ones():
    response = client.get("/api/airports", params={"codes": "jfk, MAN,QQQ,JFK"})

    assert response.status_code == 200
    assert [a["iata"] for a in response.json()["airports"]] == ["JFK", "MAN"]
    assert response.json()["airports"][1]["icao"] == "EGCC"


@pytest.mark.parametrize("codes", ["", " , ", ",".join(["JFK"] * 11)])
def test_airports_route_rejects_too_few_or_too_many_codes(codes):
    assert client.get("/api/airports", params={"codes": codes}).status_code == 422
