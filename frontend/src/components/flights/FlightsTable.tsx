import { Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Flight, FlightStatus } from "@/types/flight";

const STATUS_STYLES: Record<FlightStatus, { badge: string; dot: string }> = {
  scheduled: {
    badge: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    dot: "bg-neutral-400",
  },
  active: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  landed: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  delayed: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  cancelled: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
  },
  diverted: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
  },
  unknown: {
    badge: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
    dot: "bg-neutral-400",
  },
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: FlightStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        style.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {status}
    </span>
  );
}

interface FlightsTableProps {
  flights: Flight[];
  direction: "departures" | "arrivals";
}

export function FlightsTable({ flights, direction }: FlightsTableProps) {
  if (flights.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700">
        <Plane className="size-8 -rotate-45 text-neutral-400 dark:text-neutral-600" />
        <div>
          <p className="font-medium text-neutral-700 dark:text-neutral-300">
            No {direction} found
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Try a different airport code or switch direction.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 shadow-sm md:block dark:border-neutral-800">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Flight</th>
                <th className="px-4 py-3 font-medium">Airline</th>
                <th className="px-4 py-3 font-medium">
                  {direction === "departures" ? "Destination" : "Origin"}
                </th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Estimated</th>
                <th className="px-4 py-3 font-medium">Terminal / Gate</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {flights.map((flight, idx) => {
                const other = direction === "departures" ? flight.destination : flight.origin;
                return (
                  <tr
                    key={`${flight.flight_number}-${idx}`}
                    className="odd:bg-white even:bg-neutral-50/60 hover:bg-sky-50 dark:odd:bg-neutral-950 dark:even:bg-neutral-900/40 dark:hover:bg-sky-950/30"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {flight.flight_number}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {flight.airline ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {other.name ?? (other.iata || "—")}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {formatTime(flight.scheduled_time)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {formatTime(flight.estimated_time)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {[flight.terminal, flight.gate].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={flight.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-auto md:hidden">
        {flights.map((flight, idx) => {
          const other = direction === "departures" ? flight.destination : flight.origin;
          return (
            <div
              key={`${flight.flight_number}-${idx}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {flight.flight_number}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {flight.airline ?? "—"}
                  </p>
                </div>
                <StatusBadge status={flight.status} />
              </div>

              <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {direction === "departures" ? "Destination" : "Origin"}
                </p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {other.name ?? (other.iata || "—")}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">Scheduled</p>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {formatTime(flight.scheduled_time)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">Estimated</p>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {formatTime(flight.estimated_time)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    Terminal / Gate
                  </p>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {[flight.terminal, flight.gate].filter(Boolean).join(" / ") || "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
