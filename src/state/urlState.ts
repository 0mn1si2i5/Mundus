import { z } from 'zod';
import { normalizeLongitude, type GeoPoint } from '../features/globe/geo';
import type { ModeId } from '../features/modes/modeRegistry';

export const DEFAULT_POINT: GeoPoint = {
  latitude: 31.2304,
  longitude: 121.4737,
};
export const DEFAULT_MODE: ModeId = 'antipodes';

export interface ShareableState {
  activeMode: ModeId;
  point: GeoPoint;
}

const modeSchema = z.enum(['antipodes', 'development', 'sunline']);
const coordinateSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/)
  .transform((value) => value.split(',').map(Number) as [number, number])
  .refine(
    ([latitude, longitude]) =>
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180,
  );

export function parseUrlState(search: string): ShareableState {
  const params = new URLSearchParams(search);
  const mode = modeSchema.safeParse(params.get('mode'));
  const coordinate = coordinateSchema.safeParse(params.get('point'));

  return {
    activeMode: mode.success ? mode.data : DEFAULT_MODE,
    point: coordinate.success
      ? {
          latitude: coordinate.data[0],
          longitude: normalizeLongitude(coordinate.data[1]),
        }
      : DEFAULT_POINT,
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
  if (hasMode || hasPoint) params.set('v', '1');

  const query = params.toString();
  return query ? `?${query}` : '';
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(4)).toString();
}
