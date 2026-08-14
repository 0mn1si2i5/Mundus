import { describe, expect, it } from 'vitest';
import {
  archivedModes,
  defaultVisibleModes,
  featuredModes,
  filterModesByTags,
  MODE_DEFINITIONS,
  MODE_ORDER,
  modeIndex,
  searchModes,
} from './modeRegistry';

describe('mode registry', () => {
  it('defines a versioned contract for every compile-time mode', () => {
    expect(Object.keys(MODE_DEFINITIONS)).toEqual(MODE_ORDER);
    expect(
      Object.values(MODE_DEFINITIONS).every(
        (mode) => mode.version === 1 && mode.cameraPolicy === 'preserve',
      ),
    ).toBe(true);
  });

  it('provides one explicit product order with unique identifiers', () => {
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

  it('ranks featured modes uniquely and bounds the curated orbit', () => {
    const featured = featuredModes();
    const ranks = featured
      .map((mode) => mode.featuredRank)
      .filter((rank): rank is number => rank !== null);

    expect(new Set(ranks).size).toBe(ranks.length);
    expect(featured.length).toBeLessThanOrEqual(6);
    expect(featured.map((mode) => mode.id)).toEqual([
      'antipodes',
      'development',
      'sunline',
    ]);
  });

  it('keeps curation lifecycle and maturity independent', () => {
    const modes = Object.values(MODE_DEFINITIONS);
    const featuredMaturities = new Set(
      modes
        .filter((mode) => mode.curation === 'featured')
        .map((mode) => mode.maturity),
    );

    expect(featuredMaturities.size).toBeGreaterThan(1);
    expect(
      modes.every((mode) =>
        ['featured', 'collection', 'archived'].includes(mode.curation),
      ),
    ).toBe(true);
    expect(
      modes.every((mode) => ['stable', 'experimental'].includes(mode.maturity)),
    ).toBe(true);
  });

  it('declares valid, deduplicated tags', () => {
    const validTags = ['place', 'time', 'humanity', 'nature'];
    for (const mode of Object.values(MODE_DEFINITIONS)) {
      expect(mode.tags.length).toBe(new Set(mode.tags).size);
      expect(mode.tags.every((tag) => validTags.includes(tag))).toBe(true);
    }
  });

  it('provides non-empty bilingual catalog copy for every mode', () => {
    const fields = ['title', 'question', 'summary', 'sourceScope'] as const;
    for (const mode of Object.values(MODE_DEFINITIONS)) {
      for (const field of fields) {
        expect(mode[field].zh.length).toBeGreaterThan(0);
        expect(mode[field].en.length).toBeGreaterThan(0);
      }
    }
  });

  it('searches across localized title, question, and summary', () => {
    expect(searchModes('Other Side', 'en').map((mode) => mode.id)).toEqual([
      'antipodes',
    ]);
    expect(searchModes('地心', 'zh').map((mode) => mode.id)).toContain(
      'antipodes',
    );
    expect(
      searchModes('health, education', 'en').map((mode) => mode.id),
    ).toEqual(['development']);
    expect(searchModes('日照线', 'zh').map((mode) => mode.id)).toEqual([
      'sunline',
    ]);
    expect(searchModes('', 'en')).toHaveLength(MODE_ORDER.length);
  });

  it('filters by multiple tags with intersection semantics', () => {
    const all = defaultVisibleModes();
    expect(filterModesByTags(all, ['place']).map((mode) => mode.id)).toEqual([
      'antipodes',
    ]);
    expect(filterModesByTags(all, ['time']).map((mode) => mode.id)).toEqual([
      'sunline',
    ]);
    expect(
      filterModesByTags(all, ['time', 'nature']).map((mode) => mode.id),
    ).toEqual(['sunline']);
    expect(filterModesByTags(all, ['place', 'time'])).toHaveLength(0);
  });

  it('separates archived modes from default browsing', () => {
    const visible = defaultVisibleModes();
    const archived = archivedModes();

    expect(visible.every((mode) => mode.curation !== 'archived')).toBe(true);
    expect(archived.every((mode) => mode.curation === 'archived')).toBe(true);
    expect(archived).toHaveLength(0);
    expect(visible).toHaveLength(MODE_ORDER.length);
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
