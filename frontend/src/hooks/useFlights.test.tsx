import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFlights } from "@/lib/api";
import { useFlights } from "@/hooks/useFlights";
import type { FlightsResponse } from "@/types/flight";

vi.mock("@/lib/api", () => ({
  getFlights: vi.fn(),
}));

const mockedGetFlights = vi.mocked(getFlights);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const sampleResponse: FlightsResponse = {
  airport: "JFK",
  type: "departures",
  fetched_at: "2026-01-01T00:00:00Z",
  cached: false,
  flights: [],
};

describe("useFlights", () => {
  beforeEach(() => {
    mockedGetFlights.mockReset();
  });

  it("does not fetch when the airport code is not a valid 3-letter IATA code", async () => {
    const { result } = renderHook(() => useFlights("JF", "departures"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockedGetFlights).not.toHaveBeenCalled();
  });

  it("does not fetch when the airport code is empty", () => {
    const { result } = renderHook(() => useFlights("", "arrivals"), {
      wrapper: createWrapper(),
    });

    expect(mockedGetFlights).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("fetches with the uppercased airport code once it is a valid IATA code", async () => {
    mockedGetFlights.mockResolvedValue(sampleResponse);

    const { result } = renderHook(() => useFlights("jfk", "departures"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetFlights).toHaveBeenCalledWith("JFK", "departures");
    expect(result.current.data).toEqual(sampleResponse);
  });

  it("passes the requested direction through to getFlights", async () => {
    mockedGetFlights.mockResolvedValue({ ...sampleResponse, type: "arrivals" });

    const { result } = renderHook(() => useFlights("LAX", "arrivals"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetFlights).toHaveBeenCalledWith("LAX", "arrivals");
  });

  it("surfaces an error when getFlights rejects", async () => {
    mockedGetFlights.mockRejectedValue(new Error("Airport not found"));

    const { result } = renderHook(() => useFlights("ZZZ", "departures"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Airport not found");
  });
});
