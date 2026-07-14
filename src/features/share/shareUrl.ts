import { serializeUrlState, type ShareableState } from '../../state/urlState';

export type SharePrecision = 'exact' | 'approximate';

export function createShareUrl(
  baseUrl: string,
  state: ShareableState,
  precision: SharePrecision,
): string {
  const url = new URL(baseUrl);
  const point =
    precision === 'exact'
      ? state.point
      : {
          latitude: Math.round(state.point.latitude),
          longitude: Math.round(state.point.longitude),
        };
  url.search = serializeUrlState({ ...state, point });
  url.hash = '';
  return url.toString();
}
