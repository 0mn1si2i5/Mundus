import { describe, expect, it } from 'vitest';
import { FEATURED_CITIES } from './cities';

describe('featured city starts', () => {
  it('keeps only the three curated examples', () => {
    expect(FEATURED_CITIES.map((city) => city.id)).toEqual([
      'shanghai',
      'madrid',
      'honolulu',
    ]);
  });
});
