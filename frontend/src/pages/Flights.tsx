import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { AirportFlightsView } from "@/components/flights/AirportFlightsView";
import { FlightLookupView } from "@/components/flights/FlightLookupView";
import { FlightSearchForm, type SearchMode } from "@/components/flights/FlightSearchForm";
import { FlightsResultsHeader } from "@/components/flights/FlightsResultsHeader";
import { NearestAirportNotice } from "@/components/flights/NearestAirportNotice";
import { SplitFlap } from "@/components/ui/split-flap";
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
import { cn } from "@/lib/utils";
import type { FlightDirection, FlightStatus } from "@/types/flight";

const IATA_CODE_PATTERN = /^[A-Za-z]{3}$/;
const FLIGHT_NUMBER_PATTERN = /^[A-Za-z]{2,3}[0-9]{1,4}[A-Za-z]?$/;

/**
 * Two mutually exclusive buttons. `tone` picks the colours: "page" for the
 * light/dark page background, "board" for the dark board panel.
 */
function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  tone,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  tone: "page" | "board";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex rounded-lg p-1",
        tone === "page" ? "bg-foreground/[0.06]" : "bg-board-raised",
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm transition-colors",
              tone === "page" &&
                (selected
                  ? "bg-surface font-semibold text-foreground shadow-[0_1px_2px_rgb(26_30_36/0.12)]"
                  : "text-muted-foreground hover:text-foreground"),
              tone === "board" &&
                (selected
                  ? "bg-board-amber font-semibold text-board"
                  : "text-board-muted hover:text-board-ink"),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Top of the board: the code on split flaps, what it refers to, and an optional control. */
function BoardHeader({
  flapText,
  flapLength,
  flapSize,
  title,
  subtitle,
  aside,
}: {
  flapText: string;
  flapLength: number;
  flapSize: "md" | "lg" | "xl";
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <SplitFlap text={flapText} length={flapLength} size={flapSize} />
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-snug font-semibold text-balance text-board-ink sm:text-xl">
          {title}
        </p>
        {subtitle && <p className="text-sm text-board-muted">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
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
  // "by airport" search with nothing already selected, not every time the
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
  // than reacting to hook state, because two consecutive lookups can resolve
  // to the identical airport, which wouldn't trigger the effect above again.
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

  const airportTitle = matchedAirport
    ? matchedAirport.name
    : isValidAirport
      ? `Airport ${airportInput}`
      : "Choose an airport";
  const airportSubtitle = matchedAirport
    ? `${matchedAirport.city}, ${matchedAirport.country}`
    : isValidAirport
      ? undefined
      : "Type its 3-letter code, or use your location.";

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:pt-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Live flights</h1>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            Departures and arrivals for any airport, or the status of one flight.
          </p>
        </div>
        <SegmentedControl
          label="Search by"
          tone="page"
          value={mode}
          onChange={setMode}
          options={[
            { value: "airport", label: "By airport" },
            { value: "flight", label: "By flight number" },
          ]}
        />
      </div>

      {mode === "airport" && (
        <div className="mb-3">
          <NearestAirportNotice
            nearestAirport={nearestAirport}
            airportCode={airportInput}
            hasLoadedAirport={hasLoadedAirport}
          />
        </div>
      )}

      <section
        aria-label={mode === "airport" ? "Flight board" : "Flight lookup"}
        className="overflow-hidden rounded-xl bg-board text-board-ink shadow-[0_24px_48px_-24px_rgb(14_16_19/0.55)]"
      >
        {mode === "airport" ? (
          <BoardHeader
            flapText={airportInput}
            flapLength={3}
            flapSize="xl"
            title={airportTitle}
            subtitle={airportSubtitle}
            aside={
              <SegmentedControl
                label="Direction"
                tone="board"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: "departures", label: "Departures" },
                  { value: "arrivals", label: "Arrivals" },
                ]}
              />
            }
          />
        ) : (
          <BoardHeader
            flapText={flightNumberInput}
            flapLength={6}
            flapSize="md"
            title={isValidFlightNumber ? `Flight ${flightNumberInput}` : "Look up a flight"}
            subtitle={isValidFlightNumber ? undefined : "Use the airline code and number, such as AA100."}
          />
        )}

        <FlightSearchForm
          mode={mode}
          airportCode={airportInput}
          recentAirports={recentAirports}
          isLocating={nearestAirport.status === "locating"}
          direction={direction}
          destination={destinationInput}
          airline={selectedAirline}
          airlineOptions={airlineOptions}
          status={selectedStatus}
          onAirportCodeChange={setAirportInput}
          onUseMyLocation={locateFromButton}
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
      </section>
    </main>
  );
}
