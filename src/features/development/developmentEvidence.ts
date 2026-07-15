import {
  valueFor,
  type DevelopmentCountry,
  type DevelopmentDataset,
  type DevelopmentIndicator,
} from './developmentData';

export const STRUCTURAL_HDI_WINDOW = 0.02;
export const STRUCTURAL_DIMENSIONS = ['health', 'education', 'income'] as const;

export type StructuralDimension = (typeof STRUCTURAL_DIMENSIONS)[number];

export type GlobalIndicatorMedian =
  | { status: 'available'; median: number; observedCount: number }
  | {
      status: 'unavailable';
      reason: 'invalid-year' | 'no-observations';
      observedCount: 0;
    };

export type HistoricalIndicatorChange =
  | {
      status: 'available';
      baselineYear: number;
      baselineValue: number;
      currentYear: number;
      currentValue: number;
      change: number;
    }
  | {
      status: 'unavailable';
      reason: 'invalid-year' | 'current-missing' | 'no-earlier-observation';
    };

interface StructuralDimensionEvidence {
  selected: number;
  contrast: number;
  difference: number;
  absoluteDifference: number;
}

export type StructuralContrast =
  | {
      status: 'available';
      country: DevelopmentCountry;
      hdiDifference: number;
      structuralDistance: number;
      dimensions: Readonly<
        Record<StructuralDimension, StructuralDimensionEvidence>
      >;
      dominantDimension: StructuralDimension;
    }
  | {
      status: 'unavailable';
      reason: 'invalid-year' | 'selected-incomplete' | 'no-candidate';
    };

const COMPARISON_EPSILON = 1e-12;

export function median(values: Iterable<number | null | undefined>): {
  median: number | null;
  observedCount: number;
} {
  const observed = [...values]
    .filter((value): value is number => value !== null && value !== undefined)
    .sort((a, b) => a - b);
  const middle = Math.floor(observed.length / 2);
  return {
    median:
      observed.length === 0
        ? null
        : observed.length % 2 === 0
          ? (observed[middle - 1]! + observed[middle]!) / 2
          : observed[middle]!,
    observedCount: observed.length,
  };
}

export function globalIndicatorMedian(
  dataset: DevelopmentDataset,
  indicator: DevelopmentIndicator,
  year: number,
): GlobalIndicatorMedian {
  if (!dataset.years.includes(year)) {
    return {
      status: 'unavailable',
      reason: 'invalid-year',
      observedCount: 0,
    };
  }
  const result = median(
    dataset.countries.map((country) => valueFor(country, indicator, year)),
  );
  return result.median === null
    ? {
        status: 'unavailable',
        reason: 'no-observations',
        observedCount: 0,
      }
    : { status: 'available', ...result, median: result.median };
}

export function historicalIndicatorChange(
  dataset: DevelopmentDataset,
  country: DevelopmentCountry,
  indicator: DevelopmentIndicator,
  year: number,
): HistoricalIndicatorChange {
  if (!dataset.years.includes(year)) {
    return { status: 'unavailable', reason: 'invalid-year' };
  }
  const currentValue = valueFor(country, indicator, year);
  if (currentValue === null) {
    return { status: 'unavailable', reason: 'current-missing' };
  }
  const baselineYear = dataset.years.find(
    (candidateYear) =>
      candidateYear < year &&
      valueFor(country, indicator, candidateYear) !== null,
  );
  if (baselineYear === undefined) {
    return { status: 'unavailable', reason: 'no-earlier-observation' };
  }
  const baselineValue = valueFor(country, indicator, baselineYear)!;
  return {
    status: 'available',
    baselineYear,
    baselineValue,
    currentYear: year,
    currentValue,
    change: currentValue - baselineValue,
  };
}

export function findStructuralContrast(
  dataset: DevelopmentDataset,
  selectedCountry: DevelopmentCountry,
  year: number,
): StructuralContrast {
  if (!dataset.years.includes(year)) {
    return { status: 'unavailable', reason: 'invalid-year' };
  }
  const selected = completeStructure(selectedCountry, year);
  if (!selected) {
    return { status: 'unavailable', reason: 'selected-incomplete' };
  }

  let best: Extract<StructuralContrast, { status: 'available' }> | null = null;
  for (const country of dataset.countries) {
    if (country.iso3 === selectedCountry.iso3) continue;
    const candidate = completeStructure(country, year);
    if (!candidate) continue;
    const hdiDifference = Math.abs(candidate.hdi - selected.hdi);
    if (hdiDifference > STRUCTURAL_HDI_WINDOW + COMPARISON_EPSILON) continue;
    const dimensions = Object.fromEntries(
      STRUCTURAL_DIMENSIONS.map((dimension) => {
        const difference = candidate[dimension] - selected[dimension];
        return [
          dimension,
          {
            selected: selected[dimension],
            contrast: candidate[dimension],
            difference,
            absoluteDifference: Math.abs(difference),
          },
        ];
      }),
    ) as Record<StructuralDimension, StructuralDimensionEvidence>;
    const structuralDistance = STRUCTURAL_DIMENSIONS.reduce(
      (sum, dimension) => sum + dimensions[dimension].absoluteDifference,
      0,
    );
    if (
      best &&
      structuralDistance < best.structuralDistance + COMPARISON_EPSILON
    ) {
      if (
        Math.abs(structuralDistance - best.structuralDistance) >
          COMPARISON_EPSILON ||
        country.iso3 >= best.country.iso3
      ) {
        continue;
      }
    }
    const dominantDimension = STRUCTURAL_DIMENSIONS.reduce((dominant, item) =>
      dimensions[item].absoluteDifference >
      dimensions[dominant].absoluteDifference + COMPARISON_EPSILON
        ? item
        : dominant,
    );
    best = {
      status: 'available',
      country,
      hdiDifference,
      structuralDistance,
      dimensions,
      dominantDimension,
    };
  }
  return best ?? { status: 'unavailable', reason: 'no-candidate' };
}

function completeStructure(country: DevelopmentCountry, year: number) {
  const hdi = valueFor(country, 'hdi', year);
  const health = valueFor(country, 'health', year);
  const education = valueFor(country, 'education', year);
  const income = valueFor(country, 'income', year);
  return hdi === null ||
    health === null ||
    education === null ||
    income === null
    ? null
    : { hdi, health, education, income };
}
