import { describe, expect, it } from 'vitest';
import {
  antipodeOf,
  geoToVector3,
  normalizeLongitude,
  vector3ToGeo,
} from './geo';

describe('geographic coordinates', () => {
  it.each([
    [180, -180],
    [540, -180],
    [-181, 179],
    [121.4737, 121.4737],
  ])('normalizes longitude %s to %s', (input, expected) => {
    expect(normalizeLongitude(input)).toBeCloseTo(expected);
  });

  it('returns to the origin after applying the antipode twice', () => {
    const origin = { latitude: 31.2304, longitude: 121.4737 };
    const restored = antipodeOf(antipodeOf(origin));
    expect(restored.latitude).toBeCloseTo(origin.latitude, 10);
    expect(restored.longitude).toBeCloseTo(origin.longitude, 10);
  });

  it.each([
    { latitude: 0, longitude: 0 },
    { latitude: 31.2304, longitude: 121.4737 },
    { latitude: -33.8688, longitude: 151.2093 },
    { latitude: 90, longitude: 0 },
  ])('round-trips $latitude, $longitude through 3D space', (point) => {
    const actual = vector3ToGeo(geoToVector3(point));
    expect(actual.latitude).toBeCloseTo(point.latitude, 8);
    if (Math.abs(point.latitude) !== 90) {
      expect(actual.longitude).toBeCloseTo(point.longitude, 8);
    }
  });
});
