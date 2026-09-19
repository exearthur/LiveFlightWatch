from typing import Any

import httpx

from app.models.flight import Airport, Flight, FlightStatus, FlightType
from app.providers.base import FlightProvider, ProviderError

DELAY_THRESHOLD_MINUTES = 15

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
    def __init__(self, api_key: str, base_url: str):
        self._api_key = api_key
        self._base_url = base_url

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
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self._base_url, params=params)
        except httpx.HTTPError as exc:
            raise ProviderError(f"Request to AviationStack failed: {exc}") from exc

        if response.status_code != 200:
            raise ProviderError(
                f"AviationStack returned status {response.status_code}: {response.text[:200]}"
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderError("AviationStack returned a non-JSON response") from exc

        if "error" in payload:
            raise ProviderError(f"AviationStack error: {payload['error']}")

        raw_flights = payload.get("data")
        if raw_flights is None:
            raise ProviderError("AviationStack response missing 'data' field")

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
