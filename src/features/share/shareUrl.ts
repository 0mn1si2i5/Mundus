import { serializeUrlState, type ShareableState } from '../../state/urlState';

export function createShareUrl(baseUrl: string, state: ShareableState): string {
  const url = new URL(baseUrl);
  url.search = serializeUrlState({
    ...state,
    sunlineClockMode:
      state.activeMode === 'sunline' ? 'fixed' : state.sunlineClockMode,
  });
  url.hash = '';
  return url.toString();
}
