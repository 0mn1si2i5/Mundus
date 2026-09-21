import { describe, expect, it } from 'vitest';
import dataset from '../../data/generated/surnames-by-country.json';
import { decodeSurnameDataset, getRankOneSurnameRecord } from './surnameData';

describe('surname observation data', () => {
  it('keeps exact Natural Earth country joins and explicit source coverage', () => {
    const decoded = decodeSurnameDataset(dataset);
    expect(decoded.countries).toHaveLength(76);
    expect(decoded.countriesById.get('ne-156')?.countryIso2).toBe('CN');
    expect(decoded.countriesById.get('ne-008')?.records[0]).toMatchObject({
      rank: null,
      localForms: [{ value: 'Hoxha', script: 'Latin' }],
    });
    expect(decoded.countriesById.get('ne-156')?.sourceUrls).toEqual([
      'https://en.wikipedia.org/wiki/List_of_most_common_surnames_in_Asian_countries',
    ]);
    expect(decoded.countriesById.get('ne-x-kosovo')?.countryIso2).toBe('XK');
    expect(decoded.countriesById.get('ne-364')?.records[0]).toMatchObject({
      rank: 1,
      localForms: [{ value: 'محمدی', script: 'Arabic' }],
      romanizedForms: ['Mohammadi'],
      share: 0.0085581142730807,
    });
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

    const greece = decoded.countriesById.get('ne-300')!;
    expect(greece.records[0]).toMatchObject({
      rank: null,
      localForms: [{ value: 'Σαμαράς', script: 'Greek' }],
    });
  });

  it('does not promote an unranked source list to the map finding', () => {
    const decoded = decodeSurnameDataset(dataset);
    expect(getRankOneSurnameRecord(decoded.countriesById.get('ne-300'))).toBe(
      null,
    );
    expect(
      getRankOneSurnameRecord(decoded.countriesById.get('ne-156'))?.rank,
    ).toBe(1);
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
