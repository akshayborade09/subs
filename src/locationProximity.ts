export const MEAL_LOCATION_PROXIMITY_METERS = 200;

export type MapCoordinate = { latitude: number; longitude: number };

export function distanceMeters(a: MapCoordinate, b: MapCoordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinProximity(
  a: MapCoordinate | null | undefined,
  b: MapCoordinate | null | undefined,
  thresholdMeters = MEAL_LOCATION_PROXIMITY_METERS,
): boolean {
  if (!a || !b) return false;
  return distanceMeters(a, b) <= thresholdMeters;
}

export function normalizeLocationText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isSameLocationText(a: string, b: string): boolean {
  const left = normalizeLocationText(a);
  const right = normalizeLocationText(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}
