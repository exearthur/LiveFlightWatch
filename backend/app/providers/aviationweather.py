"""METAR reports from aviationweather.gov, the US National Weather Service's
Aviation Weather Center. Free, with no key; it covers airports worldwide.

Its Data API answers `GET /api/data/metar?ids=KJFK&format=json` with a list
of decoded reports, and with 204 when the station has none.
"""

from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.redaction import SecretRedactor
from app.models.weather import CloudLayer, FlightCategory, Weather
from app.providers.base import ProviderError, RateLimitError

DEFAULT_BASE_URL = "https://aviationweather.gov/api/data"

# The service asks automated clients to identify themselves.
USER_AGENT = "LiveFlightWatch (student flight-tracker project)"

_CATEGORIES: set[FlightCategory] = {"VFR", "MVFR", "IFR", "LIFR"}

# Holds no secrets (the API has no key); used only to trim upstream text
# that goes into a log message.
_EXCERPT = SecretRedactor([])


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _whole(value: Any) -> int | None:
    number = _number(value)
    return None if number is None else round(number)


def _text(value: Any) -> str | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        value = str(value)
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()


def _observed_at(report: dict[str, Any]) -> datetime | None:
    obs_time = _number(report.get("obsTime"))
    if obs_time is not None:
        return datetime.fromtimestamp(obs_time, tz=timezone.utc)
    report_time = _text(report.get("reportTime"))
    if report_time:
        try:
            parsed = datetime.fromisoformat(report_time.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def _clouds(report: dict[str, Any]) -> list[CloudLayer]:
    layers = report.get("clouds")
    if not isinstance(layers, list):
        return []
    result = []
    for layer in layers:
        if not isinstance(layer, dict):
            continue
        cover = _text(layer.get("cover"))
        if cover:
            result.append(CloudLayer(cover=cover.upper(), base_ft=_whole(layer.get("base"))))
    return result


def parse_metar(report: dict[str, Any]) -> Weather | None:
    """Decodes one report from the API's JSON, or None if it lacks the parts
    every report has (station, time and raw text)."""
    station = _text(report.get("icaoId"))
    raw = _text(report.get("rawOb"))
    observed_at = _observed_at(report)
    if not station or not raw or observed_at is None:
        return None

    # "VRB" for a variable direction; a number otherwise.
    wind_direction = report.get("wdir")
    variable = isinstance(wind_direction, str) and wind_direction.strip().upper() == "VRB"

    category = _text(report.get("fltCat"))
    return Weather(
        station=station.upper(),
        station_name=_text(report.get("name")),
        observed_at=observed_at,
        raw=raw,
        flight_category=category if category in _CATEGORIES else None,
        temperature_c=_number(report.get("temp")),
        dewpoint_c=_number(report.get("dewp")),
        wind_direction_deg=None if variable else _whole(wind_direction),
        wind_variable=variable,
        wind_speed_kt=_whole(report.get("wspd")),
        wind_gust_kt=_whole(report.get("wgst")),
        visibility_sm=_text(report.get("visib")),
        altimeter_hpa=_number(report.get("altim")),
        clouds=_clouds(report),
    )


class AviationWeatherClient:
    def __init__(self, client: httpx.AsyncClient, base_url: str = DEFAULT_BASE_URL) -> None:
        # The app's shared client (see app/main.py); its creator closes it.
        self._client = client
        self._base_url = base_url.rstrip("/")

    async def get_metar(self, icao: str) -> Weather | None:
        """The latest report for an ICAO station, or None when it has none."""
        try:
            response = await self._client.get(
                f"{self._base_url}/metar",
                params={"ids": icao, "format": "json"},
                headers={"User-Agent": USER_AGENT},
            )
        except httpx.HTTPError as exc:
            raise ProviderError(
                f"Request to aviationweather.gov failed: {type(exc).__name__}: "
                f"{_EXCERPT.excerpt(str(exc))}"
            ) from None

        if response.status_code == 204:
            return None
        if response.status_code == 429:
            raise RateLimitError("aviationweather.gov rate limit exceeded")
        if response.status_code != 200:
            raise ProviderError(
                f"aviationweather.gov returned status {response.status_code}: "
                f"{_EXCERPT.excerpt(response.text)}"
            )

        try:
            payload = response.json()
        except ValueError:
            raise ProviderError("aviationweather.gov returned a non-JSON response") from None
        if not isinstance(payload, list):
            raise ProviderError("aviationweather.gov returned an unexpected METAR response")

        for report in payload:
            if isinstance(report, dict):
                weather = parse_metar(report)
                if weather is not None:
                    return weather
        return None
