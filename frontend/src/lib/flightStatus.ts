import type { FlightStatus } from "@/types/flight";

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
