import { useWeather } from "@/hooks/useWeather";
import { CATEGORY_NAME, CATEGORY_TONE, describeWind } from "@/lib/weather";
import { cn } from "@/lib/utils";

const TONE_TEXT = {
  ok: "text-board-green",
  warn: "text-board-amber",
  alert: "text-board-red",
  neutral: "text-board-muted",
} as const;

/**
 * One line of current conditions under the airport's name on the board:
 * temperature, wind and flight rules. It says nothing when there is no
 * report, so a missing METAR never puts an error on the board.
 */
export function BoardWeather({ airport }: { airport: string | null }) {
  const { data } = useWeather(airport);
  const weather = data?.weather;
  if (!weather) return null;

  const wind = describeWind(weather);
  const category = weather.flight_category;

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-board-muted">
      <span className="sr-only">Current weather:</span>
      {weather.temperature_c !== null && (
        <span className="font-mono text-board-ink">{Math.round(weather.temperature_c)}°C</span>
      )}
      {wind && <span>Wind {wind.charAt(0).toLowerCase() + wind.slice(1)}</span>}
      {category && (
        <span
          title={CATEGORY_NAME[category]}
          className={cn("font-mono text-xs font-semibold", TONE_TEXT[CATEGORY_TONE[category]])}
        >
          {category}
        </span>
      )}
    </p>
  );
}
