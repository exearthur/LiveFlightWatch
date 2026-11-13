import { AlertTriangle, Clock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

interface FlightsErrorStateProps {
  error: unknown;
  /** Heading for errors other than the provider rate limit. */
  title: string;
  onRetry: () => void;
}

/**
 * Error card for a failed flights request. A 429 from the API gets its own
 * "quota reached" message; anything else shows `title` and the error text.
 */
export function FlightsErrorState({ error, title, onRetry }: FlightsErrorStateProps) {
  if (error instanceof ApiError && error.status === 429) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 py-12 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
        <Clock className="size-8 text-amber-500" />
        <div>
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Flight data quota reached
          </p>
          <p className="mx-auto max-w-md px-4 text-sm text-amber-600/80 dark:text-amber-400/70">
            We've hit our flight-data provider's rate limit. This usually resets soon —
            please try again in a little while.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/40 dark:bg-red-950/20">
      <AlertTriangle className="size-8 text-red-500" />
      <div>
        <p className="font-medium text-red-700 dark:text-red-400">{title}</p>
        <p className="mx-auto max-w-md px-4 text-sm text-red-600/80 dark:text-red-400/70">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> Try again
      </Button>
    </div>
  );
}
