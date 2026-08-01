import { describe, expect, test } from 'vitest';
import { cssPixelsToWorldUnits } from './screenSpace';

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

  test('returns a finite zero fallback for invalid projection inputs', () => {
    expect(cssPixelsToWorldUnits(8, 3, 40, 0)).toBe(0);
    expect(cssPixelsToWorldUnits(8, Number.NaN, 40, 800)).toBe(0);
    expect(cssPixelsToWorldUnits(8, -1, 40, 800)).toBe(0);
  });
});
