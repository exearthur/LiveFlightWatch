import { IconCurrentLocation } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { ALL_AIRLINES, ALL_STATUSES } from "@/lib/flightFilters";
import { cn } from "@/lib/utils";
import type { FlightDirection, FlightStatus } from "@/types/flight";

export type SearchMode = "airport" | "flight";

const FLIGHT_STATUSES: FlightStatus[] = [
  "scheduled",
  "active",
  "landed",
  "cancelled",
  "diverted",
  "delayed",
  "unknown",
];

/** Input styling for controls on the dark board panel. */
export const boardFieldClass =
  "h-10 rounded-md border border-board-line bg-board-raised px-3 text-board-ink outline-none transition-colors placeholder:text-board-muted/80 hover:border-board-muted/50 focus:border-board-amber focus:ring-2 focus:ring-board-amber/25";

const labelClass = "text-xs text-board-muted";

interface FlightSearchFormProps {
  mode: SearchMode;

  // "By airport" fields
  airportCode: string;
  recentAirports: string[];
  isLocating: boolean;
  direction: FlightDirection;
  destination: string;
  airline: string;
  airlineOptions: string[];
  status: string;
  onAirportCodeChange: (code: string) => void;
  onUseMyLocation: () => void;
  onDestinationChange: (destination: string) => void;
  onAirlineChange: (airline: string) => void;
  onStatusChange: (status: string) => void;

  // "By flight number" fields
  flightNumber: string;
  onFlightNumberChange: (flightNumber: string) => void;

  /** Rendered at the end of the strip: the results header for the loaded data. */
  children?: ReactNode;
}

/**
 * The control strip across the board panel: airport and filter fields in
 * "airport" mode, or the flight-number field in "flight" mode. Fully
 * controlled; the page owns the values (URL query params) and decides how
 * each change is applied.
 */
export function FlightSearchForm({
  mode,
  airportCode,
  recentAirports,
  isLocating,
  direction,
  destination,
  airline,
  airlineOptions,
  status,
  onAirportCodeChange,
  onUseMyLocation,
  onDestinationChange,
  onAirlineChange,
  onStatusChange,
  flightNumber,
  onFlightNumberChange,
  children,
}: FlightSearchFormProps) {
  return (
    <div className="grid grid-cols-2 items-end gap-4 border-y border-board-line px-4 py-4 sm:flex sm:flex-wrap sm:px-6">
      {mode === "airport" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="airport" className={labelClass}>
              Airport code (IATA)
            </label>
            <input
              id="airport"
              type="text"
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
              placeholder="JFK"
              value={airportCode}
              onChange={(e) => onAirportCodeChange(e.target.value.toUpperCase())}
              className={cn(boardFieldClass, "w-full font-mono tracking-[0.2em] uppercase sm:w-28")}
            />
          </div>

          {direction === "departures" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="destination" className={labelClass}>
                Destination
              </label>
              <input
                id="destination"
                type="text"
                placeholder="LAX or city"
                value={destination}
                onChange={(e) => onDestinationChange(e.target.value)}
                className={cn(boardFieldClass, "w-full sm:w-48")}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="airline" className={labelClass}>
              Airline
            </label>
            <select
              id="airline"
              value={airline}
              onChange={(e) => onAirlineChange(e.target.value)}
              className={cn(boardFieldClass, "w-full sm:w-auto sm:max-w-56")}
            >
              <option value={ALL_AIRLINES}>All Airlines</option>
              {airlineOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className={cn(boardFieldClass, "w-full sm:w-auto")}
            >
              <option value={ALL_STATUSES}>All Statuses</option>
              {FLIGHT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {mode === "flight" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="flight-number" className={labelClass}>
            Flight number
          </label>
          <input
            id="flight-number"
            type="text"
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
            placeholder="AA100"
            value={flightNumber}
            onChange={(e) => onFlightNumberChange(e.target.value)}
            className={cn(boardFieldClass, "w-full font-mono tracking-[0.15em] uppercase sm:w-36")}
          />
        </div>
      )}

      {children}

      {mode === "airport" && (
        <div className="col-span-2 flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 text-board-amber hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconCurrentLocation className="size-4" stroke={1.75} aria-hidden="true" />
            Use my location
          </button>
          {recentAirports.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-board-muted">Recent</span>
              {recentAirports.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onAirportCodeChange(code)}
                  aria-pressed={code === airportCode}
                  className={cn(
                    "rounded-[4px] border px-2 py-0.5 font-mono text-xs tracking-wider transition-colors",
                    code === airportCode
                      ? "border-board-amber/60 text-board-amber"
                      : "border-board-line text-board-ink hover:border-board-muted/60",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
