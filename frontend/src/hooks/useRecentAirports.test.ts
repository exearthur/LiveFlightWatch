import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRecentAirports } from "@/hooks/useRecentAirports";

const STORAGE_KEY = "lfw:recent-airports";

describe("useRecentAirports", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("starts empty when localStorage has nothing stored", () => {
    const { result } = renderHook(() => useRecentAirports());

    expect(result.current.recentAirports).toEqual([]);
  });

  it("hydrates its initial state from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["JFK", "LAX"]));

    const { result } = renderHook(() => useRecentAirports());

    expect(result.current.recentAirports).toEqual(["JFK", "LAX"]);
  });

  it("adds a normalized (trimmed, uppercased) airport code to the front", () => {
    const { result } = renderHook(() => useRecentAirports());

    act(() => result.current.addRecentAirport("  jfk  "));

    expect(result.current.recentAirports).toEqual(["JFK"]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(["JFK"]);
  });

  it("ignores blank input", () => {
    const { result } = renderHook(() => useRecentAirports());

    act(() => result.current.addRecentAirport("   "));

    expect(result.current.recentAirports).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("moves an already-recent airport to the front instead of duplicating it", () => {
    const { result } = renderHook(() => useRecentAirports());

    act(() => result.current.addRecentAirport("JFK"));
    act(() => result.current.addRecentAirport("LAX"));
    act(() => result.current.addRecentAirport("JFK"));

    expect(result.current.recentAirports).toEqual(["JFK", "LAX"]);
  });

  it("caps the list at 5 most-recently-used airports", () => {
    const { result } = renderHook(() => useRecentAirports());

    act(() => result.current.addRecentAirport("AAA"));
    act(() => result.current.addRecentAirport("BBB"));
    act(() => result.current.addRecentAirport("CCC"));
    act(() => result.current.addRecentAirport("DDD"));
    act(() => result.current.addRecentAirport("EEE"));
    act(() => result.current.addRecentAirport("FFF"));

    expect(result.current.recentAirports).toEqual(["FFF", "EEE", "DDD", "CCC", "BBB"]);
    expect(result.current.recentAirports).toHaveLength(5);
  });

  it("falls back to an empty list when the stored value is invalid JSON", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("{not-json");

    const { result } = renderHook(() => useRecentAirports());

    expect(result.current.recentAirports).toEqual([]);
  });

  it("falls back to an empty list when the stored value is not an array", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(JSON.stringify({ foo: "bar" }));

    const { result } = renderHook(() => useRecentAirports());

    expect(result.current.recentAirports).toEqual([]);
  });

  it("filters out non-string entries from a malformed stored array", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(JSON.stringify(["JFK", 42, null, "LAX"]));

    const { result } = renderHook(() => useRecentAirports());

    expect(result.current.recentAirports).toEqual(["JFK", "LAX"]);
  });

  it("does not throw when localStorage.setItem fails (e.g. private browsing / quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() => useRecentAirports());

    expect(() => act(() => result.current.addRecentAirport("JFK"))).not.toThrow();
    // In-memory state still updates even though persistence failed.
    expect(result.current.recentAirports).toEqual(["JFK"]);
  });
});
