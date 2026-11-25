import { describe, expect, it } from "vitest";

import { delayMinutes } from "@/lib/flightStatus";

const scheduled = "2026-11-24T14:05:00Z";

describe("delayMinutes", () => {
  it("measures the estimate against the schedule", () => {
    expect(
      delayMinutes({ scheduled_time: scheduled, estimated_time: "2026-11-24T14:30:00Z", actual_time: null }),
    ).toBe(25);
  });

  it("prefers the actual time over the estimate", () => {
    expect(
      delayMinutes({
        scheduled_time: scheduled,
        estimated_time: "2026-11-24T14:30:00Z",
        actual_time: "2026-11-24T14:42:00Z",
      }),
    ).toBe(37);
  });

  it("is negative for an early flight", () => {
    expect(
      delayMinutes({ scheduled_time: scheduled, estimated_time: "2026-11-24T13:58:00Z", actual_time: null }),
    ).toBe(-7);
  });

  it("is null without a schedule or anything to compare it with", () => {
    expect(delayMinutes({ scheduled_time: null, estimated_time: scheduled, actual_time: null })).toBeNull();
    expect(delayMinutes({ scheduled_time: scheduled, estimated_time: null, actual_time: null })).toBeNull();
    expect(
      delayMinutes({ scheduled_time: "not a time", estimated_time: scheduled, actual_time: null }),
    ).toBeNull();
  });
});
