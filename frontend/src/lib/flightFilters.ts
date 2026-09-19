import type { Flight, FlightStatus } from "@/types/flight";

export const ALL_AIRLINES = "all" as const;
export const ALL_STATUSES = "all" as const;

/**
 * Unique airline names present in the given flights, sorted alphabetically.
 * Flights with a missing/null airline are excluded from the option list.
 */
export function getUniqueAirlines(flights: Flight[]): string[] {
  const airlines = new Set<string>();
  for (const flight of flights) {
    if (flight.airline) airlines.add(flight.airline);
  }
  return Array.from(airlines).sort((a, b) => a.localeCompare(b));
}

/**
 * Filters flights down to the selected airline. Passing `ALL_AIRLINES`
 * (or any falsy value) returns all flights unchanged.
 */
export function filterFlightsByAirline(
  flights: Flight[],
  airline: string | typeof ALL_AIRLINES,
): Flight[] {
  if (!airline || airline === ALL_AIRLINES) return flights;
  return flights.filter((flight) => flight.airline === airline);
}

/**
 * Filters flights down to the selected status. Passing `ALL_STATUSES`
 * (or any falsy value) returns all flights unchanged.
 */
export function filterFlightsByStatus(
  flights: Flight[],
  status: FlightStatus | typeof ALL_STATUSES,
): Flight[] {
  if (!status || status === ALL_STATUSES) return flights;
  return flights.filter((flight) => flight.status === status);
}
