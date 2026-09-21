import { getCityByIata } from "@/data/airports";
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

/**
 * Filters flights down to those traveling to a destination matching `query`
 * — a case-insensitive partial match against the destination's IATA code
 * (e.g. "LAX"), the airport name the upstream flight data provides (e.g.
 * "Los Angeles International"), or the destination's city (e.g. "New
 * York"), resolved by cross-referencing the IATA code against our curated
 * airport data since AviationStack's flight payload doesn't include a city
 * field itself. A destination outside that curated data (most of the
 * world's airports) can still be found by code or by its own airport name —
 * just not by city. An empty/whitespace-only query returns all flights
 * unchanged.
 */
export function filterFlightsByDestination(flights: Flight[], query: string): Flight[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return flights;
  return flights.filter((flight) => {
    const { iata, name } = flight.destination;
    const city = getCityByIata(iata);
    return (
      iata.toLowerCase().includes(normalized) ||
      !!name?.toLowerCase().includes(normalized) ||
      !!city?.toLowerCase().includes(normalized)
    );
  });
}
