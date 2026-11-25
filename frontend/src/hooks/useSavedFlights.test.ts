import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { toSavedFlight, useSavedFlights } from "@/hooks/useSavedFlights";
import type { Flight } from "@/types/flight";

const flight: Flight = {
  flight_number: "aa100",
  airline: "American Airlines",
  origin: { iata: "JFK", name: "John F Kennedy" },
  destination: { iata: "LHR", name: "London Heathrow" },
  scheduled_time: null,
  estimated_time: null,
  actual_time: null,
  status: "scheduled",
  terminal: null,
  gate: null,
};

describe("useSavedFlights", () => {
  beforeEach(() => localStorage.clear());

  it("saves a flight by number and keeps it across mounts", () => {
    const { result } = renderHook(() => useSavedFlights());

    act(() => result.current.saveFlight(toSavedFlight(flight)));

    expect(result.current.isSaved("AA100")).toBe(true);
    expect(result.current.savedFlights).toEqual([
      { flightNumber: "AA100", airline: "American Airlines", origin: "JFK", destination: "LHR" },
    ]);
    expect(renderHook(() => useSavedFlights()).result.current.isSaved("aa100")).toBe(true);
  });

  it("doesn't save the same number twice, and puts the latest first", () => {
    const { result } = renderHook(() => useSavedFlights());

    act(() => result.current.saveFlight(toSavedFlight(flight)));
    act(() => result.current.saveFlight({ ...toSavedFlight(flight), flightNumber: "DL88" }));
    act(() => result.current.saveFlight(toSavedFlight(flight)));

    expect(result.current.savedFlights.map((f) => f.flightNumber)).toEqual(["AA100", "DL88"]);
  });

  it("removes a flight", () => {
    const { result } = renderHook(() => useSavedFlights());
    act(() => result.current.saveFlight(toSavedFlight(flight)));

    act(() => result.current.removeFlight("aa100"));

    expect(result.current.isSaved("AA100")).toBe(false);
    expect(localStorage.getItem("lfw:saved-flights")).toBe("[]");
  });

  it("ignores malformed stored data", () => {
    localStorage.setItem("lfw:saved-flights", JSON.stringify([{ flightNumber: 7 }, "x"]));
    expect(renderHook(() => useSavedFlights()).result.current.savedFlights).toEqual([]);
  });
});
