# LiveFlightWatch

A universal flight tracker — live departures and arrivals for any airport worldwide, plus lookup by flight number. No waiting on the slow board at the gate.

**Live:** [live-flight-watch.vercel.app](https://live-flight-watch.vercel.app)

## Features

- Live departures/arrivals for any airport by IATA code (e.g. `JFK`, `LHR`)
- Flight number lookup (e.g. `AA100`) as an alternative search mode
- Filter results by airline and status
- Favorites — save a search and jump back to it from the Favorites page
- Recently-searched airports for quick re-access
- Light/dark mode
- Desktop table + mobile card layout
- Searches are shareable via URL (filters sync to query params) and support browser back/forward
- Graceful handling of the flight-data provider's rate limit (a "quota reached" state instead of a generic error, with polling paused until it clears)

## Tech stack

**Backend** (`backend/`): Python, FastAPI, httpx (async), Pydantic — a thin proxy over the [AviationStack](https://aviationstack.com/) API with an in-memory TTL cache and a provider-adapter layer so the data source can be swapped later.

**Frontend** (`frontend/`): React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router.

**Testing**: pytest (backend), Vitest + React Testing Library (frontend).

**CI**: GitHub Actions runs both test suites, plus frontend lint and build, on every push to `main` and every PR (`.github/workflows/ci.yml`).

## Project structure

```
backend/
  app/
    routers/       FastAPI route handlers
    services/       caching/orchestration between routers and providers
    providers/      FlightProvider interface + the AviationStack implementation
    models/         Pydantic response schemas
    core/           TTL cache
  tests/
frontend/
  src/
    pages/          Flights (home), Favorites, About, Contact
    components/     FlightsTable and shared UI
    hooks/          useFlights, useFlightLookup, useFavorites, useRecentAirports, useTheme, useNearestAirport
    lib/            API client, filter/geo helpers
```

## Local development

### Backend

```
cd backend
python -m venv .venv && .venv\Scripts\activate   # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env   # then fill in a real AVIATIONSTACK_API_KEY from aviationstack.com
uvicorn app.main:app --reload --port 8000
```

API docs are then available at `http://localhost:8000/docs`.

### Frontend

```
cd frontend
npm install
cp .env.example .env   # VITE_API_URL should point at the backend above (http://localhost:8000 by default)
npm run dev
```

## Testing

```
cd backend && pytest -v
cd frontend && npm run test    # or `npm run test:watch`
```

Also run `npm run lint` and `npm run build` in `frontend/` before pushing — CI checks both.

## API reference

- `GET /api/flights?airport={IATA}&type=departures|arrivals` — flights for an airport (defaults to `departures`).
- `GET /api/flights/lookup?flight_number={code}` — a specific flight (e.g. `AA100`).

Both return `429` if the upstream provider's rate limit is hit, and `502` on other upstream failures.

## Deployment

Deploy the backend first, since the frontend needs its live URL. Recommended: Render (backend) + Vercel (frontend), both free-tier.

### Backend (Render)

1. On [render.com](https://render.com), **New > Blueprint**, connect this GitHub repo. Render will read `render.yaml` at the repo root and configure the service automatically.
2. When prompted for env vars, set:
   - `AVIATIONSTACK_API_KEY` — your key from [aviationstack.com](https://aviationstack.com/).
   - `CORS_ORIGINS` — leave a placeholder for now (e.g. `http://localhost:5173`); you'll update it once the frontend URL exists (step 3 below).
3. Deploy, then copy the resulting service URL (e.g. `https://liveflightwatch-backend.onrender.com`).
4. Note: Render's free tier spins the service down after ~15 minutes idle; the first request after that takes 30-60s to cold-start.

Without a Blueprint, the same service can be created manually as a **Web Service** with runtime "Docker", root directory `backend`, and the same env vars above.

### Frontend (Vercel)

1. On [vercel.com](https://vercel.com), **New Project**, import this repo.
2. Set **Root Directory** to `frontend` (this is a monorepo — Vercel needs to know the frontend isn't at the repo root).
3. Framework preset should auto-detect as Vite (`npm run build`, output `dist/`).
4. Add environment variable `VITE_API_URL` = the Render backend URL from step 3 above.
5. Deploy, then copy the resulting frontend URL (e.g. `https://liveflightwatch.vercel.app`).
6. Go back to the Render service's env vars and update `CORS_ORIGINS` to this real frontend URL, then redeploy the backend so it accepts requests from it.

See `backend/.env.example` and `frontend/.env.example` for the full list of local defaults.
