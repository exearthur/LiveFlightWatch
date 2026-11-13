import { LocateFixed } from "lucide-react";

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

  return (
    <div className="mb-4" aria-live="polite">
      {nearestAirport.status === "locating" && (
        <p className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <LocateFixed className="size-4 animate-pulse" />
          Finding the nearest airport to your location…
        </p>
      )}
      {nearestAirport.status === "found" &&
        nearestAirport.airport &&
        airportCode === nearestAirport.airport.iata && (
          <p className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-400">
            <LocateFixed className="size-4" />
            Showing flights for {nearestAirport.airport.name} ({nearestAirport.airport.iata})
            — the nearest supported airport to your location, about{" "}
            {Math.round(nearestAirport.distanceKm ?? 0)} km away.
          </p>
        )}
      {nearestAirport.status === "denied" && !hasLoadedAirport && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Location access was denied — enter an airport code below to see live flights.
        </p>
      )}
      {nearestAirport.status === "unavailable" && !hasLoadedAirport && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Couldn't determine your location — enter an airport code below to see live
          flights.
        </p>
      )}
      {nearestAirport.status === "unsupported" && !hasLoadedAirport && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Location detection isn't available in this browser — enter an airport code
          below.
        </p>
      )}
      {nearestAirport.status === "out-of-range" && !hasLoadedAirport && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          We couldn't find a supported airport near your location — enter one below.
        </p>
      )}
    </div>
  );
}
