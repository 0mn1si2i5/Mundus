import { describe, expect, it } from 'vitest';
import dataset from '../../data/generated/surnames-by-country.json';
import { decodeSurnameDataset } from './surnameData';

describe('surname observation data', () => {
  it('keeps exact Natural Earth country joins and explicit missing countries', () => {
    const decoded = decodeSurnameDataset(dataset);
    expect(decoded.countries).toHaveLength(75);
    expect(decoded.countriesById.get('ne-156')?.countryIso2).toBe('CN');
    expect(decoded.countriesById.get('ne-008')?.records).toEqual([]);
    expect(decoded.countriesById.get('ne-156')?.sourceUrls).toEqual([
      'https://en.wikipedia.org/wiki/List_of_most_common_surnames_in_Asian_countries',
    ]);
    expect(decoded.countriesById.get('ne-x-kosovo')?.countryIso2).toBe('XK');
  });

  it('keeps rank-one variants together without inventing missing values', () => {
    const decoded = decodeSurnameDataset(dataset);
    const china = decoded.countriesById.get('ne-156')!;
    expect(china.records).toHaveLength(1);
    expect(china.records[0]).toMatchObject({
      rank: 1,
      localForms: [{ value: '王', script: 'Han' }],
      romanizedForms: ['Wáng', 'Wong'],
      zhDisplay: '王',
      zhMethod: 'reviewed',
      count: 101500000,
      share: null,
      statYear: null,
    });

    const armenia = decoded.countriesById.get('ne-051')!;
    expect(armenia.records[0]!.zhDisplay).toBeNull();
    expect(armenia.records[0]!.zhMethod).toBe('missing');
    expect(armenia.records[0]!.share).toBeNull();
  });

  it('rejects malformed rows instead of silently accepting them', () => {
    expect(() =>
      decodeSurnameDataset({
        ...dataset,
        countries: {
          'ne-156': {
            countryIso2: 'CN',
            sourceUrls: [],
            records: [{ rank: 1, localForms: [] }],
          },
        },
      }),
    ).toThrow();
  });
});
