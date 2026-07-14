import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODE,
  DEFAULT_POINT,
  DEFAULT_DEVELOPMENT_INDICATOR,
  DEFAULT_DEVELOPMENT_YEAR,
  parseUrlState,
  serializeUrlState,
} from './urlState';

describe('URL state codec', () => {
  it('omits defaults', () => {
    expect(
      serializeUrlState({
        activeMode: DEFAULT_MODE,
        point: DEFAULT_POINT,
        developmentIndicator: DEFAULT_DEVELOPMENT_INDICATOR,
        developmentYear: DEFAULT_DEVELOPMENT_YEAR,
      }),
    ).toBe('');
  });

  it('round-trips mode and coordinates with bounded precision', () => {
    const query = serializeUrlState({
      activeMode: 'sunline',
      point: { latitude: 12.345678, longitude: -98.765432 },
      developmentIndicator: 'hdi',
      developmentYear: 2023,
    });
    expect(query).toBe('?mode=sunline&point=12.3457%2C-98.7654&v=1');
    expect(parseUrlState(query)).toEqual({
      activeMode: 'sunline',
      point: { latitude: 12.3457, longitude: -98.7654 },
      developmentIndicator: 'hdi',
      developmentYear: 2023,
    });
  });

  it('round-trips non-default development state only in that mode', () => {
    const query = serializeUrlState({
      activeMode: 'development',
      point: DEFAULT_POINT,
      developmentIndicator: 'education',
      developmentYear: 2005,
    });
    expect(query).toBe('?mode=development&indicator=education&year=2005&v=1');
    expect(parseUrlState(query)).toMatchObject({
      developmentIndicator: 'education',
      developmentYear: 2005,
    });
  });

  it.each(['?mode=nope&point=91,0', '?point=text', '?point=0,181'])(
    'falls back safely for invalid parameters in %s',
    (query) => {
      expect(parseUrlState(query)).toEqual({
        activeMode: DEFAULT_MODE,
        point: DEFAULT_POINT,
        developmentIndicator: DEFAULT_DEVELOPMENT_INDICATOR,
        developmentYear: DEFAULT_DEVELOPMENT_YEAR,
      });
    },
  );
});
