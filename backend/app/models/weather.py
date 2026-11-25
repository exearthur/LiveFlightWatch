from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# Flight rules category, from the ceiling and visibility: visual (VFR),
# marginal visual (MVFR), instrument (IFR), low instrument (LIFR).
FlightCategory = Literal["VFR", "MVFR", "IFR", "LIFR"]


class CloudLayer(BaseModel):
    # METAR cover code: FEW, SCT, BKN, OVC, or CLR/SKC/CAVOK for clear sky.
    cover: str
    # Height of the layer's base above the airport, in feet. None for a
    # clear-sky report, which has no base.
    base_ft: int | None = None


class Weather(BaseModel):
    """A decoded METAR: the routine weather report an airport issues about
    once an hour. Any field the report leaves out is None."""

    station: str
    station_name: str | None = None
    observed_at: datetime
    # The report as issued, for anyone who reads METAR.
    raw: str
    flight_category: FlightCategory | None = None
    temperature_c: float | None = None
    dewpoint_c: float | None = None
    # Direction the wind blows from, in degrees true. None when calm or
    # variable (see wind_variable).
    wind_direction_deg: int | None = None
    wind_variable: bool = False
    wind_speed_kt: int | None = None
    wind_gust_kt: int | None = None
    # Statute miles, as reported: "10+" means ten or more.
    visibility_sm: str | None = None
    altimeter_hpa: float | None = None
    clouds: list[CloudLayer] = []


@dataclass(frozen=True)
class WeatherSnapshot:
    """A report together with when it was fetched, as held in the cache."""

    weather: Weather
    fetched_at: datetime


class WeatherResponse(BaseModel):
    # The IATA code the client asked about.
    airport: str
    fetched_at: datetime
    cached: bool
    weather: Weather
