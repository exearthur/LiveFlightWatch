import type { StatusTone } from "@/lib/flightStatus";
import type { CloudLayer, FlightCategory, Weather } from "@/types/flight";

/** Degrees Celsius to whole degrees Fahrenheit. */
export function toFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

/** Three-digit heading, as pilots say it: 10 -> "010°". */
export function heading(degrees: number): string {
  return `${String(Math.round(degrees) % 360).padStart(3, "0")}°`;
}

/** "From 010° at 10 kt, gusting 18", "Variable at 4 kt", "Calm", or null with no wind data. */
export function describeWind(weather: Pick<Weather, "wind_direction_deg" | "wind_variable" | "wind_speed_kt" | "wind_gust_kt">): string | null {
  const { wind_speed_kt: speed, wind_gust_kt: gust } = weather;
  if (speed === null) return null;
  if (speed === 0) return "Calm";
  const gusting = gust !== null && gust > speed ? `, gusting ${gust}` : "";
  if (weather.wind_variable || weather.wind_direction_deg === null) {
    return `Variable at ${speed} kt${gusting}`;
  }
  return `From ${heading(weather.wind_direction_deg)} at ${speed} kt${gusting}`;
}

const COVER_NAMES: Record<string, string> = {
  FEW: "Few clouds",
  SCT: "Scattered clouds",
  BKN: "Broken clouds",
  OVC: "Overcast",
  OVX: "Sky obscured",
  VV: "Sky obscured",
};

const CLEAR = new Set(["CLR", "SKC", "NSC", "NCD", "CAVOK"]);

/**
 * The lowest cloud layer that matters, in words: "Few clouds at 25,000 ft".
 * The lowest broken or overcast layer (the ceiling) wins over thinner ones
 * below it, since that is what decides whether pilots can see the ground.
 */
export function describeClouds(clouds: CloudLayer[]): string | null {
  if (clouds.length === 0) return null;
  if (clouds.every((layer) => CLEAR.has(layer.cover))) return "Clear";
  const layers = clouds.filter((layer) => !CLEAR.has(layer.cover));
  const ceiling = layers.find((layer) => ["BKN", "OVC", "OVX", "VV"].includes(layer.cover));
  const layer = ceiling ?? layers[0];
  const name = COVER_NAMES[layer.cover] ?? layer.cover;
  return layer.base_ft === null ? name : `${name} at ${layer.base_ft.toLocaleString("en-US")} ft`;
}

/** "10+ mi" or "2.5 mi". */
export function describeVisibility(visibility: string | null): string | null {
  return visibility === null ? null : `${visibility} mi`;
}

/** How each flight-rules category reads on the board. */
export const CATEGORY_TONE: Record<FlightCategory, StatusTone> = {
  VFR: "ok",
  MVFR: "warn",
  IFR: "alert",
  LIFR: "alert",
};

export const CATEGORY_NAME: Record<FlightCategory, string> = {
  VFR: "Visual flight rules",
  MVFR: "Marginal visual flight rules",
  IFR: "Instrument flight rules",
  LIFR: "Low instrument flight rules",
};
