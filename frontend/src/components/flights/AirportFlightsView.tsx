import { IconPlaneDeparture } from "@tabler/icons-react";
import type { ReactNode } from "react";

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
  /** Opens one of the shown flights in the cockpit, by its index in `flights`. */
  onSelectFlight: (index: number) => void;
}

function BoardMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-board-muted">
      <IconPlaneDeparture className="size-8" stroke={1.5} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

/** Body of the board for the "By airport" search: prompt, validation, loading, error and table. */
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
  onSelectFlight,
}: AirportFlightsViewProps) {
  return (
    <>
      {airportCode.length > 0 && !isValidAirport && (
        <p className="px-6 py-6 text-sm text-board-red">
          Enter a valid 3-letter IATA airport code.
        </p>
      )}

      {!airportCode && <BoardMessage>Enter an airport code above to see live flights.</BoardMessage>}

      {isValidAirport && isLoading && <FlightsTableSkeleton />}

      {isValidAirport && isError && (
        <FlightsErrorState error={error} title="Couldn't load flights" onRetry={onRetry} />
      )}

      {isValidAirport && flights && !isError && isFilteredEmpty && (
        <BoardMessage>No flights match the selected filters.</BoardMessage>
      )}

      {isValidAirport && flights && !isError && !isFilteredEmpty && (
        // Keyed by board so the row cascade plays once per airport and
        // direction, not on every poll or filter change.
        <FlightsTable
          key={`${airportCode}-${direction}`}
          flights={flights}
          direction={direction}
          selection={{ onSelect: onSelectFlight, hint: "Open in the cockpit" }}
        />
      )}
    </>
  );
}
