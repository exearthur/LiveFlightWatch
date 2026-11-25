"""IATA -> ICAO airport codes, from app/data/airport_icao_codes.json.

The table is generated from OurAirports by scripts/build_airport_codes.py.
"""

import json
from functools import lru_cache
from pathlib import Path

_TABLE = Path(__file__).resolve().parent.parent / "data" / "airport_icao_codes.json"


@lru_cache(maxsize=1)
def _codes() -> dict[str, str]:
    data = json.loads(_TABLE.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{_TABLE} does not hold an object of airport codes")
    return {str(iata): str(icao) for iata, icao in data.items()}


def icao_for_iata(iata: str) -> str | None:
    """The ICAO code for an IATA airport code, or None for one not in the table."""
    return _codes().get(iata.strip().upper())
