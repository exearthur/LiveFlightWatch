import { IconStar, IconStarFilled } from "@tabler/icons-react";

import { toSavedFlight, useSavedFlights } from "@/hooks/useSavedFlights";
import { cn } from "@/lib/utils";
import type { Flight } from "@/types/flight";

/** Star that adds a flight to, or removes it from, the saved flights on the Favorites page. */
export function SaveFlightButton({ flight }: { flight: Flight }) {
  const { isSaved, saveFlight, removeFlight } = useSavedFlights();
  const saved = isSaved(flight.flight_number);

  return (
    <button
      type="button"
      onClick={() => (saved ? removeFlight(flight.flight_number) : saveFlight(toSavedFlight(flight)))}
      aria-pressed={saved}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
        saved
          ? "border-board-amber/60 text-board-amber"
          : "border-board-line text-board-ink hover:border-board-muted/60",
      )}
    >
      {saved ? (
        <IconStarFilled className="size-4" aria-hidden="true" />
      ) : (
        <IconStar className="size-4" stroke={1.75} aria-hidden="true" />
      )}
      {saved ? "Saved" : "Save flight"}
    </button>
  );
}
