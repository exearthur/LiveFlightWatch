import { useQuery } from "@tanstack/react-query";

import { ApiError, getFlights } from "@/lib/api";
import type { FlightDirection } from "@/types/flight";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;
const POLL_INTERVAL_MS = 45_000;

function isRateLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

export function useFlights(airport: string, type: FlightDirection) {
  return useQuery({
    queryKey: ["flights", airport.toUpperCase(), type],
    queryFn: () => getFlights(airport.toUpperCase(), type),
    enabled: IATA_CODE_PATTERN.test(airport),
    // Don't hammer an already-exhausted quota with automatic retries/polling.
    retry: (failureCount, error) => !isRateLimitError(error) && failureCount < 3,
    refetchInterval: (query) => (isRateLimitError(query.state.error) ? false : POLL_INTERVAL_MS),
  });
}
