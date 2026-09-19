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
    scheduled_time: datetime | None = None
    estimated_time: datetime | None = None
    actual_time: datetime | None = None
    status: FlightStatus = "unknown"
    terminal: str | None = None
    gate: str | None = None


class FlightsResponse(BaseModel):
    airport: str
    type: FlightType
    fetched_at: datetime
    cached: bool
    flights: list[Flight]
