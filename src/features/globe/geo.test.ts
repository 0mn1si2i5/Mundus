import { describe, expect, it } from 'vitest';
import {
  antipodeOf,
  createAntipodeCrossSection,
  createGraticuleLines,
  createLineSegmentPositions,
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

describe('antipode cartographic cross-section', () => {
  const section = createAntipodeCrossSection(
    geoToVector3({ latitude: 31.2304, longitude: 121.4737 }).normalize(),
  );

  it('anchors short endpoint pieces at each surface', () => {
    expect(section.surfaceSegments).toHaveLength(2);
    for (const [inner, surface] of section.surfaceSegments) {
      expect(inner.length()).toBeCloseTo(0.86, 10);
      expect(surface.length()).toBeCloseTo(1.004, 10);
    }
    expect(
      section.surfaceSegments[0]![1]!.clone()
        .add(section.surfaceSegments[1]![1]!)
        .length(),
    ).toBeCloseTo(0, 10);
  });

  it('keeps every interior dash finite, symmetric, and away from the surface', () => {
    expect(section.interiorSegments.length).toBeGreaterThan(4);
    for (const segment of section.interiorSegments) {
      for (const point of segment) {
        expect(point.toArray().every(Number.isFinite)).toBe(true);
        expect(point.length()).toBeLessThanOrEqual(0.78);
      }
    }

    const samples = section.interiorSegments.flatMap(([start, end]) => [
      start,
      end,
    ]);
    for (const sample of samples) {
      expect(
        samples.some(
          (candidate) => candidate.clone().add(sample).length() < 1e-10,
        ),
      ).toBe(true);
    }
  });

  it('places the center node at the exact globe center', () => {
    expect(section.center.toArray()).toEqual([0, 0, 0]);
  });

  it('packs all interior dashes into one finite line-segment buffer', () => {
    const positions = createLineSegmentPositions(section.interiorSegments);

    expect(positions).toBeInstanceOf(Float32Array);
    expect(positions).toHaveLength(section.interiorSegments.length * 2 * 3);
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
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
