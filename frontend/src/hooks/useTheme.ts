import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage can throw (e.g. private browsing / disabled storage).
    // Fall through and treat it as "no explicit choice".
  }
  return null;
}

function getSystemTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

/**
 * Manual dark-mode toggle with OS-preference fallback.
 *
 * - If the user has explicitly chosen a theme, it's persisted to
 *   localStorage and always wins.
 * - Otherwise the theme follows `prefers-color-scheme` and updates live if
 *   the OS preference changes.
 * - Applies the resolved theme by toggling a `dark` (and `light`) class on
 *   `<html>`, which `index.css` and Tailwind's `dark:` variant key off of.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => getStoredTheme() ?? getSystemTheme(),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    // Only follow live OS changes when the user hasn't made an explicit choice.
    if (getStoredTheme() !== null) {
      return;
    }

    let mql: MediaQueryList;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (getStoredTheme() !== null) return;
      setThemeState(event.matches ? "dark" : "light");
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can throw; the theme still applies for this session.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
