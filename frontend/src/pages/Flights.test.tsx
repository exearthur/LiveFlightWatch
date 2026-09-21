import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFlights } from "@/lib/api";
import Flights from "@/pages/Flights";
import type { FlightsResponse } from "@/types/flight";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getFlights: vi.fn(),
  };
});

const mockedGetFlights = vi.mocked(getFlights);

function renderFlights() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Flights />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The airport input re-uppercases its own value on every change event. Typed
// key-by-key with userEvent, that rewrite races the input's cursor position
// and scrambles multi-character input (a known controlled-input footgun).
// Setting the full value in one change event exercises the same onChange
// handler without that flakiness.
function setAirportInput(value: string) {
  fireEvent.change(screen.getByLabelText("Airport code (IATA)"), {
    target: { value },
  });
}

const jfkDepartures: FlightsResponse = {
  airport: "JFK",
  type: "departures",
  fetched_at: new Date().toISOString(),
  cached: false,
  flights: [
    {
      flight_number: "AA100",
      airline: "American Airlines",
      origin: { iata: "JFK", name: "John F Kennedy" },
      destination: { iata: "LAX", name: "Los Angeles Intl" },
      scheduled_time: "2026-01-01T10:00:00Z",
      estimated_time: null,
      actual_time: null,
      status: "scheduled",
      terminal: "4",
      gate: "12",
    },
  ],
};

const jfkDeparturesMultiDestination: FlightsResponse = {
  ...jfkDepartures,
  flights: [
    ...jfkDepartures.flights,
    {
      flight_number: "UA200",
      airline: "United",
      origin: { iata: "JFK", name: "John F Kennedy" },
      destination: { iata: "ORD", name: "O'Hare International" },
      scheduled_time: "2026-01-01T11:00:00Z",
      estimated_time: null,
      actual_time: null,
      status: "scheduled",
      terminal: "2",
      gate: "5",
    },
  ],
};

describe("Flights page", () => {
  beforeEach(() => {
    mockedGetFlights.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a prompt before any airport code is entered", () => {
    renderFlights();

    expect(screen.getByText("Enter an airport code above to see live flights.")).toBeInTheDocument();
    expect(mockedGetFlights).not.toHaveBeenCalled();
  });

  it("shows a validation message while the typed code is not a valid IATA code", () => {
    renderFlights();

    setAirportInput("J1");

    expect(screen.getByText("Enter a valid 3-letter IATA airport code.")).toBeInTheDocument();
    expect(mockedGetFlights).not.toHaveBeenCalled();
  });

  it("uppercases typed input and fetches departures once a valid code is entered", async () => {
    mockedGetFlights.mockResolvedValue(jfkDepartures);
    renderFlights();

    const input = screen.getByLabelText("Airport code (IATA)") as HTMLInputElement;
    setAirportInput("jfk");

    expect(input.value).toBe("JFK");
    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "departures"));
    await waitFor(() => expect(screen.getAllByText("AA100").length).toBeGreaterThan(0));
  });

  it("switches to arrivals and re-queries when the Arrivals button is clicked", async () => {
    mockedGetFlights.mockResolvedValue(jfkDepartures);
    const user = userEvent.setup();
    renderFlights();

    setAirportInput("jfk");
    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "departures"));

    await user.click(screen.getByRole("button", { name: "Arrivals" }));

    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "arrivals"));
  });

  it(
    "shows an error state with a retry option when the request fails",
    async () => {
      mockedGetFlights.mockRejectedValue(new Error("Airport not found"));
      renderFlights();

      setAirportInput("zzz");

      // A non-rate-limited error retries up to 3 times with exponential
      // backoff (real behavior, baked into useFlights) before isError flips,
      // so this needs a longer-than-default wait.
      await waitFor(
        () => expect(screen.getByText("Couldn't load flights")).toBeInTheDocument(),
        { timeout: 10_000 },
      );
      expect(screen.getByText("Airport not found")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
    },
    10_000,
  );
});

describe("Flights page — destination search", () => {
  beforeEach(() => {
    mockedGetFlights.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("filters departures down to flights matching a destination IATA code", async () => {
    mockedGetFlights.mockResolvedValue(jfkDeparturesMultiDestination);
    renderFlights();

    setAirportInput("jfk");
    await waitFor(() => expect(screen.getAllByText("AA100").length).toBeGreaterThan(0));
    expect(screen.getAllByText("UA200").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "LAX" } });

    await waitFor(() => expect(screen.queryByText("UA200")).not.toBeInTheDocument());
    expect(screen.getAllByText("AA100").length).toBeGreaterThan(0);
  });

  it("filters departures down to flights matching a destination airport/city name", async () => {
    mockedGetFlights.mockResolvedValue(jfkDeparturesMultiDestination);
    renderFlights();

    setAirportInput("jfk");
    await waitFor(() => expect(screen.getAllByText("AA100").length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText("Destination"), {
      target: { value: "Los Angeles" },
    });

    await waitFor(() => expect(screen.queryByText("UA200")).not.toBeInTheDocument());
    expect(screen.getAllByText("AA100").length).toBeGreaterThan(0);
  });

  it("shows a no-match state when no flight goes to the searched destination", async () => {
    mockedGetFlights.mockResolvedValue(jfkDeparturesMultiDestination);
    renderFlights();

    setAirportInput("jfk");
    await waitFor(() => expect(screen.getAllByText("AA100").length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText("Destination"), {
      target: { value: "Nonexistent City" },
    });

    await waitFor(() =>
      expect(screen.getByText("No flights match the selected filters.")).toBeInTheDocument(),
    );
  });

  it("combines the destination filter with the airline filter", async () => {
    mockedGetFlights.mockResolvedValue(jfkDeparturesMultiDestination);
    const user = userEvent.setup();
    renderFlights();

    setAirportInput("jfk");
    await waitFor(() => expect(screen.getAllByText("AA100").length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "JFK" } });
    await waitFor(() =>
      expect(screen.getByText("No flights match the selected filters.")).toBeInTheDocument(),
    );

    // No flight departs to JFK itself, so combining with an airline filter
    // still yields no results — clear it and try a destination both flights
    // could plausibly share instead, filtered further by airline.
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "" } });
    await user.selectOptions(screen.getByLabelText("Airline"), "United");

    await waitFor(() => expect(screen.queryByText("AA100")).not.toBeInTheDocument());
    expect(screen.getAllByText("UA200").length).toBeGreaterThan(0);
  });

  it("hides the destination filter in Arrivals mode", async () => {
    mockedGetFlights.mockResolvedValue(jfkDeparturesMultiDestination);
    const user = userEvent.setup();
    renderFlights();

    setAirportInput("jfk");
    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "departures"));
    expect(screen.getByLabelText("Destination")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Arrivals" }));

    expect(screen.queryByLabelText("Destination")).not.toBeInTheDocument();
  });
});

describe("Flights page — nearest-airport detection", () => {
  beforeEach(() => {
    mockedGetFlights.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    // @ts-expect-error -- cleaning up the mocked geolocation between tests
    delete navigator.geolocation;
    vi.restoreAllMocks();
  });

  function mockGeolocationSuccess(lat: number, lon: number, options?: { delayMs?: number }) {
    const respond = (onSuccess: PositionCallback) => {
      const position: GeolocationPosition = {
        coords: {
          latitude: lat,
          longitude: lon,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON() {
            return this;
          },
        },
        timestamp: Date.now(),
        toJSON() {
          return this;
        },
      };
      if (options?.delayMs) {
        setTimeout(() => onSuccess(position), options.delayMs);
      } else {
        onSuccess(position);
      }
    };

    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: vi.fn(respond) },
      configurable: true,
    });
  }

  function mockGeolocationDenied() {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: vi.fn((_onSuccess: PositionCallback, onError?: PositionErrorCallback) =>
          onError?.({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "User denied geolocation",
          }),
        ),
      },
      configurable: true,
    });
  }

  it("auto-loads the nearest supported airport's flights on load when location is granted", async () => {
    mockGeolocationSuccess(40.7, -73.9); // near New York -> JFK
    mockedGetFlights.mockResolvedValue(jfkDepartures);

    renderFlights();

    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "departures"));
    expect(
      screen.getByText(/Showing flights for John F\. Kennedy International \(JFK\)/),
    ).toBeInTheDocument();
    expect((screen.getByLabelText("Airport code (IATA)") as HTMLInputElement).value).toBe("JFK");
  });

  it("falls back to manual search without blocking it when location access is denied", async () => {
    mockGeolocationDenied();

    renderFlights();

    await waitFor(() =>
      expect(
        screen.getByText(/Location access was denied — enter an airport code below/),
      ).toBeInTheDocument(),
    );
    expect(mockedGetFlights).not.toHaveBeenCalled();

    mockedGetFlights.mockResolvedValue(jfkDepartures);
    setAirportInput("jfk");

    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "departures"));
  });

  it("does not override a manually-entered airport once a delayed geolocation result resolves", async () => {
    // Resolves to JFK, but only after the user has already typed something else.
    mockGeolocationSuccess(40.7, -73.9, { delayMs: 20 });
    mockedGetFlights.mockResolvedValue({ ...jfkDepartures, airport: "LAX" });

    renderFlights();
    setAirportInput("lax");
    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("LAX", "departures"));

    // Let the delayed geolocation callback fire; it must not clobber "LAX".
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect((screen.getByLabelText("Airport code (IATA)") as HTMLInputElement).value).toBe("LAX");
  });

  it("re-applies the nearest airport when 'Use my location' is clicked after switching airports manually", async () => {
    mockGeolocationSuccess(33.6407, -84.4277); // Atlanta -> ATL
    mockedGetFlights.mockResolvedValue({ ...jfkDepartures, airport: "ATL" });

    renderFlights();
    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("ATL", "departures"));
    expect((screen.getByLabelText("Airport code (IATA)") as HTMLInputElement).value).toBe("ATL");

    // Manually switch away to JFK.
    mockedGetFlights.mockResolvedValue(jfkDepartures);
    setAirportInput("jfk");
    await waitFor(() => expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "departures"));

    // Clicking "Use my location" again should go back to ATL, not stay on JFK.
    mockedGetFlights.mockResolvedValue({ ...jfkDepartures, airport: "ATL" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Use my location" }));

    await waitFor(() =>
      expect((screen.getByLabelText("Airport code (IATA)") as HTMLInputElement).value).toBe(
        "ATL",
      ),
    );
    await waitFor(() => expect(mockedGetFlights).toHaveBeenLastCalledWith("ATL", "departures"));
  });
});
