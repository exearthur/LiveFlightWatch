import { IconCurrentLocation } from "@tabler/icons-react";

import type { UseNearestAirportResult } from "@/hooks/useNearestAirport";

interface NearestAirportNoticeProps {
  nearestAirport: Pick<UseNearestAirportResult, "status" | "airport" | "distanceKm">;
  /** Airport code currently in the search form. */
  airportCode: string;
  /** Fallback hints are hidden once an airport's flights are on screen. */
  hasLoadedAirport: boolean;
}

/** Live-region line describing the outcome of nearest-airport detection. */
export function NearestAirportNotice({
  nearestAirport,
  airportCode,
  hasLoadedAirport,
}: NearestAirportNoticeProps) {
  if (nearestAirport.status === "idle") return null;

  let message: string | null = null;
  switch (nearestAirport.status) {
    case "locating":
      message = "Finding the airport nearest to you…";
      break;
    case "found":
      if (nearestAirport.airport && airportCode === nearestAirport.airport.iata) {
        message =
          `Showing flights for ${nearestAirport.airport.name} (${nearestAirport.airport.iata}), ` +
          `the nearest supported airport, about ${Math.round(nearestAirport.distanceKm ?? 0)} km away.`;
      }
      break;
    case "denied":
      if (!hasLoadedAirport) {
        message = "Location access was denied. Enter an airport code below to see live flights.";
      }
      break;
    case "unavailable":
      if (!hasLoadedAirport) {
        message = "Your location couldn't be found. Enter an airport code below to see live flights.";
      }
      break;
    case "unsupported":
      if (!hasLoadedAirport) {
        message = "This browser can't share your location. Enter an airport code below.";
      }
      break;
    case "out-of-range":
      if (!hasLoadedAirport) {
        message = "There's no supported airport near you. Enter an airport code below.";
      }
      break;
  }

  return (
    <div aria-live="polite" className="min-h-6">
      {message && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <IconCurrentLocation
            className={`mt-0.5 size-4 shrink-0 ${nearestAirport.status === "locating" ? "animate-pulse" : ""}`}
            stroke={1.75}
            aria-hidden="true"
          />
          {message}
        </p>
      )}
    </div>
  );
}
