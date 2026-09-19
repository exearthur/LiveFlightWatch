# LiveFlightWatch backend

FastAPI service that proxies a flight-data provider (AviationStack) and normalizes
results into a common `Flight` shape for the frontend.

## Setup

```
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env
```

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
pip install -r requirements.txt
pytest
```

Tests use fakes/mocks for the AviationStack provider and the flight service,
so no real API key or network access is required to run them.
