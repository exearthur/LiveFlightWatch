"""Live aircraft positions from adsb.lol, a community network of ADS-B
receivers. Free, with no key; it limits each client to a few hundred requests
a day, so callers cache.

`GET /v2/callsign/DAL27` answers `{"ac": [...]}`, a list of the aircraft
currently transmitting that callsign (usually zero or one).
"""

from typing import Any

import httpx

from app.core.redaction import SecretRedactor
from app.models.position import Aircraft
from app.providers.base import ProviderError, RateLimitError

DEFAULT_BASE_URL = "https://api.adsb.lol/v2"
USER_AGENT = "LiveFlightWatch (student flight-tracker project)"

# Holds no secrets (the API has no key); used only to trim upstream text
# that goes into a log message.
_EXCERPT = SecretRedactor([])


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _text(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()


def parse_aircraft(raw: dict[str, Any]) -> Aircraft | None:
    """One aircraft from the API's JSON, or None without an identity and position."""
    hex_code = _text(raw.get("hex"))
    callsign = _text(raw.get("flight"))
    lat = _number(raw.get("lat"))
    lon = _number(raw.get("lon"))
    if not hex_code or not callsign or lat is None or lon is None:
        return None

    # alt_baro is a number in the air and the string "ground" on the ground.
    altitude = raw.get("alt_baro")
    on_ground = isinstance(altitude, str) and altitude.strip().lower() == "ground"
    altitude_ft = _number(altitude)
    speed = _number(raw.get("gs"))

    return Aircraft(
        hex=hex_code.lower().lstrip("~"),
        callsign=callsign.upper(),
        registration=_text(raw.get("r")),
        type_code=_text(raw.get("t")),
        type_name=_text(raw.get("desc")),
        lat=lat,
        lon=lon,
        altitude_ft=None if on_ground or altitude_ft is None else round(altitude_ft),
        on_ground=on_ground,
        ground_speed_kt=None if speed is None else round(speed),
        track_deg=_number(raw.get("track")),
        position_age_s=_number(raw.get("seen_pos")),
    )


class AdsbLolClient:
    def __init__(self, client: httpx.AsyncClient, base_url: str = DEFAULT_BASE_URL) -> None:
        # The app's shared client (see app/main.py); its creator closes it.
        self._client = client
        self._base_url = base_url.rstrip("/")

    async def get_by_callsign(self, callsign: str) -> Aircraft | None:
        """The aircraft transmitting `callsign` now, or None if none is."""
        try:
            response = await self._client.get(
                f"{self._base_url}/callsign/{callsign}",
                headers={"User-Agent": USER_AGENT},
            )
        except httpx.HTTPError as exc:
            raise ProviderError(
                f"Request to adsb.lol failed: {type(exc).__name__}: {_EXCERPT.excerpt(str(exc))}"
            ) from None

        if response.status_code == 429:
            raise RateLimitError("adsb.lol rate limit exceeded")
        if response.status_code != 200:
            raise ProviderError(
                f"adsb.lol returned status {response.status_code}: "
                f"{_EXCERPT.excerpt(response.text)}"
            )

        try:
            payload = response.json()
        except ValueError:
            raise ProviderError("adsb.lol returned a non-JSON response") from None
        aircraft = payload.get("ac") if isinstance(payload, dict) else None
        if not isinstance(aircraft, list):
            raise ProviderError("adsb.lol returned an unexpected response")

        wanted = callsign.upper()
        found = [
            parsed
            for raw in aircraft
            if isinstance(raw, dict) and (parsed := parse_aircraft(raw)) is not None
        ]
        # Prefer an exact callsign match, then the freshest position.
        found.sort(
            key=lambda a: (a.callsign != wanted, a.position_age_s if a.position_age_s is not None else 1e9)
        )
        return found[0] if found else None
