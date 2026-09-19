import { describe, expect, it } from "vitest";

import {
  ALL_AIRLINES,
  ALL_STATUSES,
  filterFlightsByAirline,
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
