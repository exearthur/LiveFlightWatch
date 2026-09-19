import { useQuery } from "@tanstack/react-query";

import { ApiError, getFlightByNumber } from "@/lib/api";

const FLIGHT_NUMBER_PATTERN = /^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$/;
const POLL_INTERVAL_MS = 45_000;

function isRateLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

export function useFlightLookup(flightNumber: string) {
  return useQuery({
    queryKey: ["flight-lookup", flightNumber.toUpperCase()],
    queryFn: () => getFlightByNumber(flightNumber.toUpperCase()),
    enabled: FLIGHT_NUMBER_PATTERN.test(flightNumber),
    // Don't hammer an already-exhausted quota with automatic retries/polling.
    retry: (failureCount, error) => !isRateLimitError(error) && failureCount < 3,
    refetchInterval: (query) => (isRateLimitError(query.state.error) ? false : POLL_INTERVAL_MS),
  });
}
