import { describe, expect, it } from 'vitest';
import generatedDataset from '../../data/generated/undp-hdr-2025-development.json';
import {
  decodeDevelopmentDataset,
  developmentColor,
  valueFor,
  valuesByCountryId,
} from './developmentData';

const dataset = decodeDevelopmentDataset(generatedDataset);

describe('UNDP development dataset', () => {
  it('has the expected grain, years and unique country keys', () => {
    expect(dataset.countries).toHaveLength(195);
    expect(dataset.years).toEqual(
      Array.from({ length: 34 }, (_, index) => 1990 + index),
    );
    expect(new Set(dataset.countries.map((country) => country.iso3)).size).toBe(
      dataset.countries.length,
    );
    expect(dataset.countriesById.size).toBe(166);
  });

  it('keeps missing observations as null and values within index bounds', () => {
    const andorra = dataset.countries.find((country) => country.iso3 === 'AND');
    expect(andorra).toBeDefined();
    expect(andorra?.countryId).toBeNull();
    expect(valueFor(andorra!, 'hdi', 1990)).toBeNull();

    for (const country of dataset.countries) {
      for (const series of Object.values(country.series)) {
        expect(
          series.every((entry) => entry === null || (entry >= 0 && entry <= 1)),
        ).toBe(true);
      }
    }
  });

  it('maps the latest reported Chinese HDI to the globe country id', () => {
    const values = valuesByCountryId(dataset, 'hdi', 2023);
    expect(values.get('ne-156')).toBe(0.797);
  });

  it('keeps reported HDI consistent with the three derived dimensions', () => {
    let largestError = 0;
    for (const country of dataset.countries) {
      for (const year of dataset.years) {
        const values = ['hdi', 'health', 'education', 'income'].map(
          (indicator) =>
            valueFor(country, indicator as keyof typeof country.series, year),
        );
        if (values.some((value) => value === null)) continue;
        const hdi = values[0]!;
        const health = values[1]!;
        const education = values[2]!;
        const income = values[3]!;
        const reconstructed = (health * education * income) ** (1 / 3);
        largestError = Math.max(largestError, Math.abs(hdi - reconstructed));
      }
    }
    expect(largestError).toBeLessThan(0.001);
  });

  it('uses an explicit missing color and ordered development bins', () => {
    expect(developmentColor(null)).toBe('#182126');
    expect(developmentColor(0.3)).not.toBe(developmentColor(0.95));
  });
});
