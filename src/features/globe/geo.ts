import { Vector3 } from 'three';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GraticuleLine {
  kind: 'latitude' | 'longitude';
  coordinate: number;
  points: Vector3[];
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

export function createGraticuleLines(radius = 1.006): GraticuleLine[] {
  const latitudes = [-60, -30, 0, 30, 60];
  const longitudes = Array.from({ length: 12 }, (_, index) => index * 30 - 180);

  return [
    ...latitudes.map((latitude) => {
      const points = Array.from({ length: 72 }, (_, index) =>
        geoToVector3({ latitude, longitude: index * 5 - 180 }, radius),
      );
      points.push(points[0]!.clone());
      return { kind: 'latitude' as const, coordinate: latitude, points };
    }),
    ...longitudes.map((longitude) => ({
      kind: 'longitude' as const,
      coordinate: longitude,
      points: Array.from({ length: 37 }, (_, index) =>
        geoToVector3({ latitude: index * 5 - 90, longitude }, radius),
      ),
    })),
  ];
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
