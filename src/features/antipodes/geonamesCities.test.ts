import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import generatedIndex from '../../data/generated/geonames-major-cities.json';
import {
  decodeGeoNamesCityIndex,
  estimateGeoNamesDecodedBytes,
  findNearestMajorCity,
  loadGeoNamesCityIndex,
  normalizeCityQuery,
  resetGeoNamesCityIndex,
  searchGeoNamesCities,
  setGeoNamesCityImporterForTests,
} from './geonamesCities';
import type { GeoNamesCity } from './geonamesCities';

const compact = {
  formatVersion: 1,
  strings: [
    'BR',
    'Brazil',
    'Brasil',
    'CN',
    'China',
    '中国',
    'JP',
    'Japan',
    '日本',
    'US',
    'United States',
    '美国',
    'Beijing',
    '北京',
    'Shanghai',
    '上海',
    'Tokyo',
    '东京',
    'New York',
    '纽约',
    'São Paulo',
    '圣保罗',
    'Sao Paulo',
  ],
  rows: [
    [1816670, 3990750, 11639723, 11716620, 0, 3, 12, 13, 4, 5, null, null, []],
    [1796236, 3112300, 12145806, 22315474, 1, 3, 14, 15, 4, 5, null, null, []],
    [1850147, 3568950, 13969171, 8336599, 0, 6, 16, 17, 7, 8, null, null, []],
    [5128581, 4071427, -7400597, 8804190, 2, 9, 18, 19, 10, 11, null, null, []],
    [
      3448439,
      -2354760,
      -4663620,
      12400232,
      2,
      0,
      20,
      21,
      1,
      2,
      null,
      null,
      [22],
    ],
  ],
};

describe('GeoNames city index', () => {
  beforeEach(() => {
    resetGeoNamesCityIndex();
  });

  it('rejects malformed schemas, bad string references, coordinates, and duplicate IDs', () => {
    expect(() => decodeGeoNamesCityIndex({ formatVersion: 2 })).toThrow();
    expect(() =>
      decodeGeoNamesCityIndex({
        ...compact,
        rows: [[1, 0, 0, 1, 0, 99, 0, 0, 0, 0, null, null, []]],
      }),
    ).toThrow(/string table/i);
    expect(() =>
      decodeGeoNamesCityIndex({
        ...compact,
        rows: [[1, 9100000, 0, 1, 0, 0, 1, 1, 1, 1, null, null, []]],
      }),
    ).toThrow(/coordinate/i);
    expect(() =>
      decodeGeoNamesCityIndex({
        ...compact,
        rows: [compact.rows[0], compact.rows[0]],
      }),
    ).toThrow(/duplicate/i);
  });

  it('decodes E5 coordinates and searchable bilingual records', () => {
    const cities = decodeGeoNamesCityIndex(compact);
    expect(cities[0]).toMatchObject({
      id: 1816670,
      name: { en: 'Beijing', zh: '北京' },
      country: { en: 'China', zh: '中国' },
      point: { latitude: 39.9075, longitude: 116.39723 },
      featureCode: 'PPLC',
    });
    expect(cities[0]?.search).toEqual({
      nameEn: 'beijing',
      nameZh: '北京',
      countryEn: 'china',
      countryZh: '中国',
      adminEn: '',
      adminZh: '',
      aliases: [],
    });
  });

  it('normalizes accents and punctuation and enforces minimum query lengths', () => {
    expect(normalizeCityQuery('  São-Paulo ')).toBe('sao paulo');
    const cities = decodeGeoNamesCityIndex(compact);
    expect(searchGeoNamesCities(cities, 's', 'en')).toEqual([]);
    expect(searchGeoNamesCities(cities, '北', 'zh')[0]?.name.zh).toBe('北京');
  });

  it.each([
    ['Beijing', 'en', 1816670],
    ['北京', 'zh', 1816670],
    ['Shanghai', 'en', 1796236],
    ['上海', 'zh', 1796236],
    ['Tokyo', 'en', 1850147],
    ['东京', 'zh', 1850147],
    ['New York', 'en', 5128581],
    ['纽约', 'zh', 5128581],
    ['Sao Paulo', 'en', 3448439],
  ] as const)('finds %s in %s', (query, locale, id) => {
    expect(
      searchGeoNamesCities(decodeGeoNamesCityIndex(compact), query, locale)[0]
        ?.id,
    ).toBe(id);
  });

  it('caps results at six and ranks exact locale names before aliases and country matches', () => {
    const cities = decodeGeoNamesCityIndex(compact);
    const expanded: GeoNamesCity[] = Array.from({ length: 8 }, (_, index) => ({
      ...cities[0]!,
      id: 9000 + index,
      name: { en: `Bei city ${index}`, zh: `北城${index}` },
      search: {
        ...cities[0]!.search,
        nameEn: `bei city ${index}`,
        nameZh: `北城${index}`,
      },
    }));
    expect(searchGeoNamesCities(expanded, 'bei', 'en')).toHaveLength(6);
    expect(searchGeoNamesCities(cities, 'Sao Paulo', 'en')[0]?.name.en).toBe(
      'São Paulo',
    );
    expect(
      searchGeoNamesCities(cities, 'China', 'en').map((city) => city.id),
    ).toEqual([1816670, 1796236]);
  });

  it('finds nearest with distance, then population and ID tie breaks', () => {
    const cities = decodeGeoNamesCityIndex(compact);
    expect(
      findNearestMajorCity({ latitude: 35.7, longitude: 139.7 }, cities).city
        .id,
    ).toBe(1850147);
    const tied: GeoNamesCity[] = [
      {
        ...cities[0]!,
        id: 2,
        population: 10,
        point: { latitude: 0, longitude: 1 },
      },
      {
        ...cities[0]!,
        id: 1,
        population: 20,
        point: { latitude: 0, longitude: -1 },
      },
    ];
    expect(
      findNearestMajorCity({ latitude: 0, longitude: 0 }, tied).city.id,
    ).toBe(1);
    expect(
      findNearestMajorCity({ latitude: 0, longitude: 0 }, tied).distanceKm,
    ).toBeGreaterThan(100);
  });

  it('scans a large immutable index without map or sort allocation', () => {
    const template = decodeGeoNamesCityIndex(compact)[0]!;
    const cities = Array.from({ length: 20_000 }, (_, index) => ({
      ...template,
      id: index + 1,
      population: index,
      point: { latitude: 20, longitude: (index % 360) - 180 },
    }));
    cities[17_321] = {
      ...cities[17_321]!,
      point: { latitude: 0, longitude: 0 },
    };
    const originalMap = Array.prototype.map;
    const originalSort = Array.prototype.sort;
    Array.prototype.map = () => {
      throw new Error('nearest lookup must not map');
    };
    Array.prototype.sort = () => {
      throw new Error('nearest lookup must not sort');
    };
    try {
      expect(
        findNearestMajorCity({ latitude: 0, longitude: 0 }, cities).city.id,
      ).toBe(17_322);
    } finally {
      Array.prototype.map = originalMap;
      Array.prototype.sort = originalSort;
    }
  });

  it('shares one lazy load and clears a failed promise for retry', async () => {
    const importer = vi.fn().mockResolvedValue({ default: compact });
    setGeoNamesCityImporterForTests(importer);
    const [first, second] = await Promise.all([
      loadGeoNamesCityIndex(),
      loadGeoNamesCityIndex(),
    ]);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    resetGeoNamesCityIndex();
    const retryImporter = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ default: compact });
    setGeoNamesCityImporterForTests(retryImporter);
    await expect(loadGeoNamesCityIndex()).rejects.toThrow('offline');
    await expect(loadGeoNamesCityIndex()).resolves.toHaveLength(5);
    expect(retryImporter).toHaveBeenCalledTimes(2);
  });

  it('searches the real warmed index repeatedly under the aggregate desktop target', () => {
    const cities = decodeGeoNamesCityIndex(generatedIndex);
    const queries = [
      ['Beijing', 'en'],
      ['北京', 'zh'],
      ['纽约', 'zh'],
      ['紐約', 'zh'],
      ['Sao Paulo', 'en'],
      ['United States', 'en'],
    ] as const;
    for (const [query, locale] of queries) {
      searchGeoNamesCities(cities, query, locale);
    }
    const started = performance.now();
    for (let iteration = 0; iteration < 20; iteration += 1) {
      for (const [query, locale] of queries) {
        expect(
          searchGeoNamesCities(cities, query, locale).length,
        ).toBeGreaterThan(0);
      }
    }
    const averageMs = (performance.now() - started) / (20 * queries.length);
    expect(averageMs).toBeLessThan(15);
  });

  it('keeps the conservative decoded and normalized search estimate below 8 MiB', () => {
    const cities = decodeGeoNamesCityIndex(generatedIndex);
    const estimate = estimateGeoNamesDecodedBytes(
      cities,
      JSON.stringify(generatedIndex).length + 1,
    );
    expect(estimate).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(estimate).toBeGreaterThan(3_116_420);
  });

  it('uses the documented estimator formula for fixed vectors', () => {
    const city = decodeGeoNamesCityIndex({
      formatVersion: 1,
      strings: [
        'CC',
        'City',
        '城市',
        'Country',
        '国家',
        'Admin',
        '行政',
        'Alias',
      ],
      rows: [[1, 0, 0, 1, 2, 0, 1, 2, 3, 4, 5, 6, [7]]],
    });
    const normalizedValues = [
      'city',
      '城市',
      'country',
      '国家',
      'admin',
      '行政',
      'alias',
    ];
    const normalizedBytes = normalizedValues.reduce(
      (sum, value) => sum + 24 + value.length * 2,
      0,
    );
    expect(estimateGeoNamesDecodedBytes(city, 100)).toBe(
      100 * 4 + normalizedBytes + (64 + 6 * 8 + 24) + 8,
    );
  });
});
