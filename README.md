# LiveFlightWatch
This is a simple web dashboard that pulls flight status data and displays it cleanly, with delay warnings and live updates.

## Deployment

### Frontend

The frontend (`frontend/`) is a standard Vite + React static build and deploys to any static host such as Vercel or Netlify:

- Build command: `npm run build`
- Output directory: `dist/`
- Required environment variable: `VITE_API_URL` — set this to the deployed backend's URL (e.g. `https://your-backend.onrender.com`).

### Backend

The backend (`backend/`) is a FastAPI app and deploys via the included `backend/Dockerfile` to any container host (Render, Fly.io, Railway, etc.):

- Build context: `backend/`
- The container reads its port from the `$PORT` env var injected by the platform, falling back to `8000` for local `docker run`.
- Required environment variables:
  - `AVIATIONSTACK_API_KEY` — your API key from [aviationstack.com](https://aviationstack.com/).
  - `CORS_ORIGINS` — comma-separated list of allowed origins; set this to the deployed frontend's real URL (not `http://localhost:5173`).

See `backend/.env.example` and `frontend/.env.example` for the full list of local defaults.
