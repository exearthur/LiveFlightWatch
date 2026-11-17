// Shared by playwright.config.ts (which builds and serves the app) and the
// specs (which mock the API the build points at).

export const APP_HOST = "127.0.0.1";
// Not Vite's default preview port (4173), so a preview server a developer
// already has running is never mistaken for the e2e build.
export const APP_PORT = 4317;
export const APP_URL = `http://${APP_HOST}:${APP_PORT}`;

/**
 * Baked into the e2e build as `VITE_API_URL`. Every request to it is answered
 * by the mock in `support/mockApi.ts`. `.test` is a reserved TLD that never
 * resolves, so a request the mock somehow missed fails instead of reaching a
 * real server.
 */
export const API_ORIGIN = "https://api.liveflightwatch.test";
