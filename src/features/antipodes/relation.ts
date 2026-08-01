import { antipodeOf, type GeoPoint } from '../globe/geo';
import {
  findNearestMajorCity,
  type GeoNamesCity,
  type NearestMajorCity,
} from './geonamesCities';

export type AntipodeSideId = 'origin' | 'antipode';

export interface AntipodeRelationSide {
  id: AntipodeSideId;
  exactPoint: GeoPoint;
  nearestMajorCity: NearestMajorCity | null;
}

export interface AntipodeRelation {
  origin: AntipodeRelationSide;
  antipode: AntipodeRelationSide;
}

export function createAntipodeRelation(
  origin: GeoPoint,
  cities?: readonly GeoNamesCity[],
): AntipodeRelation {
  const exactOrigin = { ...origin };
  const exactAntipode = antipodeOf(exactOrigin);
  return {
    origin: {
      id: 'origin',
      exactPoint: exactOrigin,
      nearestMajorCity: cities
        ? findNearestMajorCity(exactOrigin, cities)
        : null,
    },
    antipode: {
      id: 'antipode',
      exactPoint: exactAntipode,
      nearestMajorCity: cities
        ? findNearestMajorCity(exactAntipode, cities)
        : null,
    },
  };
}

export function sampleShortGeodesic(
  start: GeoPoint,
  end: GeoPoint,
  segmentCount = 16,
): GeoPoint[] {
  const count = Math.max(1, Math.floor(segmentCount));
  const startVector = toUnitVector(start);
  const endVector = toUnitVector(end);
  const dot = clamp(dotProduct(startVector, endVector), -1, 1);
  if (dot < -1 + 1e-10) return [];
  if (dot > 1 - 1e-12) {
    return Array.from({ length: count + 1 }, () => ({ ...start }));
  }
  const angle = Math.acos(dot);
  const divisor = Math.sin(angle);
  return Array.from({ length: count + 1 }, (_, index) => {
    if (index === 0) return { ...start };
    if (index === count) return { ...end };
    const fraction = index / count;
    const startWeight = Math.sin((1 - fraction) * angle) / divisor;
    const endWeight = Math.sin(fraction * angle) / divisor;
    return fromUnitVector({
      x: startVector.x * startWeight + endVector.x * endWeight,
      y: startVector.y * startWeight + endVector.y * endWeight,
      z: startVector.z * startWeight + endVector.z * endWeight,
    });
  });
}

interface UnitVector {
  x: number;
  y: number;
  z: number;
}

function toUnitVector(point: GeoPoint): UnitVector {
  const latitude = (point.latitude * Math.PI) / 180;
  const longitude = (point.longitude * Math.PI) / 180;
  const latitudeRadius = Math.cos(latitude);
  return {
    x: latitudeRadius * Math.cos(longitude),
    y: Math.sin(latitude),
    z: latitudeRadius * Math.sin(longitude),
  };
}

function fromUnitVector(vector: UnitVector): GeoPoint {
  const longitude = (Math.atan2(vector.z, vector.x) * 180) / Math.PI;
  return {
    latitude:
      (Math.atan2(vector.y, Math.hypot(vector.x, vector.z)) * 180) / Math.PI,
    longitude: longitude === -180 ? 180 : longitude,
  };
}

function dotProduct(left: UnitVector, right: UnitVector): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
