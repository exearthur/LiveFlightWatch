import type { Page, Route } from "@playwright/test";

import { API_ORIGIN } from "../env";
import {
  flightLookupResponse,
  flightsResponse,
  INVALID_REQUEST_BODY,
  NOT_FOUND_BODY,
  RATE_LIMITED_BODY,
} from "../fixtures/flights";

// The same query validation the FastAPI routes apply (backend/app/routers/flights.py).
const AIRPORT_PATTERN = /^[A-Za-z]{3}$/;
const FLIGHT_NUMBER_PATTERN = /^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$/;

export interface MockApi {
  /** Path and query of every request the app sent to the API, in order. */
  readonly requests: string[];
  /** Requests the real API would have rejected or has no route for. */
  readonly unexpectedRequests: string[];
  /** Makes every request answer 429, like the backend does when the provider's quota is spent. */
  exhaustQuota(): void;
  /** Undoes `exhaustQuota()`. */
  restoreQuota(): void;
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    // The app is served from another origin, as it is in production.
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

/**
 * Answers everything the page sends to `API_ORIGIN` from the fixtures, so no
 * backend runs and nothing leaves the machine.
 */
export async function installMockApi(page: Page): Promise<MockApi> {
  const requests: string[] = [];
  const unexpectedRequests: string[] = [];
  let quotaExhausted = false;

  await page.route(
    (url) => url.origin === API_ORIGIN,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const summary = `${request.method()} ${url.pathname}${url.search}`;
      requests.push(summary);

      if (request.method() === "GET" && url.pathname === "/api/flights") {
        const airport = url.searchParams.get("airport") ?? "";
        const type = url.searchParams.get("type") ?? "departures";
        if (AIRPORT_PATTERN.test(airport) && (type === "departures" || type === "arrivals")) {
          if (quotaExhausted) return json(route, 429, RATE_LIMITED_BODY);
          return json(route, 200, flightsResponse(airport.toUpperCase(), type));
        }
        unexpectedRequests.push(summary);
        return json(route, 422, INVALID_REQUEST_BODY);
      }

      if (request.method() === "GET" && url.pathname === "/api/flights/lookup") {
        const flightNumber = url.searchParams.get("flight_number") ?? "";
        if (FLIGHT_NUMBER_PATTERN.test(flightNumber)) {
          if (quotaExhausted) return json(route, 429, RATE_LIMITED_BODY);
          return json(route, 200, flightLookupResponse(flightNumber.toUpperCase()));
        }
        unexpectedRequests.push(summary);
        return json(route, 422, INVALID_REQUEST_BODY);
      }

      unexpectedRequests.push(summary);
      return json(route, 404, NOT_FOUND_BODY);
    },
  );

  return {
    requests,
    unexpectedRequests,
    exhaustQuota: () => {
      quotaExhausted = true;
    },
    restoreQuota: () => {
      quotaExhausted = false;
    },
  };
}
