import { describe, expect, it } from 'vitest';
import { antipodeOf } from '../globe/geo';
import {
  chordDistanceKm,
  EARTH_MEAN_RADIUS_KM,
  surfaceDistanceKm,
} from './distance';

describe('antipodal distances', () => {
  const point = { latitude: 31.2304, longitude: 121.4737 };
  const antipode = antipodeOf(point);

  it('uses half the circumference along the surface', () => {
    expect(surfaceDistanceKm(point, antipode)).toBeCloseTo(
      Math.PI * EARTH_MEAN_RADIUS_KM,
      6,
    );
  });

  it('uses Earth diameter through the core', () => {
    expect(chordDistanceKm(point, antipode)).toBeCloseTo(
      2 * EARTH_MEAN_RADIUS_KM,
      6,
    );
  });
});
