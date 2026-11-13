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
