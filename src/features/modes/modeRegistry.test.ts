import { describe, expect, it } from 'vitest';
import { MODE_DEFINITIONS } from './modeRegistry';

describe('mode registry', () => {
  it('defines a versioned contract for every compile-time mode', () => {
    expect(Object.keys(MODE_DEFINITIONS)).toEqual([
      'antipodes',
      'development',
      'sunline',
    ]);
    expect(
      Object.values(MODE_DEFINITIONS).every(
        (mode) => mode.version === 1 && mode.cameraPolicy === 'preserve',
      ),
    ).toBe(true);
  });

  it('validates Other Side coordinates', () => {
    const schema = MODE_DEFINITIONS.antipodes.stateSchema;
    expect(
      schema.safeParse({ point: { latitude: 31.2304, longitude: 121.4737 } })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ point: { latitude: 91, longitude: 0 } }).success,
    ).toBe(false);
  });

  it('validates the bounded development state', () => {
    const schema = MODE_DEFINITIONS.development.stateSchema;
    expect(
      schema.safeParse({ indicator: 'education', year: 2005 }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ indicator: 'happiness', year: 2025 }).success,
    ).toBe(false);
  });
});
