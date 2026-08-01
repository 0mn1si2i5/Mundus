import { Vector3 } from 'three';
import { normalizeLongitude, type GeoPoint } from '../antipodes/geography';

export { antipodeOf, normalizeLongitude } from '../antipodes/geography';
export type { GeoPoint } from '../antipodes/geography';

export interface GraticuleLine {
  kind: 'latitude' | 'longitude';
  coordinate: number;
  points: Vector3[];
}

export interface AntipodeCrossSection {
  surfaceSegments: [[Vector3, Vector3], [Vector3, Vector3]];
  interiorSegments: [Vector3, Vector3][];
  center: Vector3;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

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

export function createAntipodeCrossSection(
  originDirection: Vector3,
): AntipodeCrossSection {
  const direction = originDirection.clone().normalize();
  const at = (distance: number) => direction.clone().multiplyScalar(distance);
  const interiorSegments: [Vector3, Vector3][] = [];
  const dashLength = 0.12;
  const gapLength = 0.08;

  for (let start = 0.08; start < 0.78; start += dashLength + gapLength) {
    const end = Math.min(start + dashLength, 0.78);
    interiorSegments.push([at(start), at(end)], [at(-end), at(-start)]);
  }

  return {
    surfaceSegments: [
      [at(0.86), at(1.004)],
      [at(-0.86), at(-1.004)],
    ],
    interiorSegments,
    center: new Vector3(0, 0, 0),
  };
}

export function createLineSegmentPositions(
  segments: readonly (readonly [Vector3, Vector3])[],
): Float32Array {
  const positions = new Float32Array(segments.length * 6);
  let offset = 0;
  for (const [start, end] of segments) {
    positions[offset++] = start.x;
    positions[offset++] = start.y;
    positions[offset++] = start.z;
    positions[offset++] = end.x;
    positions[offset++] = end.y;
    positions[offset++] = end.z;
  }
  return positions;
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
