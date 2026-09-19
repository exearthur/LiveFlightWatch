import { useCallback, useState } from "react";

import { ALL_AIRLINES, ALL_STATUSES } from "@/lib/flightFilters";
import type { FlightDirection, FlightStatus } from "@/types/flight";

const STORAGE_KEY = "lfw:favorites";

export interface Favorite {
  airport: string;
  direction: FlightDirection;
  airline: string | typeof ALL_AIRLINES;
  status: FlightStatus | typeof ALL_STATUSES;
}

/** Stable identity for a favorite, used for dedupe and lookups. */
export function getFavoriteId(favorite: Favorite): string {
  return `${favorite.airport}:${favorite.direction}:${favorite.airline}:${favorite.status}`;
}

function isFlightDirection(value: unknown): value is FlightDirection {
  return value === "departures" || value === "arrivals";
}

function readFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((fav): fav is Favorite => {
      return (
        !!fav &&
        typeof fav === "object" &&
        typeof fav.airport === "string" &&
        isFlightDirection(fav.direction) &&
        typeof fav.airline === "string" &&
        typeof fav.status === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeFavorites(favorites: Favorite[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Ignore write failures (private browsing, storage disabled, quota, etc.)
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>(() => readFavorites());

  const addFavorite = useCallback((favorite: Favorite) => {
    const normalized: Favorite = {
      ...favorite,
      airport: favorite.airport.trim().toUpperCase(),
    };
    if (!normalized.airport) return;

    setFavorites((prev) => {
      const id = getFavoriteId(normalized);
      const next = [normalized, ...prev.filter((f) => getFavoriteId(f) !== id)];
      writeFavorites(next);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((favorite: Favorite) => {
    setFavorites((prev) => {
      const id = getFavoriteId(favorite);
      const next = prev.filter((f) => getFavoriteId(f) !== id);
      writeFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (favorite: Favorite) => {
      const id = getFavoriteId(favorite);
      return favorites.some((f) => getFavoriteId(f) === id);
    },
    [favorites],
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}
