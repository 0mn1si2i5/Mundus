import { describe, expect, test } from 'vitest';
import { allPointsInClip, cssPixelsToWorldUnits } from './screenSpace';

const base = [8, 3, 40, 800] as const;

describe('cssPixelsToWorldUnits', () => {
  test('scales linearly with pixels and distance and inversely with height', () => {
    const value = cssPixelsToWorldUnits(...base);
    expect(cssPixelsToWorldUnits(16, 3, 40, 800)).toBeCloseTo(value * 2);
    expect(cssPixelsToWorldUnits(8, 6, 40, 800)).toBeCloseTo(value * 2);
    expect(cssPixelsToWorldUnits(8, 3, 40, 1600)).toBeCloseTo(value / 2);
  });

  test('grows with vertical field of view', () => {
    expect(cssPixelsToWorldUnits(8, 3, 70, 800)).toBeGreaterThan(
      cssPixelsToWorldUnits(...base),
    );
  });

  test.each([1.55, 3.25, 5])(
    'keeps marker sizing finite and stable at camera distance %s',
    (cameraDistance) => {
      const markerDistance = cameraDistance - 1.021;
      const worldDiameter = cssPixelsToWorldUnits(8, markerDistance, 38, 720);
      const visibleHeight = 2 * markerDistance * Math.tan((38 * Math.PI) / 360);
      const projectedCssDiameter = (worldDiameter / visibleHeight) * 720;

      expect(Number.isFinite(worldDiameter)).toBe(true);
      expect(worldDiameter).toBeGreaterThan(0);
      expect(projectedCssDiameter).toBeCloseTo(8);
    },
  );

  test('returns a finite zero fallback for invalid projection inputs', () => {
    expect(cssPixelsToWorldUnits(8, 3, 40, 0)).toBe(0);
    expect(cssPixelsToWorldUnits(8, Number.NaN, 40, 800)).toBe(0);
    expect(cssPixelsToWorldUnits(8, -1, 40, 800)).toBe(0);
  });
});

describe('allPointsInClip', () => {
  test('requires every sampled point to be inside the clip volume', () => {
    expect(
      allPointsInClip([
        { x: -1, y: 0, z: 0 },
        { x: 0.4, y: 1, z: -1 },
        { x: 1, y: -1, z: 1 },
      ]),
    ).toBe(true);
    expect(
      allPointsInClip([
        { x: 0, y: 0, z: 0 },
        { x: 1.01, y: 0, z: 0 },
      ]),
    ).toBe(false);
    expect(allPointsInClip([])).toBe(false);
  });
});
