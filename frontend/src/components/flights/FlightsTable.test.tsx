import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlightsTable } from "@/components/flights/FlightsTable";
import type { Flight, FlightStatus } from "@/types/flight";

function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    flight_number: "AA100",
    airline: "American Airlines",
    origin: { iata: "JFK", name: "John F Kennedy" },
    destination: { iata: "LAX", name: "Los Angeles Intl" },
    scheduled_time: "2026-01-01T10:00:00Z",
    estimated_time: "2026-01-01T10:05:00Z",
    actual_time: null,
    status: "scheduled",
    terminal: "4",
    gate: "12",
    ...overrides,
  };
}

describe("FlightsTable", () => {
  it("renders an empty state with a direction-specific message when there are no flights", () => {
    render(<FlightsTable flights={[]} direction="departures" />);

    expect(screen.getByText("No departures found")).toBeInTheDocument();
  });

  it("renders an empty state for arrivals too", () => {
    render(<FlightsTable flights={[]} direction="arrivals" />);

    expect(screen.getByText("No arrivals found")).toBeInTheDocument();
  });

  it("renders each flight's number in both the desktop table and the mobile card layout", () => {
    render(<FlightsTable flights={[makeFlight()]} direction="departures" />);

    // The component dual-renders every flight once for desktop (table) and
    // once for mobile (cards), toggled purely via responsive CSS classes,
    // so both instances are present in the DOM at once.
    expect(screen.getAllByText("AA100")).toHaveLength(2);
  });

  it("shows the destination column/label for departures and origin for arrivals", () => {
    const flight = makeFlight();
    const { rerender } = render(<FlightsTable flights={[flight]} direction="departures" />);

    expect(screen.getAllByText("Destination").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Los Angeles Intl").length).toBeGreaterThan(0);

    rerender(<FlightsTable flights={[flight]} direction="arrivals" />);

    expect(screen.getAllByText("Origin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("John F Kennedy").length).toBeGreaterThan(0);
  });

  it("falls back to the airport IATA code when the airport name is null", () => {
    const flight = makeFlight({ destination: { iata: "LAX", name: null } });
    render(<FlightsTable flights={[flight]} direction="departures" />);

    expect(screen.getAllByText("LAX").length).toBeGreaterThan(0);
  });

  it("shows an em dash for missing scheduled/estimated times", () => {
    const flight = makeFlight({ scheduled_time: null, estimated_time: null });
    render(<FlightsTable flights={[flight]} direction="departures" />);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("joins terminal and gate, falling back to an em dash when both are missing", () => {
    const withBoth = makeFlight({ terminal: "4", gate: "12" });
    const { rerender } = render(<FlightsTable flights={[withBoth]} direction="departures" />);
    expect(screen.getAllByText("4 / 12").length).toBeGreaterThan(0);

    const withNeither = makeFlight({ terminal: null, gate: null });
    rerender(<FlightsTable flights={[withNeither]} direction="departures" />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it.each<[FlightStatus, string]>([
    ["scheduled", "bg-neutral-100"],
    ["active", "bg-emerald-100"],
    ["landed", "bg-emerald-100"],
    ["delayed", "bg-amber-100"],
    ["cancelled", "bg-red-100"],
    ["diverted", "bg-red-100"],
    ["unknown", "bg-neutral-100"],
  ])("gives the %s status badge the %s background color class", (status, expectedClass) => {
    render(<FlightsTable flights={[makeFlight({ status })]} direction="departures" />);

    const badges = screen.getAllByText(status, { exact: false });
    const badge = badges.find((el) => el.className.includes(expectedClass));
    expect(badge).toBeDefined();
  });
});
