import { IconPlaneTilt } from "@tabler/icons-react";
import type { CSSProperties } from "react";

import { AirlineLogo } from "@/components/flights/AirlineLogo";
import { useNow } from "@/hooks/useNow";
import { STATUS_TONE, type StatusTone } from "@/lib/flightStatus";
import { formatFlightTime } from "@/lib/flightTime";
import { cn } from "@/lib/utils";
import type { Flight, FlightStatus } from "@/types/flight";

const TONE_TEXT: Record<StatusTone, string> = {
  ok: "text-board-green",
  warn: "text-board-amber",
  alert: "text-board-red",
  neutral: "text-board-muted",
};

// How often the table re-checks which date is "today", so the date shown
// beside a time on another day stays right across midnight.
const DAY_CHECK_INTERVAL_MS = 60_000;

// Rows past this point appear without the cascade, so a 300-row board doesn't
// keep animating for seconds after it loads.
const CASCADE_ROWS = 14;

function cascade(index: number): { className?: string; style?: CSSProperties } {
  if (index >= CASCADE_ROWS) return {};
  return { className: "board-row-in", style: { "--row": index } as CSSProperties };
}

/**
 * One time in the airport's own zone with its zone label ("10:45 PM EST"),
 * plus the date underneath when that is not today's date at the airport: a
 * board mixes this evening's flights with tomorrow morning's.
 */
function FlightTime({
  value,
  timeZone,
  now,
}: {
  value: string | null;
  timeZone: string | null | undefined;
  now: number;
}) {
  const label = formatFlightTime(value, timeZone, { now });
  if (!label || !value) return <span className="text-board-muted">—</span>;
  return (
    <>
      <time dateTime={value}>{label.time}</time>
      {label.date && <span className="block text-xs text-board-muted">{label.date}</span>}
    </>
  );
}

function StatusLabel({ status }: { status: FlightStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      data-tone={tone}
      className={cn("font-mono text-xs font-semibold tracking-wide uppercase", TONE_TEXT[tone])}
    >
      {status}
    </span>
  );
}

function gateLabel(flight: Flight): string {
  return [flight.terminal, flight.gate].filter(Boolean).join(" / ") || "—";
}

interface FlightsTableProps {
  flights: Flight[];
  direction: "departures" | "arrivals";
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * Makes each row pick its flight: clicking the row, or its flight number
   * (a button, for keyboard users). The board uses it to open a flight in the
   * cockpit; the lookup to choose which match the cockpit shows, with
   * `selectedIndex` highlighting the current one.
   */
  selection?: {
    selectedIndex?: number;
    onSelect: (index: number) => void;
    /** Tooltip for the flight-number button, e.g. "Open in the cockpit". */
    hint?: string;
  };
}

function FlightNumber({
  flight,
  index,
  selection,
}: {
  flight: Flight;
  index: number;
  selection: FlightsTableProps["selection"];
}) {
  if (!selection) return <>{flight.flight_number}</>;
  return (
    <button
      type="button"
      onClick={(event) => {
        // The row handles clicks too; don't pick the flight twice.
        event.stopPropagation();
        selection.onSelect(index);
      }}
      aria-pressed={selection.selectedIndex === undefined ? undefined : selection.selectedIndex === index}
      title={selection.hint}
      className="rounded-sm underline-offset-4 hover:underline"
    >
      {flight.flight_number}
    </button>
  );
}

/**
 * The board itself. Rendered inside the dark board panel, so it uses the
 * board-* colours in both themes. Desktop gets a real table; narrow screens
 * get one compact block per flight. Both are in the DOM and swapped by CSS.
 */
export function FlightsTable({
  flights,
  direction,
  emptyTitle,
  emptyDescription,
  selection,
}: FlightsTableProps) {
  const now = useNow(DAY_CHECK_INTERVAL_MS);
  const placeLabel = direction === "departures" ? "Destination" : "Origin";

  if (flights.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <IconPlaneTilt className="size-8 text-board-muted" stroke={1.5} aria-hidden="true" />
        <div>
          <p className="font-semibold text-board-ink">{emptyTitle ?? `No ${direction} found`}</p>
          <p className="mt-1 text-sm text-board-muted">
            {emptyDescription ?? "Try a different airport code or switch direction."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="w-full text-left text-[15px]">
          <thead className="sticky top-0 z-10 bg-board text-xs text-board-muted">
            <tr className="border-b border-board-line whitespace-nowrap">
              <th className="py-3 pr-4 pl-6 font-normal">Scheduled</th>
              <th className="px-4 py-3 font-normal">Flight</th>
              <th className="px-4 py-3 font-normal">{placeLabel}</th>
              <th className="px-4 py-3 font-normal">Airline</th>
              <th className="px-4 py-3 font-normal">Expected</th>
              <th className="px-4 py-3 font-normal">Terminal / Gate</th>
              <th className="py-3 pr-6 pl-4 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-board-line/70">
            {flights.map((flight, idx) => {
              const other = direction === "departures" ? flight.destination : flight.origin;
              const { className, style } = cascade(idx);
              return (
                <tr
                  key={`${flight.flight_number}-${idx}`}
                  className={cn(
                    "transition-colors hover:bg-white/[0.03]",
                    selection && "cursor-pointer",
                    selection?.selectedIndex === idx && "bg-white/[0.05]",
                    className,
                  )}
                  style={style}
                  onClick={selection ? () => selection.onSelect(idx) : undefined}
                >
                  <td className="py-3 pr-4 pl-6 align-top font-mono text-[13px] whitespace-nowrap text-board-ink">
                    <FlightTime value={flight.scheduled_time} timeZone={flight.timezone} now={now} />
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-[13px] font-semibold text-board-amber">
                    <FlightNumber flight={flight} index={idx} selection={selection} />
                  </td>
                  <td className="px-4 py-3 align-top font-semibold text-board-ink">
                    {other.name ?? (other.iata || "—")}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-board-muted">
                    <span className="flex items-center gap-3 whitespace-nowrap">
                      <AirlineLogo flightNumber={flight.flight_number} airline={flight.airline} />
                      <span>{flight.airline ?? "—"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-[13px] whitespace-nowrap text-board-ink">
                    <FlightTime value={flight.estimated_time} timeZone={flight.timezone} now={now} />
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-[13px] whitespace-nowrap text-board-ink">
                    {gateLabel(flight)}
                  </td>
                  <td className="py-3 pr-6 pl-4 align-top">
                    <StatusLabel status={flight.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="max-h-[70vh] divide-y divide-board-line/70 overflow-auto md:hidden">
        {flights.map((flight, idx) => {
          const other = direction === "departures" ? flight.destination : flight.origin;
          const { className, style } = cascade(idx);
          return (
            <li
              key={`${flight.flight_number}-${idx}`}
              className={cn(
                "px-4 py-4",
                selection && "cursor-pointer",
                selection?.selectedIndex === idx && "bg-white/[0.05]",
                className,
              )}
              style={style}
              onClick={selection ? () => selection.onSelect(idx) : undefined}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono font-semibold text-board-amber">
                  <FlightNumber flight={flight} index={idx} selection={selection} />
                </p>
                <StatusLabel status={flight.status} />
              </div>
              <p className="mt-1 text-xs text-board-muted">{placeLabel}</p>
              <p className="font-semibold text-board-ink">{other.name ?? (other.iata || "—")}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-board-muted">
                <AirlineLogo flightNumber={flight.flight_number} airline={flight.airline} className="w-12" />
                <span>{flight.airline ?? "—"}</span>
              </p>

              <dl className="mt-3 grid grid-cols-3 gap-3 font-mono text-sm text-board-ink">
                <div>
                  <dt className="font-sans text-xs text-board-muted">Scheduled</dt>
                  <dd>
                    <FlightTime value={flight.scheduled_time} timeZone={flight.timezone} now={now} />
                  </dd>
                </div>
                <div>
                  <dt className="font-sans text-xs text-board-muted">Expected</dt>
                  <dd>
                    <FlightTime value={flight.estimated_time} timeZone={flight.timezone} now={now} />
                  </dd>
                </div>
                <div>
                  <dt className="font-sans text-xs text-board-muted">Terminal / Gate</dt>
                  <dd>{gateLabel(flight)}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
