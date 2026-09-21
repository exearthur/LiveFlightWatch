import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useNearestAirport } from "@/hooks/useNearestAirport";

function mockGeolocation(
  impl: (
    onSuccess: PositionCallback,
    onError?: PositionErrorCallback,
  ) => void,
) {
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition: vi.fn(impl) },
    configurable: true,
  });
}

function position(lat: number, lon: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lon,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return this;
      },
    },
    timestamp: Date.now(),
    toJSON() {
      return this;
    },
  };
}

function permissionDeniedError(): GeolocationPositionError {
  return {
    code: 1,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
    message: "User denied geolocation",
  };
}

describe("useNearestAirport", () => {
  afterEach(() => {
    // @ts-expect-error -- cleaning up the mocked property between tests
    delete navigator.geolocation;
    vi.restoreAllMocks();
  });

  it("stays idle when disabled", () => {
    const { result } = renderHook(() => useNearestAirport({ enabled: false }));

    expect(result.current.status).toBe("idle");
    expect(result.current.airport).toBeNull();
  });

  it("reports 'unsupported' when the browser has no geolocation API", async () => {
    // @ts-expect-error -- simulating an environment without geolocation
    delete navigator.geolocation;

    const { result } = renderHook(() => useNearestAirport({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("unsupported"));
  });

  it("finds the nearest supported airport when permission is granted", async () => {
    // Just outside New York City -> nearest supported airport is JFK.
    mockGeolocation((onSuccess) => onSuccess(position(40.7, -73.9)));

    const { result } = renderHook(() => useNearestAirport({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("found"));
    expect(result.current.airport?.iata).toBe("JFK");
    expect(result.current.distanceKm).not.toBeNull();
  });

  it("reports 'denied' when the user rejects the permission prompt", async () => {
    mockGeolocation((_onSuccess, onError) => onError?.(permissionDeniedError()));

    const { result } = renderHook(() => useNearestAirport({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("denied"));
    expect(result.current.airport).toBeNull();
  });

  it("reports 'out-of-range' when no supported airport is reasonably nearby", async () => {
    // The middle of the Pacific Ocean, far from every supported airport.
    mockGeolocation((onSuccess) => onSuccess(position(0, -160)));

    const { result } = renderHook(() => useNearestAirport({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("out-of-range"));
    expect(result.current.airport).toBeNull();
  });

  it("does not call geolocation at all when disabled", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    renderHook(() => useNearestAirport({ enabled: false }));

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("re-runs the lookup when locate() is called manually", async () => {
    const getCurrentPosition = vi.fn((onSuccess: PositionCallback) =>
      onSuccess(position(40.7, -73.9)),
    );
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    const { result } = renderHook(() => useNearestAirport({ enabled: false }));

    expect(getCurrentPosition).not.toHaveBeenCalled();

    result.current.locate();

    await waitFor(() => expect(result.current.status).toBe("found"));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("resolves locate()'s own promise with the outcome even when the result is identical to before", async () => {
    // Regression: calling locate() twice in a row with the same coordinates
    // must still let a caller react to the second call directly, since
    // status/airport not changing means no re-render to react to.
    mockGeolocation((onSuccess) => onSuccess(position(40.7, -73.9)));

    const { result } = renderHook(() => useNearestAirport({ enabled: false }));

    const first = await result.current.locate();
    expect(first).toEqual({ status: "found", airport: expect.objectContaining({ iata: "JFK" }), distanceKm: expect.any(Number) });

    const second = await result.current.locate();
    expect(second).toEqual({ status: "found", airport: expect.objectContaining({ iata: "JFK" }), distanceKm: expect.any(Number) });
  });
});
