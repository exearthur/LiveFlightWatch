"""Airports by IATA code, from app/data/airports.json: each one's ICAO code,
name and position.

The table is generated from OurAirports by scripts/build_airport_codes.py.
"""

import json
from functools import lru_cache
from pathlib import Path

from app.models.position import AirportLocation

_TABLE = Path(__file__).resolve().parent.parent / "data" / "airports.json"


@lru_cache(maxsize=1)
def _airports() -> dict[str, AirportLocation]:
    data = json.loads(_TABLE.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{_TABLE} does not hold an object of airports")
    return {
        iata: AirportLocation(iata=iata, icao=icao, name=name or None, lat=lat, lon=lon)
        for iata, (icao, name, lat, lon) in data.items()
    }


def airport_for_iata(iata: str) -> AirportLocation | None:
    """The airport with this IATA code, or None for one not in the table."""
    return _airports().get(iata.strip().upper())


def icao_for_iata(iata: str) -> str | None:
    """The ICAO code for an IATA airport code, or None for one not in the table."""
    airport = airport_for_iata(iata)
    return airport.icao if airport else None
