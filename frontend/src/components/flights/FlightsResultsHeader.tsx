import { RefreshCw, Star } from "lucide-react";

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

interface FlightsResultsHeaderProps {
  /** Number of results currently shown (after any client-side filters). */
  count: number;
  /** Noun shown after the count, e.g. "flights" or "result". */
  countLabel: string;
  /** ISO timestamp of when the shown data was fetched. */
  fetchedAt: string;
  cached: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  /** Shows the save-as-favorite toggle when provided. */
  favorite?: {
    isFavorite: boolean;
    onToggle: () => void;
  };
}

/**
 * Status line for a loaded result set: how many results are shown, how old
 * the data is and whether it came from cache, plus the favorite/refresh
 * actions. Rendered inside `FlightSearchForm`, which pushes it to the right.
 */
export function FlightsResultsHeader({
  count,
  countLabel,
  fetchedAt,
  cached,
  isFetching,
  onRefresh,
  favorite,
}: FlightsResultsHeaderProps) {
  return (
    <div className="ml-auto flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
      <span>
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{count}</span>{" "}
        {countLabel} · updated {timeAgo(fetchedAt)}
        {cached && " (cached)"}
      </span>
      {favorite && (
        <button
          onClick={favorite.onToggle}
          aria-label={favorite.isFavorite ? "Remove from favorites" : "Save as favorite"}
          aria-pressed={favorite.isFavorite}
          className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Star
            className={`size-3.5 ${favorite.isFavorite ? "fill-sky-500 text-sky-500" : ""}`}
          />
        </button>
      )}
      <button
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Refresh"
        className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
