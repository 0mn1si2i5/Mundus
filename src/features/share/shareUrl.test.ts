import { describe, expect, it } from 'vitest';
import { createShareUrl } from './shareUrl';

describe('share URL precision', () => {
  const state = {
    activeMode: 'antipodes' as const,
    point: { latitude: 31.2304, longitude: 121.4737 },
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
});
