import type { GeoPoint } from '../globe/geo';

export const EARTH_MEAN_RADIUS_KM = 6371.0088;

export function surfaceDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const latitudeDelta = latitudeB - latitudeA;
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 * EARTH_MEAN_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)))
  );
}

export function chordDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const centralAngle = surfaceDistanceKm(a, b) / EARTH_MEAN_RADIUS_KM;
  return 2 * EARTH_MEAN_RADIUS_KM * Math.sin(centralAngle / 2);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
