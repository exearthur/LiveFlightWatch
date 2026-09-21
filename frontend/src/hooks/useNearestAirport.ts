import { useCallback, useEffect, useState } from "react";

import { SUPPORTED_AIRPORTS, type SupportedAirport } from "@/data/airports";
import { findNearestAirport } from "@/lib/geo";

export type NearestAirportStatus =
  | "idle"
  | "locating"
  | "found"
  | "denied"
  | "unavailable"
  | "unsupported"
  | "out-of-range";

// Beyond this, a "nearest" airport isn't reasonably nearby anymore.
const MAX_DISTANCE_KM = 300;
const GEOLOCATION_TIMEOUT_MS = 10_000;
const GEOLOCATION_MAX_AGE_MS = 5 * 60 * 1000;

export interface LocateResult {
  status: Exclude<NearestAirportStatus, "idle" | "locating">;
  airport: SupportedAirport | null;
  distanceKm: number | null;
}

export interface UseNearestAirportResult {
  status: NearestAirportStatus;
  airport: SupportedAirport | null;
  distanceKm: number | null;
  /**
   * Re-runs geolocation + nearest-airport lookup on demand, resolving with
   * the outcome directly. Callers that need to react to a specific lookup
   * (e.g. a "use my location" button) should use this return value rather
   * than watching `status`/`airport`, since two consecutive lookups can
   * resolve to the identical airport and produce no state change to react to.
   */
  locate: () => Promise<LocateResult>;
}

/**
 * Determines the nearest supported airport from the browser's geolocation.
 * Never throws: permission denial, an unsupported browser, a geolocation
 * error, or no supported airport within range all resolve to a distinct
 * `status` so the caller can fall back to manual airport search.
 */
export function useNearestAirport({ enabled }: { enabled: boolean }): UseNearestAirportResult {
  const [status, setStatus] = useState<NearestAirportStatus>("idle");
  const [match, setMatch] = useState<{ airport: SupportedAirport; distanceKm: number } | null>(
    null,
  );

  const locate = useCallback((): Promise<LocateResult> => {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setStatus("unsupported");
        setMatch(null);
        resolve({ status: "unsupported", airport: null, distanceKm: null });
        return;
      }

      setStatus("locating");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nearest = findNearestAirport(
            { lat: position.coords.latitude, lon: position.coords.longitude },
            SUPPORTED_AIRPORTS,
            MAX_DISTANCE_KM,
          );

          if (!nearest) {
            setMatch(null);
            setStatus("out-of-range");
            resolve({ status: "out-of-range", airport: null, distanceKm: null });
            return;
          }

          setMatch(nearest);
          setStatus("found");
          resolve({ status: "found", airport: nearest.airport, distanceKm: nearest.distanceKm });
        },
        (error) => {
          const nextStatus = error.code === error.PERMISSION_DENIED ? "denied" : "unavailable";
          setMatch(null);
          setStatus(nextStatus);
          resolve({ status: nextStatus, airport: null, distanceKm: null });
        },
        {
          enableHighAccuracy: false,
          timeout: GEOLOCATION_TIMEOUT_MS,
          maximumAge: GEOLOCATION_MAX_AGE_MS,
        },
      );
    });
  }, []);

  useEffect(() => {
    if (enabled) void locate();
  }, [enabled, locate]);

  return {
    status,
    airport: match?.airport ?? null,
    distanceKm: match?.distanceKm ?? null,
    locate,
  };
}
