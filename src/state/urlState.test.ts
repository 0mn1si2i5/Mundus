import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODE,
  DEFAULT_POINT,
  parseUrlState,
  serializeUrlState,
} from './urlState';

describe('URL state codec', () => {
  it('omits defaults', () => {
    expect(
      serializeUrlState({ activeMode: DEFAULT_MODE, point: DEFAULT_POINT }),
    ).toBe('');
  });

  it('round-trips mode and coordinates with bounded precision', () => {
    const query = serializeUrlState({
      activeMode: 'sunline',
      point: { latitude: 12.345678, longitude: -98.765432 },
    });
    expect(query).toBe('?mode=sunline&point=12.3457%2C-98.7654&v=1');
    expect(parseUrlState(query)).toEqual({
      activeMode: 'sunline',
      point: { latitude: 12.3457, longitude: -98.7654 },
    });
  });

  it.each(['?mode=nope&point=91,0', '?point=text', '?point=0,181'])(
    'falls back safely for invalid parameters in %s',
    (query) => {
      expect(parseUrlState(query)).toEqual({
        activeMode: DEFAULT_MODE,
        point: DEFAULT_POINT,
      });
    },
  );
});
