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
    id: 'madrid',
    name: { zh: '马德里', en: 'Madrid' },
    country: { zh: '西班牙', en: 'Spain' },
    point: { latitude: 40.4168, longitude: -3.7038 },
  },
  {
    id: 'honolulu',
    name: { zh: '檀香山', en: 'Honolulu' },
    country: { zh: '美国', en: 'United States' },
    point: { latitude: 21.3099, longitude: -157.8581 },
  },
];
