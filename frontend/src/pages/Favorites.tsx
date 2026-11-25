import { IconArrowRight, IconX } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { getFavoriteId, useFavorites, type Favorite } from "@/hooks/useFavorites";
import { useSavedFlights, type SavedFlight } from "@/hooks/useSavedFlights";
import { airlineCode, airlineLogoUrl } from "@/lib/airlines";
import { ALL_AIRLINES, ALL_STATUSES } from "@/lib/flightFilters";

function favoriteHref(favorite: Favorite): string {
  const params = new URLSearchParams({ airport: favorite.airport });
  if (favorite.direction !== "departures") params.set("type", favorite.direction);
  if (favorite.airline !== ALL_AIRLINES) params.set("airline", favorite.airline);
  if (favorite.status !== ALL_STATUSES) params.set("status", favorite.status);
  return `/flights?${params.toString()}`;
}

function favoriteLabel(favorite: Favorite): string {
  const parts = [
    favorite.airport,
    favorite.direction === "departures" ? "Departures" : "Arrivals",
  ];
  if (favorite.airline !== ALL_AIRLINES) parts.push(favorite.airline);
  if (favorite.status !== ALL_STATUSES) {
    parts.push(favorite.status.charAt(0).toUpperCase() + favorite.status.slice(1));
  }
  return parts.join(" · ");
}

function savedFlightHref(flight: SavedFlight): string {
  return `/?${new URLSearchParams({ mode: "flight", flight: flight.flightNumber }).toString()}`;
}

const rowClass =
  "group flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-foreground/25";

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // The button sits inside the row's link.
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
      aria-label={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
    >
      <IconX className="size-4" stroke={1.75} aria-hidden="true" />
    </button>
  );
}

/** The airline's logo in full colour on the light page, or nothing if it won't load. */
function SavedFlightLogo({ flightNumber }: { flightNumber: string }) {
  const code = airlineCode(flightNumber);
  if (!code) return null;
  return (
    <img
      src={airlineLogoUrl(code)}
      alt=""
      width={60}
      height={20}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
      className="h-5 w-[60px] shrink-0 object-contain object-left dark:[filter:brightness(0)_invert(1)] dark:opacity-85"
    />
  );
}

export default function Favorites() {
  const { favorites, removeFavorite } = useFavorites();
  const { savedFlights, removeFlight } = useSavedFlights();
  const isEmpty = favorites.length === 0 && savedFlights.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:pt-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Favorites</h1>
      <p className="mt-1 text-muted-foreground">
        Boards and flights you've saved, kept in this browser.
      </p>

      {isEmpty ? (
        <div className="mt-10 rounded-xl border border-dashed border-input px-6 py-14 text-center">
          <p className="font-semibold">No favorites yet</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-muted-foreground">
            Star an airport board to keep its search, or open a flight and save it to follow it here.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Find flights
            <IconArrowRight className="size-4" stroke={2} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {favorites.length > 0 && (
            <section aria-labelledby="saved-boards">
              <h2 id="saved-boards" className="mb-3 text-lg font-semibold">
                Airport boards
              </h2>
              <ul className="flex flex-col gap-2">
                {favorites.map((favorite) => (
                  <li key={getFavoriteId(favorite)}>
                    <Link to={favoriteHref(favorite)} className={rowClass}>
                      <span className="rounded-[4px] bg-board px-2 py-1 font-mono text-sm font-semibold tracking-wider text-board-amber">
                        {favorite.airport}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{favoriteLabel(favorite)}</span>
                      <RemoveButton
                        label={`Remove ${favoriteLabel(favorite)} from favorites`}
                        onRemove={() => removeFavorite(favorite)}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {savedFlights.length > 0 && (
            <section aria-labelledby="saved-flights">
              <h2 id="saved-flights" className="mb-3 text-lg font-semibold">
                Flights
              </h2>
              <ul className="flex flex-col gap-2">
                {savedFlights.map((flight) => (
                  <li key={flight.flightNumber}>
                    <Link to={savedFlightHref(flight)} className={rowClass}>
                      <SavedFlightLogo flightNumber={flight.flightNumber} />
                      <span className="w-20 shrink-0 font-mono text-sm font-semibold">
                        {flight.flightNumber}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {[flight.origin, flight.destination].filter(Boolean).join(" to ")}
                        {flight.airline && <span className="hidden sm:inline">, {flight.airline}</span>}
                      </span>
                      <RemoveButton
                        label={`Remove ${flight.flightNumber} from favorites`}
                        onRemove={() => removeFlight(flight.flightNumber)}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
