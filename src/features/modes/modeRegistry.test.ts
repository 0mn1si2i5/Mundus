import { describe, expect, it } from 'vitest';
import { MODE_DEFINITIONS, MODE_ORDER, modeIndex } from './modeRegistry';

describe('mode registry', () => {
  it('defines a versioned contract for every compile-time mode', () => {
    expect(Object.keys(MODE_DEFINITIONS)).toEqual(MODE_ORDER);
    expect(
      Object.values(MODE_DEFINITIONS).every(
        (mode) => mode.version === 1 && mode.cameraPolicy === 'preserve',
      ),
    ).toBe(true);
  });

  it('provides one explicit product order', () => {
    expect(MODE_ORDER.map(modeIndex)).toEqual([0, 1, 2]);
    expect(new Set(MODE_ORDER).size).toBe(MODE_ORDER.length);
  });

  it('defines complete Chinese title phrase units', () => {
    expect(MODE_DEFINITIONS.antipodes.titlePhrases.zh).toEqual([
      '地球',
      '另一端',
    ]);
    expect(MODE_DEFINITIONS.development.titlePhrases.zh).toEqual([
      '发展的',
      '不同侧面',
    ]);
    expect(MODE_DEFINITIONS.sunline.titlePhrases.zh).toEqual(['日照线']);

    for (const mode of Object.values(MODE_DEFINITIONS)) {
      expect(mode.titlePhrases.zh.join('')).toBe(mode.title.zh);
    }
  });

  it('uses non-causal wording for the prominent English Development question', () => {
    const question = MODE_DEFINITIONS.development.question.en;

    expect(question).toBe(
      'What different structures can underlie similar levels of development?',
    );
    expect(question).not.toMatch(/produce|cause/iu);
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

  it('validates bounded and versioned Sunline time state', () => {
    const schema = MODE_DEFINITIONS.sunline.stateSchema;
    expect(
      schema.safeParse({
        timeMs: Date.parse('2026-07-14T09:37:00Z'),
        clockMode: 'fixed',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        timeMs: Date.parse('2100-01-01T00:00:00Z'),
        clockMode: 'playing',
      }).success,
    ).toBe(false);
  });
});
