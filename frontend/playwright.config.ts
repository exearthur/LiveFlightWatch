import { defineConfig, devices } from "@playwright/test";

import { API_ORIGIN, APP_HOST, APP_PORT, APP_URL } from "./e2e/env";

const isCI = !!process.env.CI;

// Built into its own folder so an e2e run never leaves a `dist/` behind that
// points at the fake API origin.
const BUILD_DIR = "dist-e2e";

// End-to-end smoke tests: the production build, served by `vite preview`,
// driven in Chromium against a mocked API (see e2e/support/mockApi.ts).
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  // The API is mocked, so a failure is a real one: no retries to hide flakiness.
  retries: 0,
  reporter: isCI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_URL,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      `npx vite build --outDir ${BUILD_DIR} && ` +
      `npx vite preview --outDir ${BUILD_DIR} --host ${APP_HOST} --port ${APP_PORT} --strictPort`,
    url: APP_URL,
    // Takes precedence over any .env file, so the suite needs none.
    env: { VITE_API_URL: API_ORIGIN },
    // Always rebuild: a server left over from an earlier run would serve stale code.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
