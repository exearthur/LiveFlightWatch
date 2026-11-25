import type { Flight, FlightStatus } from "@/types/flight";

/**
 * How late the flight is against its schedule, in whole minutes: the actual
 * time when there is one, otherwise the estimate. Negative when early, null
 * when there is no schedule or nothing to compare it with.
 */
export function delayMinutes(flight: Pick<Flight, "scheduled_time" | "estimated_time" | "actual_time">): number | null {
  const reference = flight.actual_time ?? flight.estimated_time;
  if (!flight.scheduled_time || !reference) return null;
  const scheduled = Date.parse(flight.scheduled_time);
  const other = Date.parse(reference);
  if (Number.isNaN(scheduled) || Number.isNaN(other)) return null;
  return Math.round((other - scheduled) / 60_000);
}

/**
 * What a status means to someone reading the board, which decides its colour:
 * `ok` for a flight that is moving or done, `warn` for a delay, `alert` for a
 * flight that won't arrive where planned, `neutral` otherwise.
 */
export type StatusTone = "ok" | "warn" | "alert" | "neutral";

export const STATUS_TONE: Record<FlightStatus, StatusTone> = {
  scheduled: "neutral",
  active: "ok",
  landed: "ok",
  delayed: "warn",
  cancelled: "alert",
  diverted: "alert",
  unknown: "neutral",
};
