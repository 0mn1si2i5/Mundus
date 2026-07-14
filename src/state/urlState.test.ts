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
  const nowMs = Date.parse('2026-07-14T09:37:00Z');
  const sunlineDefaults = {
    sunlineTimeMs: nowMs,
    sunlineClockMode: 'live' as const,
  };

  it('omits defaults', () => {
    expect(
      serializeUrlState({
        activeMode: DEFAULT_MODE,
        point: DEFAULT_POINT,
        developmentIndicator: DEFAULT_DEVELOPMENT_INDICATOR,
        developmentYear: DEFAULT_DEVELOPMENT_YEAR,
        ...sunlineDefaults,
      }),
    ).toBe('');
  });

  it('round-trips mode and coordinates with bounded precision', () => {
    const query = serializeUrlState({
      activeMode: 'sunline',
      point: { latitude: 12.345678, longitude: -98.765432 },
      developmentIndicator: 'hdi',
      developmentYear: 2023,
      ...sunlineDefaults,
    });
    expect(query).toBe('?mode=sunline&point=12.3457%2C-98.7654&v=1');
    expect(parseUrlState(query, nowMs)).toEqual({
      activeMode: 'sunline',
      point: { latitude: 12.3457, longitude: -98.7654 },
      developmentIndicator: 'hdi',
      developmentYear: 2023,
      ...sunlineDefaults,
    });
  });

  it('round-trips non-default development state only in that mode', () => {
    const query = serializeUrlState({
      activeMode: 'development',
      point: DEFAULT_POINT,
      developmentIndicator: 'education',
      developmentYear: 2005,
      ...sunlineDefaults,
    });
    expect(query).toBe('?mode=development&indicator=education&year=2005&v=1');
    expect(parseUrlState(query)).toMatchObject({
      developmentIndicator: 'education',
      developmentYear: 2005,
    });
  });

  it('round-trips fixed Sunline time and leaves live time out of the URL', () => {
    const fixed = serializeUrlState({
      activeMode: 'sunline',
      point: DEFAULT_POINT,
      developmentIndicator: DEFAULT_DEVELOPMENT_INDICATOR,
      developmentYear: DEFAULT_DEVELOPMENT_YEAR,
      sunlineTimeMs: nowMs,
      sunlineClockMode: 'fixed',
    });
    expect(fixed).toBe('?mode=sunline&time=2026-07-14T09%3A37Z&v=1');
    expect(
      parseUrlState(fixed, Date.parse('2027-01-01T00:00:00Z')),
    ).toMatchObject({
      sunlineTimeMs: nowMs,
      sunlineClockMode: 'fixed',
    });
  });

  it.each(['?mode=nope&point=91,0', '?point=text', '?point=0,181'])(
    'falls back safely for invalid parameters in %s',
    (query) => {
      expect(parseUrlState(query, nowMs)).toEqual({
        activeMode: DEFAULT_MODE,
        point: DEFAULT_POINT,
        developmentIndicator: DEFAULT_DEVELOPMENT_INDICATOR,
        developmentYear: DEFAULT_DEVELOPMENT_YEAR,
        ...sunlineDefaults,
      });
    },
  );

  it('falls back to live time for invalid or out-of-range Sunline time', () => {
    expect(
      parseUrlState('?mode=sunline&time=2100-01-01T00%3A00Z', nowMs),
    ).toMatchObject(sunlineDefaults);
  });

  it('ignores Sunline time outside the Sunline mode', () => {
    expect(
      parseUrlState('?mode=development&time=2024-03-20T12%3A00Z', nowMs),
    ).toMatchObject(sunlineDefaults);
  });
});
