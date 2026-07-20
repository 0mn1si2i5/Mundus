import { describe, expect, it } from 'vitest';
import {
  antipodeOf,
  createGraticuleLines,
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

describe('geographic graticule', () => {
  const lines = createGraticuleLines();

  it('uses the exact sparse latitude and longitude coordinate sets', () => {
    expect(
      lines
        .filter((line) => line.kind === 'latitude')
        .map((line) => line.coordinate),
    ).toEqual([-60, -30, 0, 30, 60]);
    expect(
      lines
        .filter((line) => line.kind === 'longitude')
        .map((line) => line.coordinate),
    ).toEqual([-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]);
  });

  it('closes latitude rings at the antimeridian', () => {
    const equator = lines.find(
      (line) => line.kind === 'latitude' && line.coordinate === 0,
    );

    expect(equator?.points).toHaveLength(73);
    expect(equator?.points[0]).toEqual(equator?.points.at(-1));
    expect(vector3ToGeo(equator!.points[0]!)).toMatchObject({
      latitude: 0,
      longitude: -180,
    });
  });

  it('runs representative longitude lines from pole to pole', () => {
    const primeMeridian = lines.find(
      (line) => line.kind === 'longitude' && line.coordinate === 0,
    );

    expect(primeMeridian?.points).toHaveLength(37);
    expect(primeMeridian?.points[0]!.y).toBeCloseTo(-1.006, 10);
    expect(primeMeridian?.points.at(-1)?.y).toBeCloseTo(1.006, 10);
    expect(vector3ToGeo(primeMeridian!.points[18]!)).toMatchObject({
      latitude: 0,
      longitude: 0,
    });
  });

  it('places all references above the globe surface', () => {
    expect(
      lines.every((line) =>
        line.points.every((point) => Math.abs(point.length() - 1.006) < 1e-10),
      ),
    ).toBe(true);
  });
});
