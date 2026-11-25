/**
 * The airline's two-character IATA designator, read from the front of a flight
 * number: "AA100" -> "AA", "B6616" -> "B6", "U21234" -> "U2". IATA designators
 * are two letters or digits, at least one of them a letter, followed by the
 * flight's 1-4 digit number. Null for anything else, such as a three-letter
 * ICAO-style number ("BAW178"), which has no logo to look up.
 */
export function airlineCode(flightNumber: string): string | null {
  const match = /^([A-Z]{2}|[A-Z]\d|\d[A-Z])(\d{1,4})[A-Z]?$/.exec(flightNumber.trim().toUpperCase());
  return match ? match[1] : null;
}

// Logos come from Travelpayouts' public airline-logo service, loaded by the
// visitor's browser. It serves a wordmark at the requested size and answers
// an unknown code with a non-image body, so the <img> errors and callers
// fall back to a monogram.
const LOGO_WIDTH = 120;
const LOGO_HEIGHT = 40;

export function airlineLogoUrl(code: string): string {
  return `https://pics.avs.io/${LOGO_WIDTH}/${LOGO_HEIGHT}/${encodeURIComponent(code)}.png`;
}
