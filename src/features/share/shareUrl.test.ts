import { describe, expect, it } from 'vitest';
import { createShareUrl } from './shareUrl';

describe('createShareUrl', () => {
  const state = {
    activeMode: 'antipodes' as const,
    point: { latitude: 31.2304, longitude: 121.4737 },
    developmentIndicator: 'hdi' as const,
    developmentYear: 2023,
    sunlineTimeMs: Date.parse('2026-07-14T09:37:00Z'),
    sunlineClockMode: 'live' as const,
  };

  it('omits the default point and removes stale query and hash state', () => {
    expect(
      createShareUrl('https://example.com/path?old=1#section', state),
    ).toBe('https://example.com/path');
  });

  it('serializes selected coordinates canonically to at most four decimals', () => {
    expect(
      createShareUrl('https://example.com/path', {
        ...state,
        point: { latitude: 30.12346, longitude: 120.98765 },
      }),
    ).toContain('point=30.1235%2C120.9877');
  });

  it('preserves the selected development indicator and year', () => {
    const url = createShareUrl('https://example.com/path', {
      ...state,
      activeMode: 'development',
      developmentIndicator: 'income',
      developmentYear: 2010,
    });
    expect(url).toContain('mode=development');
    expect(url).toContain('indicator=income');
    expect(url).toContain('year=2010');
  });

  it('materializes live Sunline time into a reproducible share URL', () => {
    const url = createShareUrl('https://example.com/path?mode=sunline', {
      ...state,
      activeMode: 'sunline',
    });
    expect(url).toContain('time=2026-07-14T09%3A37Z');
  });
});
