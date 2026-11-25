from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

FlightStatus = Literal[
    "scheduled", "active", "landed", "cancelled", "diverted", "delayed", "unknown"
]

FlightType = Literal["departures", "arrivals"]


class Airport(BaseModel):
    iata: str
    name: str | None = None


class Flight(BaseModel):
    flight_number: str
    airline: str | None = None
    origin: Airport
    destination: Airport
    # The three times are instants (points on the UTC timeline), never
    # airport wall-clock values. A time the provider did not give, or one
    # that could not be placed on the timeline, is None.
    scheduled_time: datetime | None = None
    estimated_time: datetime | None = None
    actual_time: datetime | None = None
    status: FlightStatus = "unknown"
    terminal: str | None = None
    gate: str | None = None
    # The zone to show the times in: that of the airport they belong to (the
    # origin on a departures board or a flight-number lookup, the destination
    # on an arrivals board). An IANA name such as "America/New_York", or a
    # fixed offset such as "-05:00" when the provider gives only an offset.
    # None when the provider does not say; clients then fall back to the
    # viewer's own zone.
    timezone: str | None = None
    # The ICAO flight designator the aircraft uses as its radio callsign
    # ("DAL27" for DL27), which is how live-position services identify it.
    # For a codeshare it is the operating flight's, not the one sold. None
    # when the provider does not give it.
    callsign: str | None = None


@dataclass(frozen=True)
class FlightSnapshot:
    """One provider result together with the moment it was fetched.

    This is the unit FlightService caches, so a response served from cache
    reports the age of its data rather than the time of the request. Not part
    of the API: the response models below copy what they need from it.
    """

    flights: list[Flight]
    fetched_at: datetime


class FlightsResponse(BaseModel):
    airport: str
    type: FlightType
    fetched_at: datetime
    cached: bool
    flights: list[Flight]


class FlightLookupResponse(BaseModel):
    """Response shape for a direct flight-number lookup (as opposed to an
    airport departures/arrivals search). Mirrors FlightsResponse but keyed
    by flight number instead of airport/type, since a lookup isn't tied to
    either."""

    flight_number: str
    fetched_at: datetime
    cached: bool
    flights: list[Flight]
