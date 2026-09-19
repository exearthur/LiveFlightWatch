import { useQuery } from "@tanstack/react-query";

import { getFlights } from "@/lib/api";
import type { FlightDirection } from "@/types/flight";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;

export function useFlights(airport: string, type: FlightDirection) {
  return useQuery({
    queryKey: ["flights", airport.toUpperCase(), type],
    queryFn: () => getFlights(airport.toUpperCase(), type),
    enabled: IATA_CODE_PATTERN.test(airport),
    refetchInterval: 45_000,
  });
}
