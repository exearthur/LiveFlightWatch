import { describe, expect, it } from "vitest";

import { formatAltitude, formatSpeed, greatCircle, type LngLat } from "@/lib/position";

const JFK: LngLat = [-73.7793, 40.6394];
const LHR: LngLat = [-0.4614, 51.4775];
const NRT: LngLat = [140.3864, 35.7647];
const LAX: LngLat = [-118.4085, 33.9416];

describe("greatCircle", () => {
  it("starts and ends at the two airports", () => {
    const points = greatCircle(JFK, LHR, 32);
    expect(points).toHaveLength(33);
    expect(points[0][0]).toBeCloseTo(JFK[0], 4);
    expect(points[0][1]).toBeCloseTo(JFK[1], 4);
    expect(points[32][0]).toBeCloseTo(LHR[0], 4);
    expect(points[32][1]).toBeCloseTo(LHR[1], 4);
  });

  it("bows towards the pole, north of both ends on a transatlantic route", () => {
    const middle = greatCircle(JFK, LHR, 32)[16];
    expect(middle[1]).toBeGreaterThan(LHR[1]);
  });

  it("crosses the Pacific the short way, without jumping across the map", () => {
    const points = greatCircle(LAX, NRT, 64);
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i][0] - points[i - 1][0])).toBeLessThan(10);
    }
    // Westwards from LA, past -180 rather than back through 0.
    expect(points[64][0]).toBeCloseTo(NRT[0] - 360, 4);
  });

  it("handles the same point at both ends", () => {
    expect(greatCircle(JFK, JFK)).toEqual([JFK, JFK]);
  });
});

describe("formatters", () => {
  it("formats altitude and speed", () => {
    expect(formatAltitude(19125, false)).toBe("19,125 ft");
    expect(formatAltitude(null, true)).toBe("On the ground");
    expect(formatAltitude(null, false)).toBe("—");
    expect(formatSpeed(422)).toBe("422 kt (782 km/h)");
    expect(formatSpeed(null)).toBe("—");
  });
});
