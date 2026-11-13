import { Hash, LocateFixed, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { SupportedAirport } from "@/data/airports";
import { ALL_AIRLINES, ALL_STATUSES } from "@/lib/flightFilters";
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

interface FlightSearchFormProps {
  mode: SearchMode;

  // "By Airport" fields
  airportCode: string;
  /** Known airport for a valid `airportCode`, shown as a hint under the input. */
  matchedAirport: SupportedAirport | undefined;
  recentAirports: string[];
  isLocating: boolean;
  direction: FlightDirection;
  destination: string;
  airline: string;
  airlineOptions: string[];
  status: string;
  onAirportCodeChange: (code: string) => void;
  onUseMyLocation: () => void;
  onDirectionChange: (direction: FlightDirection) => void;
  onDestinationChange: (destination: string) => void;
  onAirlineChange: (airline: string) => void;
  onStatusChange: (status: string) => void;

  // "By Flight Number" fields
  flightNumber: string;
  onFlightNumberChange: (flightNumber: string) => void;

  /** Rendered after the fields — the results header for the loaded data. */
  children?: ReactNode;
}

/**
 * The search panel: airport + filter controls in "airport" mode, or the
 * flight-number input in "flight" mode. Fully controlled; the page owns the
 * values (URL query params) and decides how each change is applied.
 */
export function FlightSearchForm({
  mode,
  airportCode,
  matchedAirport,
  recentAirports,
  isLocating,
  direction,
  destination,
  airline,
  airlineOptions,
  status,
  onAirportCodeChange,
  onUseMyLocation,
  onDirectionChange,
  onDestinationChange,
  onAirlineChange,
  onStatusChange,
  flightNumber,
  onFlightNumberChange,
  children,
}: FlightSearchFormProps) {
  return (
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
                value={airportCode}
                onChange={(e) => onAirportCodeChange(e.target.value.toUpperCase())}
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
              onClick={onUseMyLocation}
              disabled={isLocating}
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
                    onClick={() => onAirportCodeChange(code)}
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
              onClick={() => onDirectionChange("departures")}
            >
              Departures
            </Button>
            <Button
              variant={direction === "arrivals" ? "default" : "outline"}
              onClick={() => onDirectionChange("arrivals")}
            >
              Arrivals
            </Button>
          </div>

          {direction === "departures" && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="destination"
                className="text-sm text-neutral-500 dark:text-neutral-400"
              >
                Destination
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="destination"
                  type="text"
                  placeholder="e.g. LAX or Los Angeles"
                  value={destination}
                  onChange={(e) => onDestinationChange(e.target.value)}
                  className="w-48 rounded-md border border-neutral-300 bg-white py-2 pr-3 pl-9 text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="airline" className="text-sm text-neutral-500 dark:text-neutral-400">
              Airline
            </label>
            <select
              id="airline"
              value={airline}
              onChange={(e) => onAirlineChange(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value={ALL_AIRLINES}>All Airlines</option>
              {airlineOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
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
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
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
              value={flightNumber}
              onChange={(e) => onFlightNumberChange(e.target.value)}
              className="w-40 rounded-md border border-neutral-300 bg-white py-2 pr-3 pl-9 font-mono uppercase text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
