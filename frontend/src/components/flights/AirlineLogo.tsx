import { useState } from "react";

import { airlineCode, airlineLogoUrl } from "@/lib/airlines";
import { cn } from "@/lib/utils";

interface AirlineLogoProps {
  flightNumber: string;
  /** Used for the alt text. */
  airline: string | null;
  className?: string;
}

/**
 * The airline's wordmark, drawn as a white silhouette so it sits on the dark
 * board like the rest of the signage. When there is no code to look up, or
 * the logo doesn't load, the airline code is shown in its place, so a row
 * never carries a broken image.
 */
export function AirlineLogo({ flightNumber, airline, className }: AirlineLogoProps) {
  const code = airlineCode(flightNumber);
  const [failed, setFailed] = useState(false);

  if (!code || failed) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-5 w-[60px] items-center font-mono text-xs font-semibold text-board-muted",
          className,
        )}
      >
        {code ?? ""}
      </span>
    );
  }

  return (
    <img
      src={airlineLogoUrl(code)}
      alt={airline ? `${airline} logo` : ""}
      width={60}
      height={20}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(
        "h-5 w-[60px] object-contain object-left opacity-85 [filter:brightness(0)_invert(1)]",
        className,
      )}
    />
  );
}
