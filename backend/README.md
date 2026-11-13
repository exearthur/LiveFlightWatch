# LiveFlightWatch backend

FastAPI service that proxies a flight-data provider (AviationStack) and normalizes
results into a common `Flight` shape for the frontend.

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

Tests use fakes/mocks for the AviationStack provider and the flight service,
so no real API key or network access is required to run them.

`--cov` prints a coverage report for `app/` and fails the run if total coverage
drops below the `fail_under` value in `pyproject.toml`. Plain `pytest` runs the
tests without coverage.

## Lint and type check

```
ruff check .
mypy
```

Both are configured in `pyproject.toml` and run in CI alongside the tests.
