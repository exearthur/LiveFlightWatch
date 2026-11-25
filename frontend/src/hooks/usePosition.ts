import { useQuery } from "@tanstack/react-query";

import { ApiError, getAirports, getPosition } from "@/lib/api";

const CALLSIGN_PATTERN = /^[A-Za-z]{3}[0-9]{1,4}[A-Za-z]{0,2}$/;

// The backend caches positions for a minute, and the source allows a few
// hundred requests a day for the whole site, so polling faster gains nothing.
const POLL_MS = 60_000;

/**
 * The live position for a callsign, polled every minute while `enabled`.
 * Callers enable it only for a flight that is in the air, which is what
 * keeps the site inside the source's daily allowance.
 */
export function usePosition(callsign: string | null | undefined, enabled: boolean) {
  const code = (callsign ?? "").toUpperCase();
  return useQuery({
    queryKey: ["position", code],
    queryFn: () => getPosition(code),
    enabled: enabled && CALLSIGN_PATTERN.test(code),
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 429 ? false : POLL_MS,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 429) && failureCount < 2,
  });
}

/** Names and positions of airports. They never change, so they are fetched once. */
export function useAirports(codes: string[]) {
  const wanted = [...new Set(codes.filter((code) => /^[A-Za-z]{3}$/.test(code)).map((c) => c.toUpperCase()))];
  return useQuery({
    queryKey: ["airports", ...wanted],
    queryFn: () => getAirports(wanted),
    enabled: wanted.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
