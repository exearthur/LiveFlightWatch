import { IconHash } from "@tabler/icons-react";
import { useState } from "react";

import { FlightCockpit } from "@/components/flights/FlightCockpit";
import { FlightsErrorState } from "@/components/flights/FlightsErrorState";
import { FlightsTable } from "@/components/flights/FlightsTable";
import { RadarScan } from "@/components/flights/RadarScan";
import { SaveFlightButton } from "@/components/flights/SaveFlightButton";
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

/**
 * The cockpit for one match, then the log of every match below it. A flight
 * number often matches more than one flight (the same service on different
 * days), so the log doubles as the picker for which one the cockpit shows.
 */
function LookupResults({ flights }: { flights: Flight[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // A refetch can return fewer matches than before.
  const index = Math.min(selectedIndex, flights.length - 1);

  return (
    <>
      <FlightCockpit flight={flights[index]} action={<SaveFlightButton flight={flights[index]} />} />
      <div className="border-t border-board-line">
        <div className="px-4 pt-5 pb-1 sm:px-6">
          <h3 className="text-sm font-semibold text-board-ink">Flight log</h3>
          {flights.length > 1 && (
            <p className="text-sm text-board-muted">
              {flights.length} flights match this number. Pick one to show it above.
            </p>
          )}
        </div>
        <FlightsTable
          flights={flights}
          direction="departures"
          selection={flights.length > 1 ? { selectedIndex: index, onSelect: setSelectedIndex } : undefined}
        />
      </div>
    </>
  );
}

/** Body of the lookup panel: prompt, validation, radar while searching, error, and results. */
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

      {isValidFlightNumber && isLoading && <RadarScan label={`Searching for ${flightNumber}`} />}

      {isValidFlightNumber && isError && (
        <FlightsErrorState error={error} title="Couldn't look up that flight" onRetry={onRetry} />
      )}

      {isValidFlightNumber && flights && !isError && flights.length === 0 && (
        <FlightsTable
          flights={[]}
          direction="departures"
          emptyTitle="No flight found"
          emptyDescription="Check the flight number. The flight may not be operating today."
        />
      )}

      {isValidFlightNumber && flights && !isError && flights.length > 0 && (
        // Keyed so picking a match resets when a different number is looked up.
        <LookupResults key={flightNumber} flights={flights} />
      )}
    </>
  );
}
