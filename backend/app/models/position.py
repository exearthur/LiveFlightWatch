from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel


class AirportLocation(BaseModel):
    iata: str
    icao: str
    name: str | None = None
    lat: float
    lon: float


class AirportsResponse(BaseModel):
    # Only the requested codes that are in the table; unknown ones are left out.
    airports: list[AirportLocation]


class Aircraft(BaseModel):
    """One aircraft's latest ADS-B report: where it is and what it is."""

    # The 24-bit ICAO transponder address, as six hex digits ("ac5afd").
    hex: str
    callsign: str
    registration: str | None = None
    # ICAO type designator, e.g. "B38M" for a Boeing 737 MAX 8.
    type_code: str | None = None
    type_name: str | None = None
    lat: float
    lon: float
    # Pressure altitude in feet; None on the ground.
    altitude_ft: int | None = None
    on_ground: bool = False
    ground_speed_kt: int | None = None
    # Direction of travel over the ground, degrees true.
    track_deg: float | None = None
    # How old the position was when the source answered, in seconds.
    position_age_s: float | None = None


@dataclass(frozen=True)
class PositionSnapshot:
    """A lookup's outcome, aircraft or none, and when it was fetched."""

    aircraft: Aircraft | None
    fetched_at: datetime


class PositionResponse(BaseModel):
    callsign: str
    fetched_at: datetime
    cached: bool
    # None when no aircraft is transmitting this callsign right now: it is on
    # the ground with its transponder off, out of receiver range, or flying
    # under another callsign.
    aircraft: Aircraft | None = None
