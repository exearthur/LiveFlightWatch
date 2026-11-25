import { useQuery } from "@tanstack/react-query";

import { ApiError, getWeather } from "@/lib/api";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;

// Airports report about once an hour and the backend caches for ten
// minutes, so asking more often than that gains nothing.
const REFRESH_MS = 10 * 60_000;

/**
 * The current weather report for an airport. Weather comes from a free
 * source with no quota, separate from the flight data, so it never affects
 * the "quota reached" state of the board.
 */
export function useWeather(airport: string | null | undefined, enabled = true) {
  const code = (airport ?? "").toUpperCase();
  return useQuery({
    queryKey: ["weather", code],
    queryFn: () => getWeather(code),
    enabled: enabled && IATA_CODE_PATTERN.test(code),
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    // No report (404) or a rate limit (429) won't change on an immediate retry.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 404 || error.status === 429)) &&
      failureCount < 2,
  });
}
