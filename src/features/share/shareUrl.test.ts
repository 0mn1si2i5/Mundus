import { describe, expect, it } from 'vitest';
import { createShareUrl } from './shareUrl';

describe('share URL precision', () => {
  const state = {
    activeMode: 'antipodes' as const,
    point: { latitude: 31.2304, longitude: 121.4737 },
    developmentIndicator: 'hdi' as const,
    developmentYear: 2023,
    sunlineTimeMs: Date.parse('2026-07-14T09:37:00Z'),
    sunlineClockMode: 'live' as const,
  };

  it('preserves exact coordinates only when requested', () => {
    expect(
      createShareUrl('https://example.com/path?old=1', state, 'exact'),
    ).toBe('https://example.com/path');
    expect(
      createShareUrl(
        'https://example.com/path',
        { ...state, point: { latitude: 30.12346, longitude: 120.98765 } },
        'exact',
      ),
    ).toContain('point=30.1235%2C120.9877');
  });

  it('rounds approximate shares to whole degrees', () => {
    expect(
      createShareUrl('https://example.com/path', state, 'approximate'),
    ).toContain('point=31%2C121');
  });

  it('preserves the selected development indicator and year', () => {
    const url = createShareUrl(
      'https://example.com/path',
      {
        ...state,
        activeMode: 'development',
        developmentIndicator: 'income',
        developmentYear: 2010,
      },
      'exact',
    );
    expect(url).toContain('mode=development');
    expect(url).toContain('indicator=income');
    expect(url).toContain('year=2010');
  });

  it('materializes live Sunline time into a reproducible share URL', () => {
    const url = createShareUrl(
      'https://example.com/path?mode=sunline',
      { ...state, activeMode: 'sunline' },
      'exact',
    );
    expect(url).toContain('time=2026-07-14T09%3A37Z');
  });
});
