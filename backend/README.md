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

## Run

```
uvicorn app.main:app --reload --port 8000
```

Then visit `http://localhost:8000/docs` for interactive API docs, or try:

```
http://localhost:8000/api/flights?airport=JFK&type=departures
```

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
