import { useCallback, useState } from "react";

import type { Flight } from "@/types/flight";

const STORAGE_KEY = "lfw:saved-flights";

/**
 * A flight the user starred, kept in the browser. Only what identifies the
 * service is stored: its live state is looked up again when it is opened, so
 * a saved flight never shows a stale time or gate.
 */
export interface SavedFlight {
  flightNumber: string;
  airline: string | null;
  origin: string;
  destination: string;
}

function isSavedFlight(value: unknown): value is SavedFlight {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.flightNumber === "string" &&
    (v.airline === null || typeof v.airline === "string") &&
    typeof v.origin === "string" &&
    typeof v.destination === "string"
  );
}

function readSavedFlights(): SavedFlight[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedFlight) : [];
  } catch {
    return [];
  }
}

function writeSavedFlights(flights: SavedFlight[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flights));
  } catch {
    // Ignore write failures (private browsing, storage disabled, quota, etc.)
  }
}

/** Saved flights are identified by flight number alone: one number, one service. */
export function toSavedFlight(flight: Flight): SavedFlight {
  return {
    flightNumber: flight.flight_number.toUpperCase(),
    airline: flight.airline,
    origin: flight.origin.iata,
    destination: flight.destination.iata,
  };
}

export function useSavedFlights() {
  const [savedFlights, setSavedFlights] = useState<SavedFlight[]>(() => readSavedFlights());

  const saveFlight = useCallback((flight: SavedFlight) => {
    setSavedFlights((prev) => {
      const next = [flight, ...prev.filter((f) => f.flightNumber !== flight.flightNumber)];
      writeSavedFlights(next);
      return next;
    });
  }, []);

  const removeFlight = useCallback((flightNumber: string) => {
    setSavedFlights((prev) => {
      const next = prev.filter((f) => f.flightNumber !== flightNumber.toUpperCase());
      writeSavedFlights(next);
      return next;
    });
  }, []);

  const isSaved = useCallback(
    (flightNumber: string) => savedFlights.some((f) => f.flightNumber === flightNumber.toUpperCase()),
    [savedFlights],
  );

  return { savedFlights, saveFlight, removeFlight, isSaved };
}
