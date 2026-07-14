import type { Locale } from '../../i18n/messages';
import type { GeoPoint } from '../globe/geo';

export interface CityEntry {
  id: string;
  name: Record<Locale, string>;
  country: Record<Locale, string>;
  point: GeoPoint;
}

export const FEATURED_CITIES: readonly CityEntry[] = [
  {
    id: 'shanghai',
    name: { zh: '上海', en: 'Shanghai' },
    country: { zh: '中国', en: 'China' },
    point: { latitude: 31.2304, longitude: 121.4737 },
  },
  {
    id: 'buenos-aires',
    name: { zh: '布宜诺斯艾利斯', en: 'Buenos Aires' },
    country: { zh: '阿根廷', en: 'Argentina' },
    point: { latitude: -34.6037, longitude: -58.3816 },
  },
  {
    id: 'madrid',
    name: { zh: '马德里', en: 'Madrid' },
    country: { zh: '西班牙', en: 'Spain' },
    point: { latitude: 40.4168, longitude: -3.7038 },
  },
  {
    id: 'wellington',
    name: { zh: '惠灵顿', en: 'Wellington' },
    country: { zh: '新西兰', en: 'New Zealand' },
    point: { latitude: -41.2866, longitude: 174.7756 },
  },
  {
    id: 'honolulu',
    name: { zh: '檀香山', en: 'Honolulu' },
    country: { zh: '美国', en: 'United States' },
    point: { latitude: 21.3099, longitude: -157.8581 },
  },
  {
    id: 'gaborone',
    name: { zh: '哈博罗内', en: 'Gaborone' },
    country: { zh: '博茨瓦纳', en: 'Botswana' },
    point: { latitude: -24.6282, longitude: 25.9231 },
  },
  {
    id: 'tokyo',
    name: { zh: '东京', en: 'Tokyo' },
    country: { zh: '日本', en: 'Japan' },
    point: { latitude: 35.6762, longitude: 139.6503 },
  },
  {
    id: 'new-york',
    name: { zh: '纽约', en: 'New York' },
    country: { zh: '美国', en: 'United States' },
    point: { latitude: 40.7128, longitude: -74.006 },
  },
  {
    id: 'nairobi',
    name: { zh: '内罗毕', en: 'Nairobi' },
    country: { zh: '肯尼亚', en: 'Kenya' },
    point: { latitude: -1.2921, longitude: 36.8219 },
  },
  {
    id: 'reykjavik',
    name: { zh: '雷克雅未克', en: 'Reykjavík' },
    country: { zh: '冰岛', en: 'Iceland' },
    point: { latitude: 64.1466, longitude: -21.9426 },
  },
];

export function searchCities(query: string, locale: Locale): CityEntry[] {
  const normalized = normalize(query);
  if (!normalized) return [];

  return FEATURED_CITIES.filter((city) =>
    [
      city.name.zh,
      city.name.en,
      city.country.zh,
      city.country.en,
      city.id,
    ].some((value) => normalize(value).includes(normalized)),
  )
    .sort((a, b) => {
      const aStarts = normalize(a.name[locale]).startsWith(normalized) ? 0 : 1;
      const bStarts = normalize(b.name[locale]).startsWith(normalized) ? 0 : 1;
      return aStarts - bStarts || a.name[locale].localeCompare(b.name[locale]);
    })
    .slice(0, 5);
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}
