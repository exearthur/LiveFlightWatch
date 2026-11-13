from typing import Any

import httpx

from app.core.redaction import SecretRedactor
from app.models.flight import Airport, Flight, FlightStatus, FlightType
from app.providers.base import FlightProvider, ProviderError, RateLimitError

DELAY_THRESHOLD_MINUTES = 15

# AviationStack's own codes for "you've used up your quota" / "too many
# requests per minute" (the latter is unlikely on a free-tier key, but
# cheap to handle the same way).
_RATE_LIMIT_ERROR_CODES = {"usage_limit_reached", "rate_limit_reached"}

_RAW_STATUS_MAP: dict[str, FlightStatus] = {
    "scheduled": "scheduled",
    "active": "active",
    "landed": "landed",
    "cancelled": "cancelled",
    "diverted": "diverted",
    "incident": "unknown",
}

# AviationStack sometimes returns literal placeholder strings instead of
# null for missing fields (e.g. an airline name of "empty").
_PLACEHOLDER_VALUES = {"", "n/a", "na", "unknown", "empty", "none", "null"}


def _clean(value: str | None) -> str | None:
    if value is None or value.strip().lower() in _PLACEHOLDER_VALUES:
        return None
    return value


class AviationStackProvider(FlightProvider):
    def __init__(self, api_key: str, base_url: str, client: httpx.AsyncClient):
        self._api_key = api_key
        self._base_url = base_url
        # The app's shared client (see app/main.py). Not closed here: its
        # creator owns it.
        self._client = client
        # The key travels as a query parameter, so it is part of every
        # request URL and of anything upstream that echoes the request.
        self._redactor = SecretRedactor([api_key])

    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        params = {"access_key": self._api_key}
        if flight_type == "departures":
            params["dep_iata"] = airport
        else:
            params["arr_iata"] = airport

        raw_flights = await self._fetch(params)
        return [self._to_flight(raw, flight_type) for raw in raw_flights]

    async def get_flight_by_number(self, flight_number: str) -> list[Flight]:
        params = {"access_key": self._api_key, "flight_iata": flight_number}

        raw_flights = await self._fetch(params)
        # A flight-number lookup isn't tied to a departures/arrivals leg the
        # way an airport search is, but Flight only has one set of
        # terminal/gate/status fields, so we normalize using the departure
        # leg (matches AviationStack's own default framing for flight_iata
        # lookups).
        return [self._to_flight(raw, "departures") for raw in raw_flights]

    async def _fetch(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        # Every message raised here ends up in the server log, never in a
        # response, and anything upstream-supplied in it (exception text,
        # error code, body) goes through the redactor first.
        try:
            response = await self._client.get(self._base_url, params=params)
        except (httpx.HTTPError, httpx.InvalidURL) as exc:
            # `from None`: the httpx exception holds the request, and so the
            # URL with the key in it. Chaining it would put it back within
            # reach of anything that logs a traceback.
            raise ProviderError(
                f"Request to AviationStack failed: {type(exc).__name__}: "
                f"{self._redactor.excerpt(str(exc))}"
            ) from None

        try:
            payload = response.json()
        except ValueError:
            payload = None

        error_body = payload.get("error") if isinstance(payload, dict) else None
        raw_code = error_body.get("code") if isinstance(error_body, dict) else None
        error_code = raw_code if isinstance(raw_code, str) else None

        def describe(summary: str) -> str:
            # Only built on a failure: redacting a full, successful response
            # body on every call would be wasted work.
            status = f"status {response.status_code}"
            if error_code is not None:
                status += f", error code {self._redactor.excerpt(error_code)}"
            upstream = str(error_body) if error_body is not None else response.text
            return f"{summary} ({status}): {self._redactor.excerpt(upstream)}"

        if response.status_code == 429 or error_code in _RATE_LIMIT_ERROR_CODES:
            raise RateLimitError(describe("AviationStack rate limit or monthly quota exceeded"))

        if response.status_code != 200:
            raise ProviderError(describe("AviationStack returned an error"))

        if payload is None:
            raise ProviderError(describe("AviationStack returned a non-JSON response"))

        if error_body is not None:
            raise ProviderError(describe("AviationStack reported an error"))

        # A body that is valid JSON but not the documented object with a
        # `data` list is an upstream failure like any other, not a crash.
        raw_flights = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(raw_flights, list):
            raise ProviderError(describe("AviationStack response missing 'data' list"))

        return raw_flights

    def _to_flight(self, raw: dict[str, Any], flight_type: FlightType) -> Flight:
        departure = raw.get("departure") or {}
        arrival = raw.get("arrival") or {}
        airline = raw.get("airline") or {}
        flight_info = raw.get("flight") or {}

        leg = departure if flight_type == "departures" else arrival
        delay_minutes = leg.get("delay") or 0

        status = _RAW_STATUS_MAP.get(raw.get("flight_status", ""), "unknown")
        if status in ("scheduled", "active") and delay_minutes > DELAY_THRESHOLD_MINUTES:
            status = "delayed"

        flight_number = (
            _clean(flight_info.get("iata")) or _clean(flight_info.get("number")) or "Unknown"
        )

        return Flight(
            flight_number=flight_number,
            airline=_clean(airline.get("name")),
            origin=Airport(iata=departure.get("iata", ""), name=_clean(departure.get("airport"))),
            destination=Airport(iata=arrival.get("iata", ""), name=_clean(arrival.get("airport"))),
            scheduled_time=leg.get("scheduled"),
            estimated_time=leg.get("estimated"),
            actual_time=leg.get("actual"),
            status=status,
            terminal=_clean(leg.get("terminal")),
            gate=_clean(leg.get("gate")),
        )
