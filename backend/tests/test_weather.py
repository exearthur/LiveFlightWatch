import asyncio
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.airport_codes import icao_for_iata
from app.core.cache import TTLCache
from app.main import app
from app.models.weather import Weather
from app.providers.aviationweather import USER_AGENT, AviationWeatherClient, parse_metar
from app.providers.base import ProviderError, RateLimitError
from app.routers.weather import (
    NO_REPORT_DETAIL,
    UNKNOWN_AIRPORT_DETAIL,
    get_weather_service,
)
from app.services.weather_service import (
    NoWeatherReportError,
    UnknownAirportError,
    WeatherService,
)

# A report as aviationweather.gov returned it for KJFK.
KJFK_REPORT = {
    "icaoId": "KJFK",
    "obsTime": 1795578660,
    "reportTime": "2026-11-25T04:00:00.000Z",
    "temp": 3.9,
    "dewp": -6.7,
    "wdir": 10,
    "wspd": 9,
    "visib": "10+",
    "altim": 1036.3,
    "rawOb": "METAR KJFK 250351Z 01009KT 10SM FEW250 04/M07 A3060 RMK SLP362 T00391067 $",
    "name": "New York/JF Kennedy Intl, NY, US",
    "cover": "FEW",
    "clouds": [{"cover": "FEW", "base": 25000}],
    "fltCat": "VFR",
}


# ── Airport codes ─────────────────────────────────────────────────────


def test_maps_iata_to_icao():
    assert icao_for_iata("JFK") == "KJFK"
    assert icao_for_iata("lhr") == "EGLL"
    assert icao_for_iata("NRT") == "RJAA"


def test_unknown_iata_has_no_icao():
    assert icao_for_iata("QQQ") is None


# ── Parsing ───────────────────────────────────────────────────────────


def test_parses_a_full_report():
    weather = parse_metar(KJFK_REPORT)

    assert weather == Weather(
        station="KJFK",
        station_name="New York/JF Kennedy Intl, NY, US",
        observed_at=datetime(2026, 11, 25, 3, 51, tzinfo=timezone.utc),
        raw=KJFK_REPORT["rawOb"],
        flight_category="VFR",
        temperature_c=3.9,
        dewpoint_c=-6.7,
        wind_direction_deg=10,
        wind_variable=False,
        wind_speed_kt=9,
        wind_gust_kt=None,
        visibility_sm="10+",
        altimeter_hpa=1036.3,
        clouds=[{"cover": "FEW", "base_ft": 25000}],
    )


def test_reads_variable_wind_and_gusts():
    weather = parse_metar({**KJFK_REPORT, "wdir": "VRB", "wspd": 4, "wgst": 15})

    assert weather is not None
    assert weather.wind_variable is True
    assert weather.wind_direction_deg is None
    assert weather.wind_gust_kt == 15


def test_keeps_numeric_visibility_as_text():
    weather = parse_metar({**KJFK_REPORT, "visib": 2.5})

    assert weather is not None
    assert weather.visibility_sm == "2.5"


def test_leaves_out_missing_and_unknown_fields():
    report = {
        "icaoId": "EGLL",
        "reportTime": "2026-11-25T04:20:00Z",
        "rawOb": "METAR EGLL 250420Z AUTO",
        "fltCat": "NOT A CATEGORY",
        "clouds": [{"cover": "CLR", "base": None}, "junk"],
    }

    weather = parse_metar(report)

    assert weather is not None
    assert weather.observed_at == datetime(2026, 11, 25, 4, 20, tzinfo=timezone.utc)
    assert weather.flight_category is None
    assert weather.temperature_c is None
    assert weather.wind_speed_kt is None
    assert [c.model_dump() for c in weather.clouds] == [{"cover": "CLR", "base_ft": None}]


@pytest.mark.parametrize("missing", ["icaoId", "rawOb"])
def test_rejects_a_report_without_its_essentials(missing):
    report = {k: v for k, v in KJFK_REPORT.items() if k != missing}
    assert parse_metar(report) is None


def test_rejects_a_report_without_a_time():
    report = {k: v for k, v in KJFK_REPORT.items() if k not in ("obsTime", "reportTime")}
    assert parse_metar(report) is None


# ── HTTP client ───────────────────────────────────────────────────────


def _client(handler) -> AviationWeatherClient:
    return AviationWeatherClient(httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def test_asks_for_the_station_as_json_and_identifies_itself():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=[KJFK_REPORT])

    weather = asyncio.run(_client(handler).get_metar("KJFK"))

    assert weather is not None and weather.station == "KJFK"
    assert seen[0].url.path == "/api/data/metar"
    assert dict(seen[0].url.params) == {"ids": "KJFK", "format": "json"}
    assert seen[0].headers["user-agent"] == USER_AGENT


def test_no_content_means_no_report():
    weather = asyncio.run(_client(lambda r: httpx.Response(204)).get_metar("KJFK"))
    assert weather is None


def test_an_empty_list_means_no_report():
    weather = asyncio.run(_client(lambda r: httpx.Response(200, json=[])).get_metar("KJFK"))
    assert weather is None


def test_429_is_a_rate_limit():
    with pytest.raises(RateLimitError):
        asyncio.run(_client(lambda r: httpx.Response(429)).get_metar("KJFK"))


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, text="oops"),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"not": "a list"}),
    ],
)
def test_bad_responses_are_provider_errors(response):
    with pytest.raises(ProviderError):
        asyncio.run(_client(lambda r: response).get_metar("KJFK"))


def test_network_failure_is_a_provider_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(ProviderError):
        asyncio.run(_client(handler).get_metar("KJFK"))


# ── Service ───────────────────────────────────────────────────────────

FETCHED_AT = datetime(2026, 11, 25, 4, 0, tzinfo=timezone.utc)


class _FakeSource:
    def __init__(self, weather: Weather | None):
        self.weather = weather
        self.calls: list[str] = []

    async def get_metar(self, icao: str) -> Weather | None:
        self.calls.append(icao)
        return self.weather


def _service(source: _FakeSource) -> WeatherService:
    return WeatherService(
        source=source,
        reports=TTLCache(ttl_seconds=600),
        no_report=TTLCache(ttl_seconds=600),
        clock=lambda: FETCHED_AT,
    )


def test_looks_up_by_iata_and_caches_the_report():
    source = _FakeSource(parse_metar(KJFK_REPORT))
    service = _service(source)

    first = asyncio.run(service.get_weather("jfk"))
    second = asyncio.run(service.get_weather("JFK"))

    assert source.calls == ["KJFK"]
    assert first.airport == "JFK" and first.cached is False
    assert second.cached is True and second.fetched_at == FETCHED_AT
    assert second.weather.station == "KJFK"


def test_remembers_a_station_with_no_report():
    source = _FakeSource(None)
    service = _service(source)

    for _ in range(2):
        with pytest.raises(NoWeatherReportError):
            asyncio.run(service.get_weather("JFK"))

    assert source.calls == ["KJFK"]


def test_unknown_airport_never_calls_upstream():
    source = _FakeSource(parse_metar(KJFK_REPORT))

    with pytest.raises(UnknownAirportError):
        asyncio.run(_service(source).get_weather("QQQ"))

    assert source.calls == []


# ── Route ─────────────────────────────────────────────────────────────

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def _running_app():
    with client:
        yield


def _use_source(monkeypatch, source: _FakeSource) -> None:
    service = _service(source)
    monkeypatch.setitem(app.dependency_overrides, get_weather_service, lambda: service)


def test_route_returns_the_report(monkeypatch):
    _use_source(monkeypatch, _FakeSource(parse_metar(KJFK_REPORT)))

    response = client.get("/api/weather", params={"airport": "jfk"})

    assert response.status_code == 200
    body = response.json()
    assert body["airport"] == "JFK"
    assert body["cached"] is False
    assert body["weather"]["station"] == "KJFK"
    assert body["weather"]["flight_category"] == "VFR"


def test_route_404s_for_an_unknown_airport(monkeypatch):
    _use_source(monkeypatch, _FakeSource(None))

    response = client.get("/api/weather", params={"airport": "QQQ"})

    assert response.status_code == 404
    assert response.json() == {"detail": UNKNOWN_AIRPORT_DETAIL}


def test_route_404s_when_there_is_no_report(monkeypatch):
    _use_source(monkeypatch, _FakeSource(None))

    response = client.get("/api/weather", params={"airport": "JFK"})

    assert response.status_code == 404
    assert response.json() == {"detail": NO_REPORT_DETAIL}


def test_route_rejects_a_malformed_code():
    response = client.get("/api/weather", params={"airport": "JFKX"})
    assert response.status_code == 422


def test_route_maps_upstream_failures_like_the_flight_routes(monkeypatch):
    class _Failing:
        async def get_metar(self, icao):
            raise RateLimitError("limit")

    service = WeatherService(
        source=_Failing(), reports=TTLCache(ttl_seconds=1), no_report=TTLCache(ttl_seconds=1)
    )
    monkeypatch.setitem(app.dependency_overrides, get_weather_service, lambda: service)

    assert client.get("/api/weather", params={"airport": "JFK"}).status_code == 429
