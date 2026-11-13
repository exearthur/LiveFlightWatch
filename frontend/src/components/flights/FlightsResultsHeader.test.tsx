import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlightsResultsHeader } from "@/components/flights/FlightsResultsHeader";

const NOW = new Date("2026-01-01T12:00:00Z");
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** ISO timestamp for data fetched `ageMs` before the (fake) current time. */
function fetchedAgo(ageMs: number): string {
  return new Date(Date.now() - ageMs).toISOString();
}

function renderHeader(props: { fetchedAt: string; cached?: boolean }) {
  const element = (overrides: { fetchedAt: string; cached?: boolean }) => (
    <FlightsResultsHeader
      count={12}
      countLabel="flights"
      fetchedAt={overrides.fetchedAt}
      cached={overrides.cached ?? false}
      isFetching={false}
      onRefresh={() => {}}
    />
  );
  const view = render(element(props));
  return {
    ...view,
    rerenderWith: (next: { fetchedAt: string; cached?: boolean }) => view.rerender(element(next)),
  };
}

/** Lets `ms` of fake time pass, running the header's clock ticks. */
function elapse(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("FlightsResultsHeader — data age", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows freshly fetched data as updated just now", () => {
    renderHeader({ fetchedAt: fetchedAgo(0) });

    expect(screen.getByText(/flights · updated just now$/)).toBeInTheDocument();
  });

  it("shows a cached response's real age instead of the time it was received", () => {
    renderHeader({ fetchedAt: fetchedAgo(4 * MINUTE + 10 * SECOND), cached: true });

    expect(screen.getByText(/updated 4m ago \(cached\)$/)).toBeInTheDocument();
  });

  it("keeps counting between refetches without new props", () => {
    renderHeader({ fetchedAt: fetchedAgo(0) });
    expect(screen.getByText(/updated just now$/)).toBeInTheDocument();

    elapse(5 * SECOND);
    expect(screen.getByText(/updated 5s ago$/)).toBeInTheDocument();

    elapse(40 * SECOND);
    expect(screen.getByText(/updated 45s ago$/)).toBeInTheDocument();

    elapse(15 * SECOND);
    expect(screen.getByText(/updated 1m ago$/)).toBeInTheDocument();

    elapse(4 * MINUTE);
    expect(screen.getByText(/updated 5m ago$/)).toBeInTheDocument();
  });

  it("restarts from the new fetch time when fresher data arrives", () => {
    const { rerenderWith } = renderHeader({ fetchedAt: fetchedAgo(0) });
    elapse(45 * SECOND);
    expect(screen.getByText(/updated 45s ago$/)).toBeInTheDocument();

    rerenderWith({ fetchedAt: fetchedAgo(0) });

    expect(screen.getByText(/updated just now$/)).toBeInTheDocument();
  });

  it("keeps the original age when a refetch returns the same cached data", () => {
    const fetchedAt = fetchedAgo(0);
    const { rerenderWith } = renderHeader({ fetchedAt });
    elapse(45 * SECOND);

    // the poll came back from the backend's cache: same fetch time as before
    rerenderWith({ fetchedAt, cached: true });
    expect(screen.getByText(/updated 45s ago \(cached\)$/)).toBeInTheDocument();

    elapse(45 * SECOND);
    expect(screen.getByText(/updated 1m ago \(cached\)$/)).toBeInTheDocument();
  });

  it("reports data that is hours old in hours, not minutes", () => {
    renderHeader({ fetchedAt: fetchedAgo(5 * HOUR), cached: true });
    expect(screen.getByText(/updated 5h ago \(cached\)$/)).toBeInTheDocument();

    elapse(20 * MINUTE);
    expect(screen.getByText(/updated 5h 20m ago \(cached\)$/)).toBeInTheDocument();
  });

  it("stops its clock when unmounted", () => {
    const { unmount } = renderHeader({ fetchedAt: fetchedAgo(0) });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
