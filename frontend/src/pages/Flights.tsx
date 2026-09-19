import { AlertTriangle, PlaneTakeoff, RefreshCw, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { FlightsTable } from "@/components/flights/FlightsTable";
import { FlightsTableSkeleton } from "@/components/flights/FlightsTableSkeleton";
import { useFavorites } from "@/hooks/useFavorites";
import { useFlights } from "@/hooks/useFlights";
import { useRecentAirports } from "@/hooks/useRecentAirports";
import {
  ALL_AIRLINES,
  ALL_STATUSES,
  filterFlightsByAirline,
  filterFlightsByStatus,
  getUniqueAirlines,
} from "@/lib/flightFilters";
import type { FlightDirection, FlightStatus } from "@/types/flight";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;

const FLIGHT_STATUSES: FlightStatus[] = [
  "scheduled",
  "active",
  "landed",
  "cancelled",
  "diverted",
  "delayed",
  "unknown",
];

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function Flights() {
  const [searchParams] = useSearchParams();
  const [airportInput, setAirportInput] = useState(() =>
    (searchParams.get("airport") ?? "").toUpperCase(),
  );
  const [direction, setDirection] = useState<FlightDirection>(() =>
    searchParams.get("direction") === "arrivals" ? "arrivals" : "departures",
  );
  const [selectedAirline, setSelectedAirline] = useState<string>(
    () => searchParams.get("airline") ?? ALL_AIRLINES,
  );
  const [selectedStatus, setSelectedStatus] = useState<FlightStatus | typeof ALL_STATUSES>(
    () => (searchParams.get("status") as FlightStatus | typeof ALL_STATUSES) || ALL_STATUSES,
  );

  const isValidAirport = IATA_CODE_PATTERN.test(airportInput);
  const { data, isLoading, isFetching, isError, error, refetch } = useFlights(
    airportInput,
    direction,
  );
  const { recentAirports, addRecentAirport } = useRecentAirports();
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();

  const currentFavorite = isValidAirport
    ? {
        airport: airportInput,
        direction,
        airline: selectedAirline,
        status: selectedStatus,
      }
    : null;
  const currentIsFavorite = currentFavorite ? isFavorite(currentFavorite) : false;

  const handleToggleFavorite = () => {
    if (!currentFavorite) return;
    if (currentIsFavorite) {
      removeFavorite(currentFavorite);
    } else {
      addFavorite(currentFavorite);
    }
  };

  useEffect(() => {
    if (isValidAirport && data && !isError) {
      addRecentAirport(airportInput);
    }
  }, [isValidAirport, data, isError, airportInput, addRecentAirport]);

  const airlineOptions = useMemo(
    () => getUniqueAirlines(data?.flights ?? []),
    [data],
  );
  const filteredFlights = useMemo(() => {
    const byAirline = filterFlightsByAirline(data?.flights ?? [], selectedAirline);
    return filterFlightsByStatus(byAirline, selectedStatus);
  }, [data, selectedAirline, selectedStatus]);
  const isFilteredEmpty =
    (selectedAirline !== ALL_AIRLINES || selectedStatus !== ALL_STATUSES) &&
    !!data &&
    filteredFlights.length === 0;

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
          {recentAirports.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {recentAirports.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setAirportInput(code)}
                  className="rounded-full border border-neutral-300 px-2.5 py-1 font-mono text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {code}
                </button>
              ))}
            </div>
          )}
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

        <div className="flex flex-col gap-1">
          <label htmlFor="airline" className="text-sm text-neutral-500 dark:text-neutral-400">
            Airline
          </label>
          <select
            id="airline"
            value={selectedAirline}
            onChange={(e) => setSelectedAirline(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value={ALL_AIRLINES}>All Airlines</option>
            {airlineOptions.map((airline) => (
              <option key={airline} value={airline}>
                {airline}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm text-neutral-500 dark:text-neutral-400">
            Status
          </label>
          <select
            id="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as FlightStatus | typeof ALL_STATUSES)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value={ALL_STATUSES}>All Statuses</option>
            {FLIGHT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {isValidAirport && data && (
          <div className="ml-auto flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
            <span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {filteredFlights.length}
              </span>{" "}
              flights · updated {timeAgo(data.fetched_at)}
              {data.cached && " (cached)"}
            </span>
            <button
              onClick={handleToggleFavorite}
              aria-label={currentIsFavorite ? "Remove from favorites" : "Save as favorite"}
              aria-pressed={currentIsFavorite}
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Star
                className={`size-3.5 ${
                  currentIsFavorite ? "fill-sky-500 text-sky-500" : ""
                }`}
              />
            </button>
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

      {isValidAirport && data && !isError && isFilteredEmpty && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          <PlaneTakeoff className="size-8 text-neutral-400 dark:text-neutral-600" />
          <p>No flights match the selected filters.</p>
        </div>
      )}

      {isValidAirport && data && !isError && !isFilteredEmpty && (
        <FlightsTable flights={filteredFlights} direction={direction} />
      )}
    </div>
  );
}
