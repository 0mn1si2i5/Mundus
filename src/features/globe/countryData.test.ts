import { describe, expect, it } from 'vitest';
import {
  getBoundedTextureAnisotropy,
  getCountryDataset,
  getCountryHighlightTextureWidth,
  getCountryTextureStyle,
} from './countryData';

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

describe('country texture rendering', () => {
  it('keeps every profile border at least one source pixel wide', () => {
    expect(getCountryTextureStyle(1024).borderWidth).toBeGreaterThanOrEqual(1);
    expect(getCountryTextureStyle(2048).borderWidth).toBeGreaterThanOrEqual(1);
  });

  it('uses restrained but readable museum surface colors', () => {
    expect(getCountryTextureStyle(2048)).toMatchObject({
      oceanColor: '#142a30',
      landColor: '#304944',
      borderColor: 'rgba(196, 218, 204, 0.46)',
    });
  });

  it('bounds texture anisotropy by renderer capability and exhibit budget', () => {
    expect(getBoundedTextureAnisotropy(1)).toBe(1);
    expect(getBoundedTextureAnisotropy(4)).toBe(4);
    expect(getBoundedTextureAnisotropy(16)).toBe(8);
  });

  it('bounds the reusable highlight overlay below detailed base textures', () => {
    expect(getCountryHighlightTextureWidth(1024)).toBe(1024);
    expect(getCountryHighlightTextureWidth(2048)).toBe(1024);
  });
});
