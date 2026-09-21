import { describe, expect, it } from 'vitest';
import { geoContains } from 'd3-geo';
import surnameDataset from '../../data/generated/surnames-by-country.json';
import {
  getBoundedTextureAnisotropy,
  getCountryDataset,
  getCountryHighlightTextureWidth,
  getCountryTextureStyle,
} from './countryData';
import {
  getCountryLabelAnchor,
  getFallbackCountryLabelAnchor,
} from './countryLabel';

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

  it('keeps surname label anchors inside their country geometry', () => {
    for (const [countryId, surnameCountry] of Object.entries(
      surnameDataset.countries,
    )) {
      const country = dataset.countries.features.find(
        (candidate) => candidate.properties.countryId === countryId,
      );
      if (!country) {
        expect(
          getFallbackCountryLabelAnchor(countryId),
          countryId,
        ).not.toBeNull();
        continue;
      }
      const anchor = getCountryLabelAnchor(country!);
      const firstRecord = surnameCountry.records[0];
      if (!firstRecord) continue;
      expect(anchor, countryId).not.toBeNull();
      expect(
        geoContains(country!, [
          anchor!.point.longitude,
          anchor!.point.latitude,
        ]),
        countryId,
      ).toBe(true);
      expect(anchor!.clearanceDegrees, countryId).toBeGreaterThan(0);
    }
  });

  it('keeps verified small-country label fallbacks finite', () => {
    for (const countryId of ['ne-234', 'ne-470']) {
      const anchor = getFallbackCountryLabelAnchor(countryId);
      expect(anchor, countryId).not.toBeNull();
      expect(Number.isFinite(anchor!.point.latitude)).toBe(true);
      expect(Number.isFinite(anchor!.point.longitude)).toBe(true);
      expect(anchor!.clearanceDegrees).toBeGreaterThan(0);
    }
  });
});

describe('country texture rendering', () => {
  it('keeps every profile border at least one source pixel wide', () => {
    expect(getCountryTextureStyle(1024).borderWidth).toBeGreaterThanOrEqual(1);
    expect(getCountryTextureStyle(2048).borderWidth).toBeGreaterThanOrEqual(1);
  });

  it('uses a bright parchment atlas palette with dark ink borders', () => {
    expect(getCountryTextureStyle(2048)).toMatchObject({
      oceanColor: '#c7d2cd',
      landColor: '#ddd2b5',
      borderColor: 'rgba(67, 66, 58, 0.82)',
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
