import { z } from 'zod';

export const DEVELOPMENT_INDICATORS = [
  'hdi',
  'health',
  'education',
  'income',
] as const;

export type DevelopmentIndicator = (typeof DEVELOPMENT_INDICATORS)[number];

const indexSeriesSchema = z
  .array(z.number().min(0).max(1).nullable())
  .length(34);
const countryRowSchema = z.tuple([
  z.string().regex(/^[A-Z]{3}$/),
  z.string().min(1),
  z.string().min(1).nullable(),
  indexSeriesSchema,
  indexSeriesSchema,
  indexSeriesSchema,
  indexSeriesSchema,
]);
const developmentDatasetSchema = z.object({
  formatVersion: z.literal(1),
  edition: z.literal('HDR 2025'),
  years: z.array(z.number().int().min(1990).max(2023)).length(34),
  indicators: z.tuple([
    z.literal('hdi'),
    z.literal('health'),
    z.literal('education'),
    z.literal('income'),
  ]),
  countries: z.array(countryRowSchema).min(190),
});

export interface DevelopmentCountry {
  iso3: string;
  name: string;
  countryId: string | null;
  series: Record<DevelopmentIndicator, readonly (number | null)[]>;
}

export interface DevelopmentDataset {
  edition: 'HDR 2025';
  years: readonly number[];
  countries: readonly DevelopmentCountry[];
  countriesById: ReadonlyMap<string, DevelopmentCountry>;
}

let datasetPromise: Promise<DevelopmentDataset> | undefined;

export function decodeDevelopmentDataset(input: unknown): DevelopmentDataset {
  const parsed = developmentDatasetSchema.parse(input);
  const countries: DevelopmentCountry[] = parsed.countries.map(
    ([iso3, name, countryId, hdi, health, education, income]) => ({
      iso3,
      name,
      countryId,
      series: { hdi, health, education, income },
    }),
  );
  const countriesById = new Map<string, DevelopmentCountry>();
  for (const country of countries) {
    if (country.countryId) countriesById.set(country.countryId, country);
  }

  return {
    edition: parsed.edition,
    years: parsed.years,
    countries,
    countriesById,
  };
}

export function loadDevelopmentDataset(): Promise<DevelopmentDataset> {
  datasetPromise ??=
    import('../../data/generated/undp-hdr-2025-development.json')
      .then((module) => decodeDevelopmentDataset(module.default))
      .catch((error: unknown) => {
        datasetPromise = undefined;
        throw error;
      });
  return datasetPromise;
}

export function valueFor(
  country: DevelopmentCountry,
  indicator: DevelopmentIndicator,
  year: number,
): number | null {
  const index = year - 1990;
  return country.series[indicator][index] ?? null;
}

export function valuesByCountryId(
  dataset: DevelopmentDataset,
  indicator: DevelopmentIndicator,
  year: number,
): ReadonlyMap<string, number | null> {
  return new Map(
    [...dataset.countriesById].map(([countryId, country]) => [
      countryId,
      valueFor(country, indicator, year),
    ]),
  );
}

export function developmentColor(value: number | null): string {
  if (value === null) return '#182126';
  if (value < 0.4) return '#75433f';
  if (value < 0.55) return '#96644c';
  if (value < 0.7) return '#ad8e61';
  if (value < 0.8) return '#99a77f';
  if (value < 0.9) return '#70a094';
  return '#4c897f';
}
