import { PlaneTakeoff } from "lucide-react";

import { FlightsErrorState } from "@/components/flights/FlightsErrorState";
import { FlightsTable } from "@/components/flights/FlightsTable";
import { FlightsTableSkeleton } from "@/components/flights/FlightsTableSkeleton";
import type { Flight, FlightDirection } from "@/types/flight";

interface AirportFlightsViewProps {
  airportCode: string;
  isValidAirport: boolean;
  direction: FlightDirection;
  /** Flights left after the active filters; undefined until a response has loaded. */
  flights: Flight[] | undefined;
  /** True when a filter is active and it excluded every loaded flight. */
  isFilteredEmpty: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/** Results area for the "By Airport" search: prompt, validation, loading, error and table. */
export function AirportFlightsView({
  airportCode,
  isValidAirport,
  direction,
  flights,
  isFilteredEmpty,
  isLoading,
  isError,
  error,
  onRetry,
}: AirportFlightsViewProps) {
  return (
    <>
      {airportCode.length > 0 && !isValidAirport && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Enter a valid 3-letter IATA airport code.
        </p>
      )}

      {!airportCode && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          <PlaneTakeoff className="size-8 text-neutral-400 dark:text-neutral-600" />
          <p>Enter an airport code above to see live flights.</p>
        </div>
      )}

      {isValidAirport && isLoading && <FlightsTableSkeleton />}

      {isValidAirport && isError && (
        <FlightsErrorState error={error} title="Couldn't load flights" onRetry={onRetry} />
      )}

      {isValidAirport && flights && !isError && isFilteredEmpty && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          <PlaneTakeoff className="size-8 text-neutral-400 dark:text-neutral-600" />
          <p>No flights match the selected filters.</p>
        </div>
      )}

      {isValidAirport && flights && !isError && !isFilteredEmpty && (
        <FlightsTable flights={flights} direction={direction} />
      )}
    </>
  );
}
