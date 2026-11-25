"""Builds app/data/airport_icao_codes.json, the IATA -> ICAO airport table.

The weather service needs it because aviationweather.gov only accepts ICAO
station codes (KJFK), while the rest of the app uses IATA codes (JFK).

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
OUTPUT = Path(__file__).resolve().parent.parent / "app" / "data" / "airport_icao_codes.json"

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


def build(rows: list[dict[str, str]]) -> dict[str, str]:
    table: dict[str, str] = {}
    for row in rows:
        iata = (row.get("iata_code") or "").strip().upper()
        icao = icao_for(row)
        if IATA.match(iata) and icao:
            table[iata] = icao
    return dict(sorted(table.items()))


def main() -> None:
    table = build(read_rows(sys.argv[1] if len(sys.argv) > 1 else None))
    OUTPUT.write_text(json.dumps(table, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(table)} airports to {OUTPUT}")


if __name__ == "__main__":
    main()
