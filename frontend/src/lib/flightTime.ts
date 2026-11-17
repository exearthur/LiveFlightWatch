/** A flight time as shown on a board. */
export interface FlightTimeLabel {
  /** The clock time with its zone label, e.g. "10:45 PM EST". */
  time: string;
  /** The date, e.g. "Nov 13", when it is not today's date in that zone; otherwise null. */
  date: string | null;
}

export interface FlightTimeOptions {
  /** BCP 47 locale for the clock style and zone names. Defaults to the viewer's. */
  locale?: string;
  /** The current time (epoch ms), which decides whether the date is shown. Defaults to now. */
  now?: number;
}

interface ZoneFormatters {
  time: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  /** Sortable calendar date (YYYY-MM-DD), for telling two days apart. */
  day: Intl.DateTimeFormat;
}

/** How to render in one zone: the formatters, and for a fixed offset the shift and label that go with them. */
interface ZoneDisplay {
  formatters: ZoneFormatters;
  shiftMs: number;
  label: string | null;
}

// The backend sends "+HH:MM" / "-HH:MM" when a provider gives an airport's
// UTC offset but not its zone name.
const FIXED_OFFSET = /^([+-])(\d{2}):(\d{2})$/;

const namedZoneFormatters = new Map<string, ZoneFormatters>();

/** Throws a RangeError when the runtime does not know `timeZone`. */
function buildFormatters(
  locale: string | undefined,
  timeZone: string | undefined,
  withZoneName: boolean,
): ZoneFormatters {
  return {
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      timeZoneName: withZoneName ? "short" : undefined,
    }),
    date: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone }),
    day: new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }),
  };
}

function cachedFormatters(
  locale: string | undefined,
  timeZone: string,
  withZoneName: boolean,
): ZoneFormatters {
  const key = `${locale ?? ""}|${timeZone}|${withZoneName}`;
  let formatters = namedZoneFormatters.get(key);
  if (!formatters) {
    formatters = buildFormatters(locale, timeZone, withZoneName);
    namedZoneFormatters.set(key, formatters);
  }
  return formatters;
}

function fixedOffsetLabel(sign: string, hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return "GMT";
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

function resolveZone(timeZone: string | null | undefined, locale: string | undefined): ZoneDisplay {
  const offset = timeZone ? FIXED_OFFSET.exec(timeZone) : null;
  if (offset) {
    // Done by hand rather than handing the offset to Intl, which only newer
    // browsers accept as a time zone: shift the instant, then format it as UTC.
    const [, sign, hh, mm] = offset;
    const hours = Number(hh);
    const minutes = Number(mm);
    return {
      formatters: cachedFormatters(locale, "UTC", false),
      shiftMs: (sign === "-" ? -1 : 1) * (hours * 60 + minutes) * 60_000,
      label: fixedOffsetLabel(sign, hours, minutes),
    };
  }

  if (timeZone) {
    try {
      return { formatters: cachedFormatters(locale, timeZone, true), shiftMs: 0, label: null };
    } catch {
      // Not a zone this browser knows: fall through to the viewer's own.
    }
  }

  // No usable zone (an unknown airport, or a response from before the API
  // sent one). The viewer's own zone, labelled as such, is the best left.
  // Built fresh each time because the viewer's zone is not fixed for the
  // life of the page.
  return { formatters: buildFormatters(locale, undefined, true), shiftMs: 0, label: null };
}

/**
 * Formats a flight's time (an ISO instant from the API) in `timeZone`, the
 * zone of the airport it belongs to, whatever zone the viewer is in.
 *
 * `timeZone` is the flight's `timezone` field: an IANA name, a fixed offset
 * such as "-05:00", or nothing. With nothing, or a name the browser does not
 * know, the time is shown in the viewer's own zone. In every case the result
 * carries a zone label, so the reader can tell which it is.
 *
 * Returns null for a missing or unparseable time.
 */
export function formatFlightTime(
  value: string | null | undefined,
  timeZone?: string | null,
  { locale, now = Date.now() }: FlightTimeOptions = {},
): FlightTimeLabel | null {
  if (!value) return null;
  const instant = new Date(value).getTime();
  if (Number.isNaN(instant)) return null;

  const { formatters, shiftMs, label } = resolveZone(timeZone, locale);
  const shown = new Date(instant + shiftMs);
  const clock = formatters.time.format(shown);

  return {
    time: label ? `${clock} ${label}` : clock,
    date:
      formatters.day.format(shown) === formatters.day.format(new Date(now + shiftMs))
        ? null
        : formatters.date.format(shown),
  };
}
