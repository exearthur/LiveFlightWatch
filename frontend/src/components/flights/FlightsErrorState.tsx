import { IconAlertTriangle, IconClockPause, IconRefresh } from "@tabler/icons-react";

import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FlightsErrorStateProps {
  error: unknown;
  /** Heading for errors other than the provider rate limit. */
  title: string;
  onRetry: () => void;
}

/**
 * Message on the board for a failed flights request. A 429 from the API gets
 * its own "quota reached" message, since retrying straight away won't help;
 * anything else shows `title` and the error text.
 */
export function FlightsErrorState({ error, title, onRetry }: FlightsErrorStateProps) {
  const isQuota = error instanceof ApiError && error.status === 429;
  const Icon = isQuota ? IconClockPause : IconAlertTriangle;

  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <Icon
        className={cn("size-8", isQuota ? "text-board-amber" : "text-board-red")}
        stroke={1.5}
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold text-board-ink">
          {isQuota ? "Flight data quota reached" : title}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-board-muted">
          {isQuota
            ? "The flight-data provider's request limit has been used up. It resets on its own, so try again later."
            : error instanceof Error
              ? error.message
              : "Unknown error"}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-board-line px-3 text-sm text-board-ink transition-colors hover:border-board-muted/60"
      >
        <IconRefresh className="size-4" stroke={1.75} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
