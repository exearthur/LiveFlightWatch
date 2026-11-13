const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Short "how long ago" label for an ISO timestamp, as of `now` (epoch ms).
 *
 * Every unit rounds down, so the label never claims data is older than it
 * is, and each range switches to a coarser unit before its number gets hard
 * to read: seconds up to a minute, minutes up to an hour, hours and minutes
 * up to a day, then whole days. A timestamp in the future (the viewer's
 * clock running behind the server's) counts as "just now".
 */
export function timeAgo(iso: string, now: number): string {
  const age = Math.max(0, now - new Date(iso).getTime());

  if (age < 5 * SECOND) return "just now";
  if (age < MINUTE) return `${Math.floor(age / SECOND)}s ago`;
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m ago`;
  if (age < DAY) {
    const hours = Math.floor(age / HOUR);
    const minutes = Math.floor((age % HOUR) / MINUTE);
    return minutes === 0 ? `${hours}h ago` : `${hours}h ${minutes}m ago`;
  }
  return `${Math.floor(age / DAY)}d ago`;
}
