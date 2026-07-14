import { Vector3 } from 'three';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function normalizeLongitude(longitude: number): number {
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function antipodeOf(point: GeoPoint): GeoPoint {
  return {
    latitude: -point.latitude,
    longitude: normalizeLongitude(point.longitude + 180),
  };
}

export function geoToVector3(point: GeoPoint, radius = 1): Vector3 {
  const latitude = point.latitude * DEG_TO_RAD;
  const longitude = point.longitude * DEG_TO_RAD;
  const cosLatitude = Math.cos(latitude);

  return new Vector3(
    radius * cosLatitude * Math.sin(longitude),
    radius * Math.sin(latitude),
    radius * cosLatitude * Math.cos(longitude),
  );
}

export function vector3ToGeo(vector: Vector3): GeoPoint {
  const normalized = vector.clone().normalize();
  return {
    latitude: Math.asin(normalized.y) * RAD_TO_DEG,
    longitude: normalizeLongitude(
      Math.atan2(normalized.x, normalized.z) * RAD_TO_DEG,
    ),
  };
}
