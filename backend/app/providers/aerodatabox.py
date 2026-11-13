"""AeroDataBox adapter, reached through the RapidAPI gateway.

Written from AeroDataBox's published OpenAPI description (v1.15.4.0,
https://doc.aerodatabox.com/) and tested only against mocked responses: it
has not been run against the live API. See
docs/decisions/0001-data-source-strategy.md for why this provider exists.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import httpx
from pydantic import TypeAdapter, ValidationError

from app.models.flight import Airport, Flight, FlightStatus, FlightType
from app.providers.base import FlightProvider, ProviderError, RateLimitError

# Same rule the AviationStack adapter applies, so "delayed" means the same
# thing whichever provider is selected.
DELAY_THRESHOLD_MINUTES = 15

# The board window, relative to the current local time at the airport. These
# are the API's own defaults, and 12 hours is the longest window the Basic
# and Pro plans allow in one call.
BOARD_OFFSET_MINUTES = -120
BOARD_DURATION_MINUTES = 720

_RAW_STATUS_MAP: dict[str, FlightStatus] = {
    "Unknown": "unknown",
    "Expected": "scheduled",
    "CheckIn": "scheduled",
    "Boarding": "scheduled",
    "GateClosed": "scheduled",
    "Departed": "active",
    "EnRoute": "active",
    "Approaching": "active",
    "Delayed": "delayed",
    "Arrived": "landed",
    "Canceled": "cancelled",
    "Diverted": "diverted",
    # "Status of the flight is uncertain, may be cancelled": not enough to
    # tell a passenger their flight is cancelled.
    "CanceledUncertain": "unknown",
}

# Raw statuses at which the departure (or arrival) has already happened, so
# the provider's single "revised" time is an actual time, not an estimate.
_DEPARTED_STATUSES = {"Departed", "EnRoute", "Approaching", "Arrived"}
_ARRIVED_STATUSES = {"Arrived"}

_DATETIME_ADAPTER = TypeAdapter(datetime)


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()


def _parse_time(value: Any) -> datetime | None:
    """Reads the UTC half of a `{"utc": ..., "local": ...}` time object."""
    raw = _dict(value).get("utc")
    if not isinstance(raw, str):
        return None
    try:
        parsed = _DATETIME_ADAPTER.validate_python(raw)
    except ValidationError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _airport(value: Any) -> Airport:
    airport = _dict(value)
    return Airport(
        iata=_text(airport.get("iata")) or "",
        name=_text(airport.get("name")),
    )


class AeroDataBoxProvider(FlightProvider):
    def __init__(self, api_key: str, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")
        # RapidAPI routes on the host header, which is always the gateway's
        # own hostname.
        self._headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": httpx.URL(self._base_url).host,
        }

    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        url = f"{self._base_url}/flights/airports/iata/{quote(airport, safe='')}"
        params = {
            "offsetMinutes": str(BOARD_OFFSET_MINUTES),
            "durationMinutes": str(BOARD_DURATION_MINUTES),
            "direction": "Departure" if flight_type == "departures" else "Arrival",
            # Without the opposite leg each flight carries one `movement`
            # object: times, terminal and gate at this airport, plus the
            # airport at the other end of the route.
            "withLeg": "false",
            "withCancelled": "true",
            # One row per aircraft movement. A 12-hour window at a large hub
            # is already several hundred rows; listing every partner
            # airline's number for the same departure would multiply that. A
            # codeshare number can still be found through the lookup.
            "withCodeshared": "false",
            "withCargo": "true",
            # Private flights have no flight number to show on a board.
            "withPrivate": "false",
            "withLocation": "false",
        }

        payload = await self._fetch(url, params)
        if payload is None:
            return []
        if not isinstance(payload, dict):
            raise ProviderError("AeroDataBox returned an unexpected airport-board response")

        here = Airport(iata=airport)
        flights: list[Flight] = []
        for raw in payload.get(flight_type) or []:
            movement = _dict(_dict(raw).get("movement"))
            there = _airport(movement.get("airport"))
            if flight_type == "departures":
                origin, destination = here, there
            else:
                origin, destination = there, here
            flights.append(self._to_flight(_dict(raw), movement, origin, destination, flight_type))
        return flights

    async def get_flight_by_number(self, flight_number: str) -> list[Flight]:
        url = f"{self._base_url}/flights/number/{quote(flight_number, safe='')}"
        # withFlightPlan stays off: on some plans a found flight plan doubles
        # the cost of the call.
        params = {
            "withAircraftImage": "false",
            "withLocation": "false",
            "withFlightPlan": "false",
        }

        payload = await self._fetch(url, params)
        if payload is None:
            return []
        if not isinstance(payload, list):
            raise ProviderError("AeroDataBox returned an unexpected flight-status response")

        flights: list[Flight] = []
        for raw in payload:
            departure = _dict(_dict(raw).get("departure"))
            arrival = _dict(_dict(raw).get("arrival"))
            # Normalized on the departure leg, as the AviationStack adapter
            # does for a flight-number lookup.
            flights.append(
                self._to_flight(
                    _dict(raw),
                    departure,
                    _airport(departure.get("airport")),
                    _airport(arrival.get("airport")),
                    "departures",
                )
            )
        return flights

    async def _fetch(self, url: str, params: dict[str, str]) -> Any:
        """Returns the decoded JSON body, or None when the API answers 204
        (nothing matched)."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params, headers=self._headers)
        except httpx.HTTPError as exc:
            raise ProviderError(f"Request to AeroDataBox failed: {exc}") from exc

        if response.status_code == 204:
            return None

        try:
            payload = response.json()
        except ValueError:
            payload = None

        if response.status_code == 429:
            message = _text(_dict(payload).get("message"))
            raise RateLimitError(message or "AeroDataBox rate limit or monthly quota exceeded")

        if response.status_code != 200:
            raise ProviderError(
                f"AeroDataBox returned status {response.status_code}: {response.text[:200]}"
            )

        if payload is None:
            raise ProviderError("AeroDataBox returned a non-JSON response")

        return payload

    def _to_flight(
        self,
        raw: dict[str, Any],
        leg: dict[str, Any],
        origin: Airport,
        destination: Airport,
        flight_type: FlightType,
    ) -> Flight:
        raw_status = _text(raw.get("status")) or "Unknown"
        scheduled = _parse_time(leg.get("scheduledTime"))
        # The gate time when the provider has one, otherwise the runway time.
        revised = _parse_time(leg.get("revisedTime")) or _parse_time(leg.get("runwayTime"))

        status: FlightStatus = _RAW_STATUS_MAP.get(raw_status, "unknown")
        if (
            status in ("scheduled", "active")
            and scheduled is not None
            and revised is not None
            and revised - scheduled > timedelta(minutes=DELAY_THRESHOLD_MINUTES)
        ):
            status = "delayed"

        happened = _DEPARTED_STATUSES if flight_type == "departures" else _ARRIVED_STATUSES
        # The API accepts, and may return, spaced flight numbers ("DL 123");
        # the rest of the app, and the lookup endpoint's own validation, use
        # the compact form.
        flight_number = "".join((_text(raw.get("number")) or "").split()) or "Unknown"

        return Flight(
            flight_number=flight_number,
            airline=_text(_dict(raw.get("airline")).get("name")),
            origin=origin,
            destination=destination,
            scheduled_time=scheduled,
            estimated_time=revised,
            actual_time=revised if raw_status in happened else None,
            status=status,
            terminal=_text(leg.get("terminal")),
            gate=_text(leg.get("gate")),
        )
