import { afterEach, describe, expect, it, vi } from "vitest";

import { formatFlightTime } from "@/lib/flightTime";

/** Viewer time zones the suite is run under, none of them the airport's. */
const VIEWER_ZONES = ["Asia/Tokyo", "America/Los_Angeles", "Europe/London", "UTC"] as const;

/**
 * Makes `zone` the viewer's time zone, as a browser in that zone would have
 * it, and checks the runtime really switched: every assertion below would
 * be vacuous if it silently stayed on the machine's own zone.
 */
function pinViewerZone(zone: string) {
  vi.stubEnv("TZ", zone);
  expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
}

/** Intl puts a narrow no-break space before AM/PM; compare with plain spaces. */
function plain(text: string | null | undefined) {
  return text?.replace(/\s/g, " ");
}

function clock(value: string, timeZone?: string | null, locale = "en-US") {
  return plain(formatFlightTime(value, timeZone, { locale })?.time);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(VIEWER_ZONES)("formatFlightTime with the viewer in %s", (viewerZone) => {
  it("shows the airport's local time and zone label, not the viewer's", () => {
    pinViewerZone(viewerZone);

    // DL27 leaves Atlanta at 23:50 EST on 12 November 2026.
    expect(clock("2026-11-13T04:50:00Z", "America/New_York")).toBe("11:50 PM EST");
    // ...and reaches Seoul at 05:45 KST on the 14th.
    expect(clock("2026-11-13T20:45:00Z", "Asia/Seoul")).toBe("05:45 AM GMT+9");
  });

  it.each([
    // summer and winter
    ["2026-07-02T02:45:00Z", "10:45 PM EDT"],
    ["2026-12-02T03:45:00Z", "10:45 PM EST"],
    // the evening before clocks go back on 1 November 2026, and the evening after
    ["2026-11-01T02:45:00Z", "10:45 PM EDT"],
    ["2026-11-02T03:45:00Z", "10:45 PM EST"],
    // the evening before clocks go forward on 8 March 2026, and the evening after
    ["2026-03-08T03:45:00Z", "10:45 PM EST"],
    ["2026-03-09T02:45:00Z", "10:45 PM EDT"],
  ])("follows daylight saving at the airport: %s is %s in New York", (instant, expected) => {
    pinViewerZone(viewerZone);

    expect(clock(instant, "America/New_York")).toBe(expected);
  });

  it("tells the two 1:30 AMs of the night clocks go back apart by their label", () => {
    pinViewerZone(viewerZone);

    expect(clock("2026-11-01T05:30:00Z", "America/New_York")).toBe("01:30 AM EDT");
    expect(clock("2026-11-01T06:30:00Z", "America/New_York")).toBe("01:30 AM EST");
  });

  it("formats a fixed UTC offset the same way, labelled with the offset", () => {
    pinViewerZone(viewerZone);

    expect(clock("2026-11-13T04:50:00Z", "-05:00")).toBe("11:50 PM GMT-5");
    expect(clock("2026-11-13T04:50:00Z", "+05:30")).toBe("10:20 AM GMT+5:30");
    expect(clock("2026-11-13T04:50:00Z", "+09:00")).toBe("01:50 PM GMT+9");
    expect(clock("2026-11-13T04:50:00Z", "+00:00")).toBe("04:50 AM GMT");
  });

  it("uses the given locale's clock style and zone names", () => {
    pinViewerZone(viewerZone);

    expect(clock("2026-11-13T04:50:00Z", "America/New_York", "en-GB")).toBe("23:50 GMT-5");
    expect(clock("2026-07-01T18:45:00Z", "Europe/London", "en-GB")).toBe("19:45 BST");
  });

  it("shows the date only when it is not today's date at the airport", () => {
    pinViewerZone(viewerZone);
    // 00:42 on 13 November in Atlanta; 14:42 on the 13th in Seoul
    const now = Date.parse("2026-11-13T05:42:12Z");
    const dateOf = (value: string, timeZone: string) =>
      formatFlightTime(value, timeZone, { locale: "en-US", now })?.date;

    // left at 23:50 last night
    expect(dateOf("2026-11-13T04:50:00Z", "America/New_York")).toBe("Nov 12");
    // leaves at 07:05 this morning
    expect(dateOf("2026-11-13T12:05:00Z", "America/New_York")).toBeNull();
    // the last minute of today, and the first of tomorrow
    expect(dateOf("2026-11-14T04:59:00Z", "America/New_York")).toBeNull();
    expect(dateOf("2026-11-14T05:00:00Z", "America/New_York")).toBe("Nov 14");
    // lands at 05:45 tomorrow in Seoul
    expect(dateOf("2026-11-13T20:45:00Z", "Asia/Seoul")).toBe("Nov 14");
    // the same rule with a fixed offset
    expect(dateOf("2026-11-13T04:50:00Z", "-05:00")).toBe("Nov 12");
    expect(dateOf("2026-11-13T12:05:00Z", "-05:00")).toBeNull();
  });
});

describe("formatFlightTime without a usable zone", () => {
  it.each([[undefined], [null], [""], ["Mars/Olympus_Mons"], ["5 hours behind"]])(
    "falls back to the viewer's own zone, still labelled, for %j",
    (timeZone) => {
      pinViewerZone("Asia/Tokyo");
      expect(clock("2026-11-13T04:50:00Z", timeZone)).toBe("01:50 PM GMT+9");

      pinViewerZone("America/Los_Angeles");
      expect(clock("2026-11-13T04:50:00Z", timeZone)).toBe("08:50 PM PST");
    },
  );

  it("judges the date by the viewer's own day in that case", () => {
    pinViewerZone("Asia/Tokyo");
    // 14:42 on 13 November in Tokyo
    const now = Date.parse("2026-11-13T05:42:12Z");

    expect(formatFlightTime("2026-11-13T04:50:00Z", null, { locale: "en-US", now })?.date).toBeNull();
    expect(formatFlightTime("2026-11-13T20:45:00Z", null, { locale: "en-US", now })?.date).toBe(
      "Nov 14",
    );
  });
});

describe("formatFlightTime with no time to show", () => {
  it.each([[null], [undefined], [""], ["not a time"]])("returns null for %j", (value) => {
    expect(formatFlightTime(value, "America/New_York")).toBeNull();
  });

  it("defaults to the viewer's locale and the current time", () => {
    const label = formatFlightTime(new Date().toISOString(), "America/New_York");

    expect(label?.time).toMatch(/\d{1,2}\D\d{2}/);
    expect(label?.date).toBeNull();
  });
});
