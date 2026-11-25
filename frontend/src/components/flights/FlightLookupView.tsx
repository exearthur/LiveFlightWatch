import { IconHash } from "@tabler/icons-react";

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

/** Body of the board for the "By flight number" search: prompt, validation, loading, error and table. */
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
        <p className="px-6 py-6 text-sm text-board-red">
          Enter a valid flight number, such as AA100.
        </p>
      )}

      {!flightNumber && (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-board-muted">
          <IconHash className="size-8" stroke={1.5} aria-hidden="true" />
          <p>Enter a flight number above to look up its status.</p>
        </div>
      )}

      {isValidFlightNumber && isLoading && <FlightsTableSkeleton />}

      {isValidFlightNumber && isError && (
        <FlightsErrorState error={error} title="Couldn't look up that flight" onRetry={onRetry} />
      )}

      {isValidFlightNumber && flights && !isError && (
        <FlightsTable
          key={flightNumber}
          flights={flights}
          direction="departures"
          emptyTitle="No flight found"
          emptyDescription="Check the flight number. The flight may not be operating today."
        />
      )}
    </>
  );
}
