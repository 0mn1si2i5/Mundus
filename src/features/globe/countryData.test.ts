import { describe, expect, it } from 'vitest';
import { getCountryDataset } from './countryData';

describe('country dataset', () => {
  const dataset = getCountryDataset();

  it('builds stable unique internal ids', () => {
    const ids = dataset.countries.features.map(
      (country) => country.properties.countryId,
    );
    expect(dataset.countries.features.length).toBeGreaterThan(170);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('ne-'))).toBe(true);
    expect(ids).toContain('ne-x-kosovo');
  });

  it('resolves representative land points and preserves ocean as null', () => {
    expect(
      dataset.findCountry({ latitude: 31.2304, longitude: 121.4737 })?.name,
    ).toBe('China');
    expect(
      dataset.findCountry({ latitude: 40.7128, longitude: -74.006 })?.name,
    ).toBe('United States of America');
    expect(dataset.findCountry({ latitude: 0, longitude: -140 })).toBeNull();
  });
});
