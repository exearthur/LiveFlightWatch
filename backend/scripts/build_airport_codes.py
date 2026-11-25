"""Builds app/data/airports.json: for each IATA airport code, its ICAO code,
name and position, as [icao, name, latitude, longitude].

The weather service needs the ICAO code because aviationweather.gov only
accepts ICAO station codes (KJFK), while the rest of the app uses IATA codes
(JFK). The live map needs the position to draw a flight's route.

Source: OurAirports (https://ourairports.com/data/), released into the public
domain. Run from backend/ to refresh the table:

    python scripts/build_airport_codes.py            # downloads airports.csv
    python scripts/build_airport_codes.py path.csv   # or uses a local copy
"""

import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

SOURCE_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
OUTPUT = Path(__file__).resolve().parent.parent / "app" / "data" / "airports.json"

IATA = re.compile(r"^[A-Z]{3}$")
ICAO = re.compile(r"^[A-Z]{4}$")


def read_rows(source: str | None) -> list[dict[str, str]]:
    if source:
        text = Path(source).read_text(encoding="utf-8")
    else:
        with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
            text = response.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def icao_for(row: dict[str, str]) -> str | None:
    # icao_code is the official code; gps_code and ident carry it for many
    # airports where icao_code is blank.
    for field in ("icao_code", "gps_code", "ident"):
        value = (row.get(field) or "").strip().upper()
        if ICAO.match(value):
            return value
    return None


def coordinate(value: str | None) -> float | None:
    try:
        return round(float(value or ""), 4)
    except ValueError:
        return None


def build(rows: list[dict[str, str]]) -> dict[str, list[str | float]]:
    table: dict[str, list[str | float]] = {}
    for row in rows:
        iata = (row.get("iata_code") or "").strip().upper()
        icao = icao_for(row)
        lat = coordinate(row.get("latitude_deg"))
        lon = coordinate(row.get("longitude_deg"))
        if IATA.match(iata) and icao and lat is not None and lon is not None:
            table[iata] = [icao, (row.get("name") or "").strip(), lat, lon]
    return dict(sorted(table.items()))


def main() -> None:
    table = build(read_rows(sys.argv[1] if len(sys.argv) > 1 else None))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(table, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(table)} airports to {OUTPUT}")


if __name__ == "__main__":
    main()
