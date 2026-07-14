import { describe, expect, it } from 'vitest';
import { calculateFrameStats } from './frameStats';

describe('frame statistics', () => {
  it('calculates FPS and frame-time percentiles', () => {
    const stats = calculateFrameStats([0, 16, 32, 48, 80]);
    expect(stats?.frameCount).toBe(5);
    expect(stats?.fps).toBe(50);
    expect(stats?.frameTimeP50Ms).toBe(16);
    expect(stats?.frameTimeP95Ms).toBe(32);
    expect(stats?.slowFramePercent).toBe(25);
  });

  it('requires at least two increasing timestamps', () => {
    expect(calculateFrameStats([])).toBeNull();
    expect(calculateFrameStats([10])).toBeNull();
    expect(calculateFrameStats([10, 10])).toBeNull();
  });
});
