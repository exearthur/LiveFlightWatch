# LiveFlightWatch
This is a simple web dashboard that pulls flight status data and displays it cleanly, with delay warnings and live updates.

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
