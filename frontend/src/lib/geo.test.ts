import { describe, expect, it } from "vitest";

import { findNearestAirport, haversineDistanceKm } from "@/lib/geo";

describe("haversineDistanceKm", () => {
  it("returns 0 for identical coordinates", () => {
    const point = { lat: 40.6413, lon: -73.7781 };
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 5);
  });

  it("returns the approximate great-circle distance between two known airports", () => {
    // JFK -> LAX is roughly 3,975 km.
    const jfk = { lat: 40.6413, lon: -73.7781 };
    const lax = { lat: 33.9416, lon: -118.4085 };

    expect(haversineDistanceKm(jfk, lax)).toBeGreaterThan(3900);
    expect(haversineDistanceKm(jfk, lax)).toBeLessThan(4050);
  });
});

describe("findNearestAirport", () => {
  const airports = [
    { code: "JFK", lat: 40.6413, lon: -73.7781 },
    { code: "LAX", lat: 33.9416, lon: -118.4085 },
    { code: "LHR", lat: 51.47, lon: -0.4543 },
  ];

  it("returns the closest airport with its distance", () => {
    const result = findNearestAirport({ lat: 40.7, lon: -74.0 }, airports);

    expect(result?.airport.code).toBe("JFK");
    expect(result?.distanceKm).toBeGreaterThan(0);
    expect(result?.distanceKm).toBeLessThan(50);
  });

  it("returns null when the closest airport is farther than maxDistanceKm", () => {
    // Somewhere in the middle of the Pacific, far from everything above.
    const result = findNearestAirport({ lat: 0, lon: -160 }, airports, 300);

    expect(result).toBeNull();
  });

  it("returns null for an empty airport list", () => {
    expect(findNearestAirport({ lat: 0, lon: 0 }, [])).toBeNull();
  });
});
