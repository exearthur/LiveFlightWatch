export interface Coordinates {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

export interface NearestMatch<T> {
  airport: T;
  distanceKm: number;
}

/**
 * Finds the closest airport to `from`, or null if the list is empty or the
 * closest one is still farther than `maxDistanceKm` away (i.e. nothing is
 * "reasonably nearby").
 */
export function findNearestAirport<T extends Coordinates>(
  from: Coordinates,
  airports: readonly T[],
  maxDistanceKm = Infinity,
): NearestMatch<T> | null {
  let nearest: NearestMatch<T> | null = null;

  for (const airport of airports) {
    const distanceKm = haversineDistanceKm(from, airport);
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { airport, distanceKm };
    }
  }

  if (!nearest || nearest.distanceKm > maxDistanceKm) return null;
  return nearest;
}
