import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
