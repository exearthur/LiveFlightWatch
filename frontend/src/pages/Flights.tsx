import { PlaneTakeoff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AirportFlightsView } from "@/components/flights/AirportFlightsView";
import { FlightLookupView } from "@/components/flights/FlightLookupView";
import { FlightSearchForm, type SearchMode } from "@/components/flights/FlightSearchForm";
import { FlightsResultsHeader } from "@/components/flights/FlightsResultsHeader";
import { NearestAirportNotice } from "@/components/flights/NearestAirportNotice";
import { Button } from "@/components/ui/button";
import { getAirportByIata } from "@/data/airports";
import { useFavorites } from "@/hooks/useFavorites";
import { useFlightLookup } from "@/hooks/useFlightLookup";
import { useFlights } from "@/hooks/useFlights";
import { useNearestAirport } from "@/hooks/useNearestAirport";
import { useRecentAirports } from "@/hooks/useRecentAirports";
import {
  ALL_AIRLINES,
  ALL_STATUSES,
  filterFlightsByAirline,
  filterFlightsByDestination,
  filterFlightsByStatus,
  getUniqueAirlines,
} from "@/lib/flightFilters";
import type { FlightDirection, FlightStatus } from "@/types/flight";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;
const FLIGHT_NUMBER_PATTERN = /^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$/;

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
  const destinationInput = searchParams.get("destination") ?? "";
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
  const setDestinationInput = (value: string) => updateParams({ destination: value || null });
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
  const isDestinationFilterActive = direction === "departures" && destinationInput.trim() !== "";
  const filteredFlights = useMemo(() => {
    const byDestination = isDestinationFilterActive
      ? filterFlightsByDestination(data?.flights ?? [], destinationInput)
      : (data?.flights ?? []);
    const byAirline = filterFlightsByAirline(byDestination, selectedAirline);
    return filterFlightsByStatus(byAirline, selectedStatus);
  }, [data, isDestinationFilterActive, destinationInput, selectedAirline, selectedStatus]);
  const isFilteredEmpty =
    (selectedAirline !== ALL_AIRLINES || selectedStatus !== ALL_STATUSES || isDestinationFilterActive) &&
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

      {mode === "airport" && (
        <NearestAirportNotice
          nearestAirport={nearestAirport}
          airportCode={airportInput}
          hasLoadedAirport={hasLoadedAirport}
        />
      )}

      <FlightSearchForm
        mode={mode}
        airportCode={airportInput}
        matchedAirport={matchedAirport}
        recentAirports={recentAirports}
        isLocating={nearestAirport.status === "locating"}
        direction={direction}
        destination={destinationInput}
        airline={selectedAirline}
        airlineOptions={airlineOptions}
        status={selectedStatus}
        onAirportCodeChange={setAirportInput}
        onUseMyLocation={locateFromButton}
        onDirectionChange={setDirection}
        onDestinationChange={setDestinationInput}
        onAirlineChange={setSelectedAirline}
        onStatusChange={setSelectedStatus}
        flightNumber={flightNumberInput}
        onFlightNumberChange={setFlightNumberInput}
      >
        {mode === "airport" && isValidAirport && data && (
          <FlightsResultsHeader
            count={filteredFlights.length}
            countLabel="flights"
            fetchedAt={data.fetched_at}
            cached={data.cached}
            isFetching={isFetching}
            onRefresh={() => refetch()}
            favorite={{ isFavorite: currentIsFavorite, onToggle: handleToggleFavorite }}
          />
        )}
        {mode === "flight" && isValidFlightNumber && lookupData && (
          <FlightsResultsHeader
            count={lookupData.flights.length}
            countLabel={lookupData.flights.length === 1 ? "result" : "results"}
            fetchedAt={lookupData.fetched_at}
            cached={lookupData.cached}
            isFetching={isLookupFetching}
            onRefresh={() => refetchLookup()}
          />
        )}
      </FlightSearchForm>

      {mode === "airport" && (
        <AirportFlightsView
          airportCode={airportInput}
          isValidAirport={isValidAirport}
          direction={direction}
          flights={data ? filteredFlights : undefined}
          isFilteredEmpty={isFilteredEmpty}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={() => refetch()}
        />
      )}

      {mode === "flight" && (
        <FlightLookupView
          flightNumber={flightNumberInput}
          isValidFlightNumber={isValidFlightNumber}
          flights={lookupData?.flights}
          isLoading={isLookupLoading}
          isError={isLookupError}
          error={lookupError}
          onRetry={() => refetchLookup()}
        />
      )}
    </div>
  );
}
