import { describe, expect, it } from "vitest";

import { timeAgo } from "@/lib/timeAgo";

const FETCHED_AT = "2026-01-01T12:00:00Z";
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The label shown `ageMs` after the data was fetched. */
function labelAtAge(ageMs: number): string {
  return timeAgo(FETCHED_AT, new Date(FETCHED_AT).getTime() + ageMs);
}

describe("timeAgo", () => {
  it.each([
    [0, "just now"],
    [4 * SECOND + 999, "just now"],
    [5 * SECOND, "5s ago"],
    [45 * SECOND, "45s ago"],
    [59 * SECOND + 999, "59s ago"],
  ])("reports seconds under a minute (%i ms -> %s)", (ageMs, expected) => {
    expect(labelAtAge(ageMs)).toBe(expected);
  });

  it.each([
    [MINUTE, "1m ago"],
    [MINUTE + 59 * SECOND, "1m ago"],
    [2 * MINUTE, "2m ago"],
    // a full default cache TTL
    [5 * MINUTE, "5m ago"],
    [59 * MINUTE + 59 * SECOND, "59m ago"],
  ])("reports whole minutes under an hour, rounding down (%i ms -> %s)", (ageMs, expected) => {
    expect(labelAtAge(ageMs)).toBe(expected);
  });

  it.each([
    [HOUR, "1h ago"],
    [HOUR + 59 * SECOND, "1h ago"],
    [HOUR + MINUTE, "1h 1m ago"],
    [HOUR + 59 * MINUTE, "1h 59m ago"],
    [5 * HOUR, "5h ago"],
    [23 * HOUR + 59 * MINUTE + 59 * SECOND, "23h 59m ago"],
  ])("reports hours and minutes under a day (%i ms -> %s)", (ageMs, expected) => {
    expect(labelAtAge(ageMs)).toBe(expected);
  });

  it.each([
    [DAY, "1d ago"],
    [DAY + 23 * HOUR, "1d ago"],
    [3 * DAY + 4 * HOUR, "3d ago"],
  ])("reports whole days from a day up (%i ms -> %s)", (ageMs, expected) => {
    expect(labelAtAge(ageMs)).toBe(expected);
  });

  it("never reports hours-old data in minutes", () => {
    expect(labelAtAge(300 * MINUTE)).toBe("5h ago");
  });

  it("treats a timestamp ahead of the viewer's clock as just now", () => {
    expect(labelAtAge(-30 * SECOND)).toBe("just now");
  });

  it("reads the timestamp's UTC offset", () => {
    const now = new Date("2026-01-01T12:10:00Z").getTime();

    expect(timeAgo("2026-01-01T12:00:00+00:00", now)).toBe("10m ago");
    expect(timeAgo("2026-01-01T13:00:00+01:00", now)).toBe("10m ago");
  });
});
