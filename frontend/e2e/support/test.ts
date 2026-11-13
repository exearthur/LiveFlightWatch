import { expect, test as base } from "@playwright/test";

import { installMockApi, type MockApi } from "./mockApi";

interface Fixtures {
  /** The mocked flights API. Installed for every test, whether or not it asks for it. */
  api: MockApi;
  /** Browser behaviour pinned down so a run doesn't depend on the machine. */
  deterministicBrowser: void;
}

/**
 * `test` for every spec: the API is mocked, location access is denied and an
 * uncaught error in the page fails the test.
 */
export const test = base.extend<Fixtures>({
  api: [
    async ({ page }, use) => {
      const api = await installMockApi(page);
      await use(api);
      expect(
        api.unexpectedRequests,
        "the app sent requests the real API would reject",
      ).toEqual([]);
    },
    { auto: true },
  ],

  deterministicBrowser: [
    async ({ page }, use) => {
      // The Flights page asks for the user's position on first load to pick
      // the nearest airport. Answer "denied" straight away, the same in
      // headless and headed runs, instead of leaving it to a permission
      // prompt nobody is there to click.
      await page.addInitScript(() => {
        const denied = {
          code: 1,
          message: "User denied Geolocation",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError;
        Object.defineProperty(navigator, "geolocation", {
          configurable: true,
          value: {
            getCurrentPosition: (
              _onSuccess: PositionCallback,
              onError?: PositionErrorCallback | null,
            ) => {
              setTimeout(() => onError?.(denied), 0);
            },
            watchPosition: () => 0,
            clearWatch: () => undefined,
          },
        });
      });

      // The production build loads Vercel's analytics script from a path
      // only Vercel serves. Answer it with an empty script so every page
      // load doesn't log a 404 that has nothing to do with the test.
      await page.route("**/_vercel/**", (route) =>
        route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
      );

      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await use();

      expect(pageErrors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
