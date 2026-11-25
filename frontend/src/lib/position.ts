/** [longitude, latitude], the order map libraries use. */
export type LngLat = [number, number];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Points along the great circle from `from` to `to`, the shortest path over
 * the globe and roughly the route an airliner flies. It bows towards the pole
 * on a flat map, which is why long routes look curved.
 */
export function greatCircle(from: LngLat, to: LngLat, segments = 64): LngLat[] {
  const [lon1, lat1] = [toRadians(from[0]), toRadians(from[1])];
  const [lon2, lat2] = [toRadians(to[0]), toRadians(to[1])];
  const distance =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (distance === 0) return [from, to];

  const points: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const a = Math.sin((1 - f) * distance) / Math.sin(distance);
    const b = Math.sin(f * distance) / Math.sin(distance);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    points.push([toDegrees(Math.atan2(y, x)), toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  // Keep longitudes continuous across the antimeridian, so a Pacific route
  // isn't drawn the long way round the map.
  for (let i = 1; i < points.length; i++) {
    const jump = points[i][0] - points[i - 1][0];
    if (jump > 180) points[i][0] -= 360;
    else if (jump < -180) points[i][0] += 360;
  }
  return points;
}

/** "19,125 ft", or "On the ground". */
export function formatAltitude(altitudeFt: number | null, onGround: boolean): string {
  if (onGround) return "On the ground";
  return altitudeFt === null ? "—" : `${altitudeFt.toLocaleString("en-US")} ft`;
}

/** "422 kt (781 km/h)". */
export function formatSpeed(knots: number | null): string {
  return knots === null ? "—" : `${knots} kt (${Math.round(knots * 1.852)} km/h)`;
}
