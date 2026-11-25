import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * The building blocks of the cockpit: a framed instrument, and the recessed
 * "LCD" readouts inside some of them.
 */

/** A framed instrument with its name in the corner. */
export function Instrument({
  label,
  aside,
  className,
  children,
}: {
  label: string;
  /** Shown at the right of the instrument's name, e.g. a badge. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn("rounded-lg border border-board-line bg-board-raised/50 p-4 sm:p-5", className)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs text-board-muted">{label}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)]">
      <dt className="text-xs text-board-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-[15px] text-board-ink">{children}</dd>
    </div>
  );
}
