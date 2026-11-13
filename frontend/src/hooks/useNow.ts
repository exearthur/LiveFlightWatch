import { useEffect, useState } from "react";

/**
 * The current time (epoch ms), re-read every `intervalMs` so anything
 * derived from it, such as a relative-time label, keeps moving while the
 * component stays mounted instead of freezing at its last render.
 */
export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
