import {
  AlertTriangle,
  Clock,
  Hash,
  LocateFixed,
  PlaneTakeoff,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { FlightsTable } from "@/components/flights/FlightsTable";
import { FlightsTableSkeleton } from "@/components/flights/FlightsTableSkeleton";
import { getAirportByIata } from "@/data/airports";
import { useFavorites } from "@/hooks/useFavorites";
import { useFlightLookup } from "@/hooks/useFlightLookup";
import { useFlights } from "@/hooks/useFlights";
import { useNearestAirport } from "@/hooks/useNearestAirport";
import { useRecentAirports } from "@/hooks/useRecentAirports";
import { ApiError } from "@/lib/api";
import {
  ALL_AIRLINES,
  ALL_STATUSES,
  filterFlightsByAirline,
  filterFlightsByStatus,
  getUniqueAirlines,
} from "@/lib/flightFilters";
import type { FlightDirection, FlightStatus } from "@/types/flight";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;
const FLIGHT_NUMBER_PATTERN = /^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$/;

type SearchMode = "airport" | "flight";

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
  // Filter state lives in the URL query string (not useState) so a search is
  // shareable via link and the browser back/forward buttons work as expected.
  const [searchParams, setSearchParams] = useSearchParams();

  const mode: SearchMode = searchParams.get("mode") === "flight" ? "flight" : "airport";
  const airportInput = (searchParams.get("airport") ?? "").toUpperCase();
  const direction = (searchParams.get("type") as FlightDirection | null) ?? "departures";
  const selectedAirline = searchParams.get("airline") ?? ALL_AIRLINES;
  const selectedStatus =
    (searchParams.get("status") as FlightStatus | null) ?? ALL_STATUSES;
  const flightNumberInput = (searchParams.get("flight") ?? "").toUpperCase();

  function updateParams(patch: Record<string, string | null>, options?: { push?: boolean }) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === "") next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      // Continuous typing uses `replace` so every keystroke doesn't spam
      // browser history; discrete selections (dropdowns/buttons) `push` so
      // the back button can undo one filter change at a time.
      { replace: !options?.push },
    );
  }

  const setMode = (value: SearchMode) =>
    updateParams({ mode: value === "airport" ? null : "flight" }, { push: true });
  const setAirportInput = (code: string) => updateParams({ airport: code || null });
  const setDirection = (value: FlightDirection) =>
    updateParams({ type: value === "departures" ? null : value }, { push: true });
  const setSelectedAirline = (airline: string) =>
    updateParams({ airline: airline === ALL_AIRLINES ? null : airline }, { push: true });
  const setSelectedStatus = (status: string) =>
    updateParams({ status: status === ALL_STATUSES ? null : status }, { push: true });
  const setFlightNumberInput = (value: string) =>
    updateParams({ flight: value.toUpperCase() || null });

  const isValidAirport = IATA_CODE_PATTERN.test(airportInput);
  const isValidFlightNumber = FLIGHT_NUMBER_PATTERN.test(flightNumberInput);

  // Only attempt location-based detection once, on the initial load of the
  // "by airport" search with nothing already selected — not every time the
  // input happens to become empty again (e.g. the user clearing it by hand).
  const [autoDetectOnLoad] = useState(() => mode === "airport" && !airportInput);
  const nearestAirport = useNearestAirport({ enabled: autoDetectOnLoad });
  const matchedAirport = isValidAirport ? getAirportByIata(airportInput) : undefined;

  // Auto-load path: react to the hook's state once the on-mount lookup
  // resolves, but don't clobber a code the user already typed while we were
  // waiting on the browser's location prompt.
  useEffect(() => {
    if (nearestAirport.status !== "found" || !nearestAirport.airport) return;
    if (searchParams.get("airport")) return;
    setAirportInput(nearestAirport.airport.iata);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestAirport.status, nearestAirport.airport]);

  // Manual "Use my location" path: apply the lookup's own resolved result
  // directly (always overwriting, since it's an explicit user action) rather
  // than reacting to hook state — two consecutive lookups can resolve to the
  // identical airport, which wouldn't trigger the effect above again.
  const locateFromButton = async () => {
    const result = await nearestAirport.locate();
    if (result.status === "found" && result.airport) {
      setAirportInput(result.airport.iata);
    }
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useFlights(
    airportInput,
    direction,
  );
  const hasLoadedAirport = isValidAirport && !!data;
  const {
    data: lookupData,
    isLoading: isLookupLoading,
    isFetching: isLookupFetching,
    isError: isLookupError,
    error: lookupError,
    refetch: refetchLookup,
  } = useFlightLookup(flightNumberInput);
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

      <div className="mb-4 flex gap-2">
        <Button
          variant={mode === "airport" ? "default" : "outline"}
          onClick={() => setMode("airport")}
        >
          By Airport
        </Button>
        <Button
          variant={mode === "flight" ? "default" : "outline"}
          onClick={() => setMode("flight")}
        >
          By Flight Number
        </Button>
      </div>

      {mode === "airport" && nearestAirport.status !== "idle" && (
        <div className="mb-4" aria-live="polite">
          {nearestAirport.status === "locating" && (
            <p className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <LocateFixed className="size-4 animate-pulse" />
              Finding the nearest airport to your location…
            </p>
          )}
          {nearestAirport.status === "found" &&
            nearestAirport.airport &&
            airportInput === nearestAirport.airport.iata && (
              <p className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-400">
                <LocateFixed className="size-4" />
                Showing flights for {nearestAirport.airport.name} ({nearestAirport.airport.iata})
                — the nearest supported airport to your location, about{" "}
                {Math.round(nearestAirport.distanceKm ?? 0)} km away.
              </p>
            )}
          {nearestAirport.status === "denied" && !hasLoadedAirport && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Location access was denied — enter an airport code below to see live flights.
            </p>
          )}
          {nearestAirport.status === "unavailable" && !hasLoadedAirport && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Couldn't determine your location — enter an airport code below to see live
              flights.
            </p>
          )}
          {nearestAirport.status === "unsupported" && !hasLoadedAirport && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Location detection isn't available in this browser — enter an airport code
              below.
            </p>
          )}
          {nearestAirport.status === "out-of-range" && !hasLoadedAirport && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              We couldn't find a supported airport near your location — enter one below.
            </p>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
        {mode === "airport" && (
          <>
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
              {matchedAirport && (
                <p className="pt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {matchedAirport.name} · {matchedAirport.city}, {matchedAirport.country}
                </p>
              )}
              <button
                type="button"
                onClick={locateFromButton}
                disabled={nearestAirport.status === "locating"}
                className="flex w-fit items-center gap-1 pt-1 text-xs text-sky-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
              >
                <LocateFixed className="size-3" />
                Use my location
              </button>
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
                onChange={(e) => setSelectedStatus(e.target.value)}
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
                    className={`size-3.5 ${currentIsFavorite ? "fill-sky-500 text-sky-500" : ""
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
          </>
        )}

        {mode === "flight" && (
          <>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="flight-number"
                className="text-sm text-neutral-500 dark:text-neutral-400"
              >
                Flight number
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="flight-number"
                  type="text"
                  maxLength={8}
                  placeholder="e.g. AA100"
                  value={flightNumberInput}
                  onChange={(e) => setFlightNumberInput(e.target.value)}
                  className="w-40 rounded-md border border-neutral-300 bg-white py-2 pr-3 pl-9 font-mono uppercase text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            {isValidFlightNumber && lookupData && (
              <div className="ml-auto flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <span>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {lookupData.flights.length}
                  </span>{" "}
                  {lookupData.flights.length === 1 ? "result" : "results"} · updated{" "}
                  {timeAgo(lookupData.fetched_at)}
                  {lookupData.cached && " (cached)"}
                </span>
                <button
                  onClick={() => refetchLookup()}
                  disabled={isLookupFetching}
                  aria-label="Refresh"
                  className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <RefreshCw className={`size-3.5 ${isLookupFetching ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {mode === "airport" && (
        <>
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

          {isValidAirport && isError && error instanceof ApiError && error.status === 429 && (
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
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="size-3.5" /> Try again
              </Button>
            </div>
          )}

          {isValidAirport && isError && !(error instanceof ApiError && error.status === 429) && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/40 dark:bg-red-950/20">
              <AlertTriangle className="size-8 text-red-500" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  Couldn't load flights
                </p>
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
        </>
      )}

      {mode === "flight" && (
        <>
          {flightNumberInput.length > 0 && !isValidFlightNumber && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Enter a valid flight number (e.g. AA100).
            </p>
          )}

          {!flightNumberInput && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <Hash className="size-8 text-neutral-400 dark:text-neutral-600" />
              <p>Enter a flight number above to look up its status.</p>
            </div>
          )}

          {isValidFlightNumber && isLookupLoading && <FlightsTableSkeleton />}

          {isValidFlightNumber &&
            isLookupError &&
            lookupError instanceof ApiError &&
            lookupError.status === 429 && (
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
                <Button variant="outline" size="sm" onClick={() => refetchLookup()}>
                  <RefreshCw className="size-3.5" /> Try again
                </Button>
              </div>
            )}

          {isValidFlightNumber &&
            isLookupError &&
            !(lookupError instanceof ApiError && lookupError.status === 429) && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/40 dark:bg-red-950/20">
                <AlertTriangle className="size-8 text-red-500" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">
                    Couldn't look up that flight
                  </p>
                  <p className="mx-auto max-w-md px-4 text-sm text-red-600/80 dark:text-red-400/70">
                    {lookupError instanceof Error ? lookupError.message : "Unknown error"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchLookup()}>
                  <RefreshCw className="size-3.5" /> Try again
                </Button>
              </div>
            )}

          {isValidFlightNumber && lookupData && !isLookupError && (
            <FlightsTable
              flights={lookupData.flights}
              direction="departures"
              emptyTitle="No flight found"
              emptyDescription="Check the flight number and try again — it may not be operating today."
            />
          )}
        </>
      )}
    </div>
  );
}
