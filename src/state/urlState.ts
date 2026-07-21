import { z } from 'zod';
import {
  normalizeLongitude,
  type GeoPoint,
} from '../features/antipodes/geography';
import type { ModeId } from '../features/modes/modeRegistry';
import type { DevelopmentIndicator } from '../features/development/developmentData';
import {
  clampSunlineTime,
  formatSunlineTime,
  parseSunlineTime,
} from '../features/sunline/solar';

export const DEFAULT_POINT: GeoPoint = {
  latitude: 31.2304,
  longitude: 121.4737,
};
export const DEFAULT_MODE: ModeId = 'antipodes';
export const DEFAULT_DEVELOPMENT_INDICATOR: DevelopmentIndicator = 'hdi';
export const DEFAULT_DEVELOPMENT_YEAR = 2023;
export type SunlineClockMode = 'live' | 'fixed';

export interface ShareableState {
  activeMode: ModeId;
  point: GeoPoint;
  developmentIndicator: DevelopmentIndicator;
  developmentYear: number;
  sunlineTimeMs: number;
  sunlineClockMode: SunlineClockMode;
}

const modeSchema = z.enum(['antipodes', 'development', 'sunline']);
const developmentIndicatorSchema = z.enum([
  'hdi',
  'health',
  'education',
  'income',
]);
const developmentYearSchema = z.coerce.number().int().min(1990).max(2023);
const coordinateSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/)
  .transform((value) => value.split(',').map(Number) as [number, number])
  .refine(
    ([latitude, longitude]) =>
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180,
  );

export function parseUrlState(
  search: string,
  nowMs = Date.now(),
): ShareableState {
  const params = new URLSearchParams(search);
  const mode = modeSchema.safeParse(params.get('mode'));
  const activeMode = mode.success ? mode.data : DEFAULT_MODE;
  const coordinate = coordinateSchema.safeParse(params.get('point'));
  const developmentIndicator = developmentIndicatorSchema.safeParse(
    params.get('indicator'),
  );
  const developmentYear = developmentYearSchema.safeParse(params.get('year'));
  const parsedSunlineTime = params.get('time');
  const sunlineTimeMs =
    activeMode === 'sunline' && parsedSunlineTime
      ? parseSunlineTime(parsedSunlineTime)
      : null;

  return {
    activeMode,
    point: coordinate.success
      ? {
          latitude: coordinate.data[0],
          longitude: normalizeLongitude(coordinate.data[1]),
        }
      : DEFAULT_POINT,
    developmentIndicator: developmentIndicator.success
      ? developmentIndicator.data
      : DEFAULT_DEVELOPMENT_INDICATOR,
    developmentYear: developmentYear.success
      ? developmentYear.data
      : DEFAULT_DEVELOPMENT_YEAR,
    sunlineTimeMs: sunlineTimeMs ?? clampSunlineTime(nowMs),
    sunlineClockMode: sunlineTimeMs === null ? 'live' : 'fixed',
  };
}

export function serializeUrlState(state: ShareableState): string {
  const params = new URLSearchParams();
  const hasMode = state.activeMode !== DEFAULT_MODE;
  const hasPoint =
    state.point.latitude !== DEFAULT_POINT.latitude ||
    state.point.longitude !== DEFAULT_POINT.longitude;

  if (hasMode) params.set('mode', state.activeMode);
  if (hasPoint) {
    params.set(
      'point',
      `${formatCoordinate(state.point.latitude)},${formatCoordinate(state.point.longitude)}`,
    );
  }
  if (state.activeMode === 'development') {
    if (state.developmentIndicator !== DEFAULT_DEVELOPMENT_INDICATOR) {
      params.set('indicator', state.developmentIndicator);
    }
    if (state.developmentYear !== DEFAULT_DEVELOPMENT_YEAR) {
      params.set('year', String(state.developmentYear));
    }
  }
  if (state.activeMode === 'sunline' && state.sunlineClockMode === 'fixed') {
    params.set('time', formatSunlineTime(state.sunlineTimeMs));
  }
  if (params.size > 0) params.set('v', '1');

  const query = params.toString();
  return query ? `?${query}` : '';
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(4)).toString();
}
