import { useQuery } from "@tanstack/react-query";

import { getFlightByNumber } from "@/lib/api";

const FLIGHT_NUMBER_PATTERN = /^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$/;

export function useFlightLookup(flightNumber: string) {
  return useQuery({
    queryKey: ["flight-lookup", flightNumber.toUpperCase()],
    queryFn: () => getFlightByNumber(flightNumber.toUpperCase()),
    enabled: FLIGHT_NUMBER_PATTERN.test(flightNumber),
    refetchInterval: 45_000,
  });
}
