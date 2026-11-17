# LiveFlightWatch backend

FastAPI service that proxies a flight-data provider (AviationStack by default,
or AeroDataBox) and normalizes results into a common `Flight` shape for the
frontend.

## Setup

```
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements-dev.txt
copy .env.example .env
```

Dependencies are pinned to exact versions in two files:

- `requirements.txt` — what the app needs to run. This is all the Docker image installs.
- `requirements-dev.txt` — includes `requirements.txt` and adds the test and lint tools (pytest, pytest-cov, ruff, mypy).

Edit `.env` and set `AVIATIONSTACK_API_KEY` to a real key from
https://aviationstack.com/ (free tier available). The app will not work with a
placeholder key — there is no mock/stub mode.

## Choosing the provider

`FLIGHT_PROVIDER` selects the upstream API. It defaults to `aviationstack`.
To use AeroDataBox instead, set these in `.env`:

```
FLIGHT_PROVIDER=aerodatabox
AERODATABOX_API_KEY=<your RapidAPI key>
```

AeroDataBox is reached through RapidAPI; subscribe to a plan at
https://rapid.aerodatabox.com/pricing to get the key. Only the selected
provider's key is required, and the app refuses to start without it.

The AeroDataBox adapter (`app/providers/aerodatabox.py`) was written from the
provider's published API description and is tested against mocked responses
only. It has not been run against the live API yet. The reasons for having two
providers are in `../docs/decisions/0001-data-source-strategy.md`.

## Provider time formats

Every `Flight` time the API returns is a UTC instant, and `Flight.timezone`
names the zone to show it in (see "Times and time zones" in `../README.md`).
The two providers need different handling to get there.

**AviationStack labels local times as UTC.** Every `scheduled`, `estimated`
and `actual` value ends in `+00:00`, but the digits are the wall-clock time at
that leg's own airport, whose IANA zone is in the leg's `timezone` field. The
adapter (`_to_instant` in `app/providers/aviationstack.py`) therefore ignores
the offset and reads the digits in that zone. Two things follow:

- A leg with no `timezone`, or one the zone database does not know, has its
  times dropped (`null`) and a warning logged. Passing the digits through as
  UTC would show a time that is wrong by the airport's offset.
- A wall-clock time in the hour that repeats when clocks go back is read as
  its first occurrence. One in the hour that is skipped when clocks go forward
  is moved forward by the gap (02:30 becomes 03:30).

This was checked in November 2026 against one real response for Atlanta
departures, four rows of which are kept in
`tests/fixtures/aviationstack_atl_departures.json`:

- Delta 27 to Seoul (listed as its codeshare KE5036) came back as
  `"scheduled": "2026-11-12T23:50:00+00:00"`. FlightStats listed that flight
  as scheduled for 23:50 EST.
- Its `live.updated` position report, a field that is real UTC, was
  `2026-11-13T05:23:47Z` with the aircraft over Tennessee. The `actual`
  departure of `23:54` fits as Eastern time (04:54Z) and not as UTC.
- Its arrival was `2026-11-14T05:45:00+00:00` with `Asia/Seoul`: a 15 h 55 min
  flight read as Seoul time, a 29 h 55 min one read as UTC.

If AviationStack ever starts sending true UTC, the board will be off by each
airport's offset. `tests/test_aviationstack_times.py` is the place to start.

**AeroDataBox gives each time twice**, as `{"utc": ..., "local": ...}`. The
adapter takes the instant from `utc`. For the zone, a flight-status leg names
its own airport, so that airport's `timeZone` is used. An airport board does
not: each row's `airport` is the one at the other end of the route, and
nothing in the response names the board airport's zone. There the adapter
reports the offset between the two halves of a time, such as `-05:00`, and the
frontend labels it `GMT-5`. Like the rest of that adapter this follows the
published API description and has not been checked against a live response.

Zone lookups use Python's `zoneinfo`. `tzdata` is pinned in `requirements.txt`
so they work on a host with no zone files of its own, such as Windows, and do
not depend on what a container image happens to ship.

## Run

```
uvicorn app.main:app --reload --port 8000
```

Then visit `http://localhost:8000/docs` for interactive API docs, or try:

```
http://localhost:8000/api/flights?airport=JFK&type=departures
```

## Upstream calls and errors

All calls to the provider go through one `httpx.AsyncClient`. The app creates
it when it starts and closes it when it shuts down (the lifespan in
`app/main.py`), so connections to the provider are reused.

When the provider fails, the client gets a `502` (or a `429` for a rate limit
or used-up quota) with a fixed, generic message. What the provider actually
said is logged by `app.errors`, at ERROR for a 502 and WARNING for a 429:

```
Flight provider failure on GET /api/flights, responding 502: AviationStack returned an error (status 401, error code 'invalid_access_key'): ...
```

API keys are redacted before anything is logged. That includes the request
line httpx logs for every upstream call, which for AviationStack would
otherwise contain `access_key=<your key>`. The app adds no log handlers or
formats of its own; it uses whatever uvicorn or the host has configured.

## Running tests

```
pip install -r requirements-dev.txt
pytest --cov
```

Tests use mocked HTTP responses for the AviationStack and AeroDataBox providers
and a fake for the flight service, so no real API key or network access is
required to run them.

`--cov` prints a coverage report for `app/` and fails the run if total coverage
drops below the `fail_under` value in `pyproject.toml`. Plain `pytest` runs the
tests without coverage.

## Lint and type check

```
ruff check .
mypy
```

Both are configured in `pyproject.toml` and run in CI alongside the tests.
