import { PlaneTakeoff, Star, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getFavoriteId, useFavorites, type Favorite } from "@/hooks/useFavorites";
import { ALL_AIRLINES, ALL_STATUSES } from "@/lib/flightFilters";

function favoriteHref(favorite: Favorite): string {
  const params = new URLSearchParams({
    airport: favorite.airport,
    direction: favorite.direction,
  });
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

export default function Home() {
  const { favorites, removeFavorite } = useFavorites();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
        Live Flight Watch
      </h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        A universal flight table for any airport in the world — check departures and
        arrivals without waiting on the slow board at the gate.
      </p>
      <Button asChild>
        <Link to="/flights">View Live Flights</Link>
      </Button>

      <div className="mt-12 w-full text-left">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          <Star className="size-4 fill-sky-500 text-sky-500" />
          Your Favorites
        </h2>

        {favorites.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-12 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            <PlaneTakeoff className="size-8 text-neutral-400 dark:text-neutral-600" />
            <p>No favorites yet — search for an airport and star it to save it here.</p>
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
    </div>
  );
}
