import { describe, expect, it } from "vitest";

import {
  ALL_AIRLINES,
  ALL_STATUSES,
  filterFlightsByAirline,
  filterFlightsByDestination,
  filterFlightsByStatus,
  getUniqueAirlines,
} from "@/lib/flightFilters";
import type { Flight } from "@/types/flight";

function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    flight_number: "AA100",
    airline: "American Airlines",
    origin: { iata: "JFK", name: "John F Kennedy" },
    destination: { iata: "LAX", name: "Los Angeles" },
    scheduled_time: "2026-01-01T10:00:00Z",
    estimated_time: "2026-01-01T10:05:00Z",
    actual_time: null,
    status: "scheduled",
    terminal: "4",
    gate: "12",
    ...overrides,
  };
}

describe("getUniqueAirlines", () => {
  it("returns an empty array for an empty flight list", () => {
    expect(getUniqueAirlines([])).toEqual([]);
  });

  it("returns the unique, sorted airline names", () => {
    const flights = [
      makeFlight({ flight_number: "1", airline: "United" }),
      makeFlight({ flight_number: "2", airline: "Delta" }),
      makeFlight({ flight_number: "3", airline: "United" }),
      makeFlight({ flight_number: "4", airline: "American Airlines" }),
    ];

    expect(getUniqueAirlines(flights)).toEqual([
      "American Airlines",
      "Delta",
      "United",
    ]);
  });

  it("excludes flights with a null airline", () => {
    const flights = [
      makeFlight({ flight_number: "1", airline: null }),
      makeFlight({ flight_number: "2", airline: "Delta" }),
    ];

    expect(getUniqueAirlines(flights)).toEqual(["Delta"]);
  });

  it("does not mutate the input array", () => {
    const flights = [
      makeFlight({ flight_number: "1", airline: "Zeta" }),
      makeFlight({ flight_number: "2", airline: "Alpha" }),
    ];
    const copy = [...flights];

    getUniqueAirlines(flights);

    expect(flights).toEqual(copy);
  });
});

describe("filterFlightsByAirline", () => {
  const flights = [
    makeFlight({ flight_number: "1", airline: "United" }),
    makeFlight({ flight_number: "2", airline: "Delta" }),
    makeFlight({ flight_number: "3", airline: null }),
  ];

  it("returns all flights when airline is ALL_AIRLINES", () => {
    expect(filterFlightsByAirline(flights, ALL_AIRLINES)).toEqual(flights);
  });

  it("returns all flights when airline is an empty string", () => {
    expect(filterFlightsByAirline(flights, "")).toEqual(flights);
  });

  it("returns only flights matching the selected airline", () => {
    const result = filterFlightsByAirline(flights, "United");
    expect(result).toHaveLength(1);
    expect(result[0].flight_number).toBe("1");
  });

  it("returns an empty array when no flight matches the airline", () => {
    expect(filterFlightsByAirline(flights, "Southwest")).toEqual([]);
  });

  it("never matches flights with a null airline against a real name", () => {
    const result = filterFlightsByAirline(flights, "United");
    expect(result.some((f) => f.airline === null)).toBe(false);
  });
});

describe("filterFlightsByStatus", () => {
  const flights = [
    makeFlight({ flight_number: "1", status: "active" }),
    makeFlight({ flight_number: "2", status: "delayed" }),
    makeFlight({ flight_number: "3", status: "active" }),
  ];

  it("returns all flights when status is ALL_STATUSES", () => {
    expect(filterFlightsByStatus(flights, ALL_STATUSES)).toEqual(flights);
  });

  it("returns only flights matching the selected status", () => {
    const result = filterFlightsByStatus(flights, "active");
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.status === "active")).toBe(true);
  });

  it("returns an empty array when no flight matches the status", () => {
    expect(filterFlightsByStatus(flights, "cancelled")).toEqual([]);
  });
});

describe("filterFlightsByDestination", () => {
  const flights = [
    makeFlight({
      flight_number: "1",
      destination: { iata: "LAX", name: "Los Angeles International" },
    }),
    makeFlight({
      flight_number: "2",
      destination: { iata: "ORD", name: "O'Hare International" },
    }),
    makeFlight({
      flight_number: "3",
      // Denver's city name ("Denver") doesn't happen to contain "la", unlike
      // e.g. Atlanta — picked deliberately so it doesn't collide with the
      // "LA" partial-match test below now that city matching is in play.
      destination: { iata: "DEN", name: null },
    }),
  ];

  it("returns all flights when the query is empty or whitespace", () => {
    expect(filterFlightsByDestination(flights, "")).toEqual(flights);
    expect(filterFlightsByDestination(flights, "   ")).toEqual(flights);
  });

  it("matches by exact IATA code, case-insensitively", () => {
    const result = filterFlightsByDestination(flights, "lax");
    expect(result).toHaveLength(1);
    expect(result[0].flight_number).toBe("1");
  });

  it("matches by partial IATA code", () => {
    const result = filterFlightsByDestination(flights, "LA");
    expect(result).toHaveLength(1);
    expect(result[0].flight_number).toBe("1");
  });

  it("matches by partial, case-insensitive airport/city name", () => {
    const result = filterFlightsByDestination(flights, "los ang");
    expect(result).toHaveLength(1);
    expect(result[0].flight_number).toBe("1");
  });

  it("does not error on flights with a null destination name", () => {
    expect(filterFlightsByDestination(flights, "den")).toEqual([flights[2]]);
    expect(filterFlightsByDestination(flights, "nonexistent city")).toEqual([]);
  });

  it("returns an empty array when no destination matches", () => {
    expect(filterFlightsByDestination(flights, "JFK")).toEqual([]);
  });

  it("matches by the destination's city, resolved from the curated airport list", () => {
    const toJfk = [
      makeFlight({
        flight_number: "4",
        destination: { iata: "JFK", name: "John F. Kennedy International" },
      }),
    ];

    // "John F. Kennedy International" doesn't contain "new york" — only the
    // curated airport list's city field ("New York") makes this match.
    const result = filterFlightsByDestination(toJfk, "new york");
    expect(result).toHaveLength(1);
    expect(result[0].flight_number).toBe("4");
  });

  it("matches a secondary metro-area airport not in SUPPORTED_AIRPORTS by city", () => {
    // LGA isn't in SUPPORTED_AIRPORTS (only one airport per metro area is,
    // for nearest-airport detection) — its city comes from the additional
    // alias map instead, and "LaGuardia Airport" alone wouldn't match "new
    // york" without it.
    const toLga = [
      makeFlight({
        flight_number: "5",
        destination: { iata: "LGA", name: "LaGuardia Airport" },
      }),
    ];

    const result = filterFlightsByDestination(toLga, "new york");
    expect(result).toHaveLength(1);
    expect(result[0].flight_number).toBe("5");
  });

  it("does not match by city for a destination with no known city at all", () => {
    const toUnknown = [
      makeFlight({
        flight_number: "6",
        destination: { iata: "XYZ", name: "Some Regional Airport" },
      }),
    ];

    expect(filterFlightsByDestination(toUnknown, "new york")).toEqual([]);
  });
});
