import { IconRefresh, IconStar, IconStarFilled } from "@tabler/icons-react";

import { useNow } from "@/hooks/useNow";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";

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

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-md border border-board-line text-board-ink transition-colors hover:border-board-muted/60 disabled:opacity-50";

/**
 * Status line for a loaded result set: how many results are shown, how old
 * the data is and whether it came from cache, plus the favorite/refresh
 * actions. Sits at the end of the board's control strip.
 *
 * The age is measured from `fetchedAt` against a clock that ticks every
 * second, so it keeps counting between refetches, and while polling is
 * paused, rather than showing the age as of the last render.
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
  const now = useNow();

  return (
    <div className="col-span-2 flex items-center justify-end gap-3 text-sm text-board-muted sm:ml-auto">
      <span aria-live="polite">
        <span className="font-mono font-semibold text-board-ink">{count}</span> {countLabel} ·
        updated {timeAgo(fetchedAt, now)}
        {cached && " (cached)"}
      </span>
      {favorite && (
        <button
          type="button"
          onClick={favorite.onToggle}
          aria-label={favorite.isFavorite ? "Remove from favorites" : "Save as favorite"}
          aria-pressed={favorite.isFavorite}
          className={cn(iconButton, favorite.isFavorite && "border-board-amber/60 text-board-amber")}
        >
          {favorite.isFavorite ? (
            <IconStarFilled className="size-4" aria-hidden="true" />
          ) : (
            <IconStar className="size-4" stroke={1.75} aria-hidden="true" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Refresh"
        className={iconButton}
      >
        <IconRefresh
          className={cn("size-4", isFetching && "animate-spin")}
          stroke={1.75}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
