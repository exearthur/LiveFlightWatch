import { useCallback, useState } from "react";

const STORAGE_KEY = "lfw:recent-airports";
const MAX_RECENT_AIRPORTS = 5;

function readRecentAirports(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((code): code is string => typeof code === "string");
  } catch {
    return [];
  }
}

function writeRecentAirports(codes: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // Ignore write failures (private browsing, storage disabled, quota, etc.)
  }
}

export function useRecentAirports() {
  const [recentAirports, setRecentAirports] = useState<string[]>(() => readRecentAirports());

  const addRecentAirport = useCallback((code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;

    setRecentAirports((prev) => {
      const next = [normalized, ...prev.filter((c) => c !== normalized)].slice(
        0,
        MAX_RECENT_AIRPORTS,
      );
      writeRecentAirports(next);
      return next;
    });
  }, []);

  return { recentAirports, addRecentAirport };
}
