import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlightsTable } from "@/components/flights/FlightsTable";
import type { Flight, FlightStatus } from "@/types/flight";

// The table formats times in the viewer's locale. Pin that to en-US here so
// the expected strings do not depend on the machine running the tests;
// everything else about the formatting is the real implementation.
vi.mock("@/lib/flightTime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flightTime")>();
  const formatFlightTime: typeof actual.formatFlightTime = (value, timeZone, options) =>
    actual.formatFlightTime(value, timeZone, { ...options, locale: "en-US" });
  return { ...actual, formatFlightTime };
});

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

describe("FlightsTable — times", () => {
  // 00:42 on 13 November 2026 in Atlanta, when the fixture response was captured.
  const NOW = new Date("2026-11-13T05:42:12Z");

  /** Makes `zone` the viewer's time zone and checks the runtime really switched. */
  function pinViewerZone(zone: string) {
    vi.stubEnv("TZ", zone);
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  }

  function atlantaDeparture(overrides: Partial<Flight> = {}): Flight {
    return makeFlight({
      flight_number: "DL27",
      origin: { iata: "ATL", name: "Hartsfield-Jackson Atlanta International" },
      destination: { iata: "ICN", name: "Seoul (Incheon)" },
      // 23:50 and 23:54 EST on 12 November
      scheduled_time: "2026-11-13T04:50:00Z",
      estimated_time: "2026-11-13T04:54:00Z",
      timezone: "America/New_York",
      ...overrides,
    });
  }

  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each(["Asia/Tokyo", "America/Los_Angeles", "Europe/London"])(
    "shows airport-local times with a zone label to a viewer in %s, in both layouts",
    (viewerZone) => {
      pinViewerZone(viewerZone);

      render(<FlightsTable flights={[atlantaDeparture()]} direction="departures" />);

      // once in the desktop table and once in the mobile card
      expect(screen.getAllByText("11:50 PM EST")).toHaveLength(2);
      expect(screen.getAllByText("11:54 PM EST")).toHaveLength(2);
      // and nowhere the viewer's own reading of the same instant
      expect(screen.queryByText(/01:50|08:50|04:50/)).not.toBeInTheDocument();
    },
  );

  it.each([
    // the evening before clocks go back in New York on 1 November 2026, and the evening after
    ["2026-11-01T02:45:00Z", "10:45 PM EDT"],
    ["2026-11-02T03:45:00Z", "10:45 PM EST"],
    // the evening before clocks go forward on 8 March 2026, and the evening after
    ["2026-03-08T03:45:00Z", "10:45 PM EST"],
    ["2026-03-09T02:45:00Z", "10:45 PM EDT"],
  ])("follows daylight saving at the airport: %s shows as %s", (instant, expected) => {
    pinViewerZone("Asia/Tokyo");

    render(
      <FlightsTable
        flights={[atlantaDeparture({ scheduled_time: instant, estimated_time: null })]}
        direction="departures"
      />,
    );

    expect(screen.getAllByText(expected)).toHaveLength(2);
  });

  it("adds the date to a time that is not on today's date at the airport", () => {
    pinViewerZone("Asia/Tokyo");
    const lastNight = atlantaDeparture();
    const thisMorning = atlantaDeparture({
      flight_number: "DL2204",
      // 07:05 EST on 13 November
      scheduled_time: "2026-11-13T12:05:00Z",
      estimated_time: null,
    });

    render(<FlightsTable flights={[lastNight, thisMorning]} direction="departures" />);

    const [lastNightRow, thisMorningRow] = screen.getAllByRole("row").slice(1);
    expect(within(lastNightRow).getByText("11:50 PM EST")).toBeInTheDocument();
    // scheduled and estimated both fall on the 12th
    expect(within(lastNightRow).getAllByText("Nov 12")).toHaveLength(2);
    expect(within(thisMorningRow).getByText("07:05 AM EST")).toBeInTheDocument();
    expect(within(thisMorningRow).queryByText(/Nov/)).not.toBeInTheDocument();
    // the mobile cards carry the same two date markers, and no others
    expect(screen.getAllByText("Nov 12")).toHaveLength(4);
    expect(screen.queryByText("Nov 13")).not.toBeInTheDocument();
  });

  it("shows each flight in its own zone when they differ", () => {
    pinViewerZone("Asia/Tokyo");
    const fromLondon = atlantaDeparture({
      flight_number: "BA226",
      origin: { iata: "LHR", name: "London Heathrow" },
      // 16:20 GMT on 13 November
      scheduled_time: "2026-11-13T16:20:00Z",
      estimated_time: null,
      timezone: "Europe/London",
    });

    render(<FlightsTable flights={[atlantaDeparture(), fromLondon]} direction="departures" />);

    expect(screen.getAllByText("11:50 PM EST")).toHaveLength(2);
    expect(screen.getAllByText("04:20 PM GMT")).toHaveLength(2);
  });

  it("shows a fixed-offset zone with an offset label", () => {
    pinViewerZone("Asia/Tokyo");

    render(
      <FlightsTable flights={[atlantaDeparture({ timezone: "-05:00" })]} direction="departures" />,
    );

    expect(screen.getAllByText("11:50 PM GMT-5")).toHaveLength(2);
  });

  it.each([[undefined], [null], ["Mars/Olympus_Mons"]])(
    "falls back to the viewer's zone, still labelled, when the flight's zone is %j",
    (timezone) => {
      pinViewerZone("Asia/Tokyo");

      render(<FlightsTable flights={[atlantaDeparture({ timezone })]} direction="departures" />);

      expect(screen.getAllByText("01:50 PM GMT+9")).toHaveLength(2);
    },
  );

  it("marks each time up as a machine-readable instant", () => {
    pinViewerZone("Asia/Tokyo");

    render(<FlightsTable flights={[atlantaDeparture()]} direction="departures" />);

    for (const element of screen.getAllByText("11:50 PM EST")) {
      expect(element).toHaveAttribute("datetime", "2026-11-13T04:50:00Z");
    }
  });
});
