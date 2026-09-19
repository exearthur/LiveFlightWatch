import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFlights } from "@/lib/api";
import type { FlightsResponse } from "@/types/flight";

function mockFetchOnce(response: {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getFlights", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the flights endpoint with the airport and type in the query string", async () => {
    const sample: FlightsResponse = {
      airport: "JFK",
      type: "departures",
      fetched_at: "2026-01-01T00:00:00Z",
      cached: false,
      flights: [],
    };
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: async () => sample });

    await getFlights("JFK", "departures");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestedUrl] = fetchMock.mock.calls[0];
    expect(String(requestedUrl)).toContain("/api/flights?airport=JFK&type=departures");
  });

  it("resolves with the parsed JSON body on a 2xx response", async () => {
    const sample: FlightsResponse = {
      airport: "LAX",
      type: "arrivals",
      fetched_at: "2026-01-01T00:00:00Z",
      cached: true,
      flights: [],
    };
    mockFetchOnce({ ok: true, status: 200, json: async () => sample });

    const result = await getFlights("LAX", "arrivals");

    expect(result).toEqual(sample);
  });

  it("throws an Error using the response's detail message on a non-2xx response", async () => {
    mockFetchOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Airport not found" }),
    });

    await expect(getFlights("ZZZ", "departures")).rejects.toThrow("Airport not found");
  });

  it("falls back to a generic message when the error body isn't parseable JSON", async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

    await expect(getFlights("JFK", "departures")).rejects.toThrow(
      "Request failed with status 500",
    );
  });

  it("falls back to a generic message when the error body has no detail field", async () => {
    mockFetchOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    await expect(getFlights("JFK", "departures")).rejects.toThrow(
      "Request failed with status 502",
    );
  });
});
