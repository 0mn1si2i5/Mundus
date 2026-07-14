import { describe, expect, it } from 'vitest';
import { searchCities } from './cities';

describe('local city search', () => {
  it('searches across both languages and diacritics', () => {
    expect(searchCities('上海', 'zh')[0]?.id).toBe('shanghai');
    expect(searchCities('reykjavik', 'en')[0]?.id).toBe('reykjavik');
    expect(searchCities('argentina', 'en')[0]?.id).toBe('buenos-aires');
  });

  it('does not return the full index for an empty query', () => {
    expect(searchCities('   ', 'zh')).toEqual([]);
  });
});
