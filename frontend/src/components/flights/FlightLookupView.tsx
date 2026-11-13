import { Hash } from "lucide-react";

import { FlightsErrorState } from "@/components/flights/FlightsErrorState";
import { FlightsTable } from "@/components/flights/FlightsTable";
import { FlightsTableSkeleton } from "@/components/flights/FlightsTableSkeleton";
import type { Flight } from "@/types/flight";

interface FlightLookupViewProps {
  flightNumber: string;
  isValidFlightNumber: boolean;
  /** Matching flights; undefined until a lookup has loaded. */
  flights: Flight[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/** Results area for the "By Flight Number" search: prompt, validation, loading, error and table. */
export function FlightLookupView({
  flightNumber,
  isValidFlightNumber,
  flights,
  isLoading,
  isError,
  error,
  onRetry,
}: FlightLookupViewProps) {
  return (
    <>
      {flightNumber.length > 0 && !isValidFlightNumber && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Enter a valid flight number (e.g. AA100).
        </p>
      )}

      {!flightNumber && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          <Hash className="size-8 text-neutral-400 dark:text-neutral-600" />
          <p>Enter a flight number above to look up its status.</p>
        </div>
      )}

      {isValidFlightNumber && isLoading && <FlightsTableSkeleton />}

      {isValidFlightNumber && isError && (
        <FlightsErrorState
          error={error}
          title="Couldn't look up that flight"
          onRetry={onRetry}
        />
      )}

      {isValidFlightNumber && flights && !isError && (
        <FlightsTable
          flights={flights}
          direction="departures"
          emptyTitle="No flight found"
          emptyDescription="Check the flight number and try again — it may not be operating today."
        />
      )}
    </>
  );
}
