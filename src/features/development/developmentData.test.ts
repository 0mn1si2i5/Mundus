import { describe, expect, it } from 'vitest';
import generatedDataset from '../../data/generated/undp-hdr-2025-development.json';
import {
  decodeDevelopmentDataset,
  developmentColor,
  valueFor,
  valuesByCountryId,
  type DevelopmentCountry,
  type DevelopmentDataset,
} from './developmentData';
import {
  findStructuralContrast,
  globalIndicatorMedian,
  historicalIndicatorChange,
  median,
} from './developmentEvidence';

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

  it('maps exact printable palette endpoints and missing observations', () => {
    expect(developmentColor(null)).toBe('#b8b1a3');
    expect(developmentColor(0)).toBe('#a64b32');
    expect(developmentColor(0.4)).toBe('#bd6b35');
    expect(developmentColor(0.55)).toBe('#c5943f');
    expect(developmentColor(0.7)).toBe('#87945b');
    expect(developmentColor(0.8)).toBe('#4f8b82');
    expect(developmentColor(0.9)).toBe('#286c73');
    expect(developmentColor(1)).toBe('#286c73');
  });

  it('keeps adjacent printed bins perceptually distinct without implying rank by grayscale', () => {
    const bins = [0.3, 0.475, 0.625, 0.75, 0.85, 0.95].map(developmentColor);
    for (let index = 1; index < bins.length; index += 1) {
      expect(
        rgbDistance(bins[index - 1]!, bins[index]!),
      ).toBeGreaterThanOrEqual(35);
    }
    expect(
      rgbDistance(developmentColor(null), bins[0]!),
    ).toBeGreaterThanOrEqual(80);
  });

  it('computes null-safe equal-weight medians', () => {
    expect(median([3, null, 0, 2])).toEqual({ median: 2, observedCount: 3 });
    expect(median([4, 1, undefined, 2, 3])).toEqual({
      median: 2.5,
      observedCount: 4,
    });
    expect(median([null, undefined])).toEqual({
      median: null,
      observedCount: 0,
    });
  });

  it('matches fixed global and Chinese evidence baselines', () => {
    expect(globalIndicatorMedian(dataset, 'hdi', 2023)).toEqual({
      status: 'available',
      median: 0.762,
      observedCount: 193,
    });
    const china = dataset.countries.find((country) => country.iso3 === 'CHN')!;
    expect(globalIndicatorMedian(dataset, 'education', 2005)).toEqual({
      status: 'available',
      median: 0.6065,
      observedCount: 187,
    });
    expect(
      historicalIndicatorChange(dataset, china, 'education', 2005),
    ).toEqual({
      status: 'available',
      baselineYear: 1990,
      baselineValue: 0.377,
      currentYear: 2005,
      currentValue: 0.5403,
      change: 0.1633,
    });
  });

  it('uses the earliest earlier observation and preserves unknown history', () => {
    const country = makeCountry('AAA', {
      hdi: { 1991: 0.4, 1992: 0.35 },
    });
    const fixture = makeDataset([country]);
    expect(historicalIndicatorChange(fixture, country, 'hdi', 1992)).toEqual({
      status: 'available',
      baselineYear: 1991,
      baselineValue: 0.4,
      currentYear: 1992,
      currentValue: 0.35,
      change: expect.closeTo(-0.05, 10),
    });
    expect(historicalIndicatorChange(fixture, country, 'hdi', 1991)).toEqual({
      status: 'unavailable',
      reason: 'no-earlier-observation',
    });
    expect(historicalIndicatorChange(fixture, country, 'hdi', 1989)).toEqual({
      status: 'unavailable',
      reason: 'invalid-year',
    });
  });

  it('selects deterministic same-year structural contrasts', () => {
    const china = dataset.countries.find((country) => country.iso3 === 'CHN')!;
    const gabon = findStructuralContrast(dataset, china, 2005);
    expect(gabon.status).toBe('available');
    if (gabon.status !== 'available') throw new Error('Expected contrast');
    expect(gabon.country.iso3).toBe('GAB');
    expect(gabon.structuralDistance).toBeCloseTo(0.3861, 10);
    expect(gabon.dominantDimension).toBe('income');
    expect(gabon.dimensions.health.difference).toBeCloseTo(-0.1709, 10);
    expect(gabon.dimensions.education.difference).toBeCloseTo(0.0162, 10);
    expect(gabon.dimensions.income.difference).toBeCloseTo(0.199, 10);
    const palau = findStructuralContrast(dataset, china, 2023);
    expect(palau.status).toBe('available');
    if (palau.status !== 'available') throw new Error('Expected contrast');
    expect(palau.country.iso3).toBe('PLW');
    expect(palau.country.countryId).toBeNull();
    expect(palau.structuralDistance).toBeCloseTo(0.3177, 10);
    expect(palau.dominantDimension).toBe('education');
  });

  it('rejects incomplete contrasts and breaks equal-distance ties by ISO3', () => {
    const selected = makeCountry('SEL', {
      hdi: { 1990: 0.5 },
      health: { 1990: 0.5 },
      education: { 1990: 0.5 },
      income: { 1990: 0.5 },
    });
    const laterIso = makeCountry('ZZZ', {
      hdi: { 1990: 0.51 },
      health: { 1990: 0.6 },
      education: { 1990: 0.5 },
      income: { 1990: 0.5 },
    });
    const earlierIso = makeCountry('AAA', {
      hdi: { 1990: 0.49 },
      health: { 1990: 0.4 },
      education: { 1990: 0.5 },
      income: { 1990: 0.5 },
    });
    expect(
      findStructuralContrast(
        makeDataset([selected, laterIso, earlierIso]),
        selected,
        1990,
      ),
    ).toMatchObject({
      status: 'available',
      country: { iso3: 'AAA' },
    });

    const incomplete = makeCountry('MIS', { hdi: { 1990: 0.5 } });
    expect(
      findStructuralContrast(
        makeDataset([selected, incomplete]),
        selected,
        1990,
      ),
    ).toEqual({ status: 'unavailable', reason: 'no-candidate' });
    expect(
      findStructuralContrast(
        makeDataset([incomplete, selected]),
        incomplete,
        1990,
      ),
    ).toEqual({ status: 'unavailable', reason: 'selected-incomplete' });
  });

  it('includes the exact HDI window and excludes candidates beyond it', () => {
    const selected = completeCountry('SEL', 0.5, 0.5, 0.5, 0.5);
    const boundary = completeCountry('AAA', 0.52, 0.6, 0.5, 0.5);
    const outside = completeCountry('ZZZ', 0.5201, 0.9, 0.1, 0.9);
    expect(
      findStructuralContrast(
        makeDataset([selected, boundary, outside]),
        selected,
        1990,
      ),
    ).toMatchObject({ status: 'available', country: { iso3: 'AAA' } });
  });

  it('breaks dominant-dimension ties in stable dimension order', () => {
    const selected = completeCountry('SEL', 0.5, 0.5, 0.5, 0.5);
    const candidate = completeCountry('AAA', 0.5, 0.6, 0.4, 0.5);
    expect(
      findStructuralContrast(
        makeDataset([selected, candidate]),
        selected,
        1990,
      ),
    ).toMatchObject({ status: 'available', dominantDimension: 'health' });
  });

  it('distinguishes invalid years, empty distributions and missing current values', () => {
    const empty = makeCountry('EMP', {});
    const fixture = makeDataset([empty]);
    expect(globalIndicatorMedian(fixture, 'hdi', 1990)).toEqual({
      status: 'unavailable',
      reason: 'no-observations',
      observedCount: 0,
    });
    expect(globalIndicatorMedian(fixture, 'hdi', 1989)).toEqual({
      status: 'unavailable',
      reason: 'invalid-year',
      observedCount: 0,
    });
    expect(historicalIndicatorChange(fixture, empty, 'hdi', 1990)).toEqual({
      status: 'unavailable',
      reason: 'current-missing',
    });
    expect(findStructuralContrast(fixture, empty, 1989)).toEqual({
      status: 'unavailable',
      reason: 'invalid-year',
    });
  });
});

function rgbDistance(first: string, second: string) {
  const channels = (color: string) =>
    [1, 3, 5].map((offset) =>
      Number.parseInt(color.slice(offset, offset + 2), 16),
    );
  const left = channels(first);
  const right = channels(second);
  return Math.hypot(...left.map((value, index) => value - right[index]!));
}

function makeCountry(
  iso3: string,
  values: Partial<
    Record<'hdi' | 'health' | 'education' | 'income', Record<number, number>>
  >,
): DevelopmentCountry {
  const series = (indicator: keyof typeof values) =>
    Array.from(
      { length: 34 },
      (_, index) => values[indicator]?.[1990 + index] ?? null,
    );
  return {
    iso3,
    name: iso3,
    countryId: null,
    series: {
      hdi: series('hdi'),
      health: series('health'),
      education: series('education'),
      income: series('income'),
    },
  };
}

function makeDataset(countries: DevelopmentCountry[]): DevelopmentDataset {
  return {
    edition: 'HDR 2025',
    years: Array.from({ length: 34 }, (_, index) => 1990 + index),
    countries,
    countriesById: new Map(),
  };
}

function completeCountry(
  iso3: string,
  hdi: number,
  health: number,
  education: number,
  income: number,
): DevelopmentCountry {
  return makeCountry(iso3, {
    hdi: { 1990: hdi },
    health: { 1990: health },
    education: { 1990: education },
    income: { 1990: income },
  });
}
