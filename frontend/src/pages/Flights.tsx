import { AlertTriangle, PlaneTakeoff, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FlightsTable } from "@/components/flights/FlightsTable";
import { FlightsTableSkeleton } from "@/components/flights/FlightsTableSkeleton";
import { useFlights } from "@/hooks/useFlights";
import type { FlightDirection } from "@/types/flight";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function Flights() {
  const [airportInput, setAirportInput] = useState("");
  const [direction, setDirection] = useState<FlightDirection>("departures");

  const isValidAirport = IATA_CODE_PATTERN.test(airportInput);
  const { data, isLoading, isFetching, isError, error, refetch } = useFlights(
    airportInput,
    direction,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400">
          <PlaneTakeoff className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Live Flights
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Real-time departures and arrivals for any airport, worldwide.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex flex-col gap-1">
          <label htmlFor="airport" className="text-sm text-neutral-500 dark:text-neutral-400">
            Airport code (IATA)
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="airport"
              type="text"
              maxLength={3}
              placeholder="e.g. JFK"
              value={airportInput}
              onChange={(e) => setAirportInput(e.target.value.toUpperCase())}
              className="w-36 rounded-md border border-neutral-300 bg-white py-2 pr-3 pl-9 font-mono uppercase text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={direction === "departures" ? "default" : "outline"}
            onClick={() => setDirection("departures")}
          >
            Departures
          </Button>
          <Button
            variant={direction === "arrivals" ? "default" : "outline"}
            onClick={() => setDirection("arrivals")}
          >
            Arrivals
          </Button>
        </div>

        {isValidAirport && data && (
          <div className="ml-auto flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
            <span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {data.flights.length}
              </span>{" "}
              flights · updated {timeAgo(data.fetched_at)}
              {data.cached && " (cached)"}
            </span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {airportInput.length > 0 && !isValidAirport && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Enter a valid 3-letter IATA airport code.
        </p>
      )}

      {!airportInput && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          <PlaneTakeoff className="size-8 text-neutral-400 dark:text-neutral-600" />
          <p>Enter an airport code above to see live flights.</p>
        </div>
      )}

      {isValidAirport && isLoading && <FlightsTableSkeleton />}

      {isValidAirport && isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <AlertTriangle className="size-8 text-red-500" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">Couldn't load flights</p>
            <p className="mx-auto max-w-md px-4 text-sm text-red-600/80 dark:text-red-400/70">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-3.5" /> Try again
          </Button>
        </div>
      )}

      {isValidAirport && data && !isError && (
        <FlightsTable flights={data.flights} direction={direction} />
      )}
    </div>
  );
}
