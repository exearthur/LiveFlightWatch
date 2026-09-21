import { PlaneTakeoff, Star, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getFavoriteId, useFavorites, type Favorite } from "@/hooks/useFavorites";
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

export default function Favorites() {
  const { favorites, removeFavorite } = useFavorites();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400">
          <Star className="size-5 fill-current" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Favorites
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Airport searches you've saved for quick access.
          </p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          <PlaneTakeoff className="size-8 text-neutral-400 dark:text-neutral-600" />
          <p>No favorites yet — search for an airport and star it to save it here.</p>
          <Button asChild>
            <Link to="/">View Live Flights</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {favorites.map((favorite) => (
            <li key={getFavoriteId(favorite)}>
              <Link
                to={favoriteHref(favorite)}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-800/60"
              >
                <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                  {favoriteLabel(favorite)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFavorite(favorite);
                  }}
                  aria-label={`Remove ${favoriteLabel(favorite)} from favorites`}
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                >
                  <X className="size-4" />
                </button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
