import type { Locale } from '../../i18n/messages';
import type { GeoPoint } from '../globe/geo';

export interface GeoNamesCity {
  id: number;
  name: Record<Locale, string>;
  country: Record<Locale, string>;
  admin1: Record<Locale, string> | null;
  countryCode: string;
  point: GeoPoint;
  population: number;
  featureCode: string;
  aliases: readonly string[];
  search: GeoNamesCitySearchFields;
}

export interface GeoNamesCitySearchFields {
  nameEn: string;
  nameZh: string;
  countryEn: string;
  countryZh: string;
  adminEn: string;
  adminZh: string;
  aliases: readonly string[];
}

export interface NearestMajorCity {
  city: GeoNamesCity;
  distanceKm: number;
}

type DataImporter = () => Promise<{ default: unknown }>;

let importer: DataImporter | null = null;
let cityPromise: Promise<readonly GeoNamesCity[]> | null = null;

export function decodeGeoNamesCityIndex(
  value: unknown,
): readonly GeoNamesCity[] {
  if (
    !isObject(value) ||
    value.formatVersion !== 1 ||
    !Array.isArray(value.strings) ||
    !Array.isArray(value.rows)
  ) {
    throw new Error('Invalid GeoNames city index schema');
  }
  const strings = value.strings;
  if (!strings.every((entry) => typeof entry === 'string')) {
    throw new Error('Invalid GeoNames string table');
  }
  const seen = new Set<number>();
  const normalized = new Map<string, string>();
  const normalize = (text: string) => {
    const cached = normalized.get(text);
    if (cached !== undefined) return cached;
    const result = normalizeCityQuery(text);
    normalized.set(text, result);
    return result;
  };
  return value.rows.map((raw) => {
    if (!Array.isArray(raw) || raw.length !== 13)
      throw new Error('Invalid GeoNames city row');
    const [
      id,
      latitudeE5,
      longitudeE5,
      population,
      rank,
      countryCode,
      nameEn,
      nameZh,
      countryEn,
      countryZh,
      adminEn,
      adminZh,
      aliases,
    ] = raw;
    if (!Number.isSafeInteger(id) || seen.has(id as number))
      throw new Error(`Invalid or duplicate GeoNames city ID: ${String(id)}`);
    seen.add(id as number);
    if (
      !Number.isInteger(latitudeE5) ||
      Math.abs(latitudeE5 as number) > 9_000_000 ||
      !Number.isInteger(longitudeE5) ||
      Math.abs(longitudeE5 as number) > 18_000_000
    ) {
      throw new Error(`Invalid GeoNames coordinate: ${String(id)}`);
    }
    if (
      !Number.isSafeInteger(population) ||
      (population as number) < 0 ||
      ![0, 1, 2].includes(rank as number) ||
      !Array.isArray(aliases)
    ) {
      throw new Error(`Invalid GeoNames city values: ${String(id)}`);
    }
    const stringAt = (index: unknown, nullable = false) => {
      if (nullable && index === null) return null;
      if (
        !Number.isInteger(index) ||
        (index as number) < 0 ||
        (index as number) >= strings.length
      ) {
        throw new Error(
          `GeoNames string table reference out of bounds: ${String(index)}`,
        );
      }
      return strings[index as number] as string;
    };
    if (!aliases.every((entry) => Number.isInteger(entry)))
      throw new Error('Invalid GeoNames alias references');
    const adminEnValue = stringAt(adminEn, true);
    const adminZhValue = stringAt(adminZh, true);
    if ((adminEnValue === null) !== (adminZhValue === null))
      throw new Error('Incomplete GeoNames admin label');
    const name = { en: stringAt(nameEn)!, zh: stringAt(nameZh)! };
    const country = { en: stringAt(countryEn)!, zh: stringAt(countryZh)! };
    const admin1 =
      adminEnValue === null ? null : { en: adminEnValue, zh: adminZhValue! };
    const aliasValues = [...new Set(aliases.map((entry) => stringAt(entry)!))];
    return {
      id: id as number,
      point: {
        latitude: (latitudeE5 as number) / 100_000,
        longitude: (longitudeE5 as number) / 100_000,
      },
      population: population as number,
      featureCode: rank === 0 ? 'PPLC' : rank === 1 ? 'PPLA' : 'PPL',
      countryCode: stringAt(countryCode)!,
      name,
      country,
      admin1,
      aliases: aliasValues,
      search: {
        nameEn: normalize(name.en),
        nameZh: normalize(name.zh),
        countryEn: normalize(country.en),
        countryZh: normalize(country.zh),
        adminEn: admin1 ? normalize(admin1.en) : '',
        adminZh: admin1 ? normalize(admin1.zh) : '',
        aliases: aliasValues.map(normalize),
      },
    };
  });
}

export function normalizeCityQuery(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('und')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchGeoNamesCities(
  cities: readonly GeoNamesCity[],
  query: string,
  locale: Locale,
): GeoNamesCity[] {
  const normalized = normalizeCityQuery(query);
  if (
    !normalized ||
    (!/\p{Script=Han}/u.test(normalized) && normalized.length < 2)
  )
    return [];
  const best: { city: GeoNamesCity; score: number }[] = [];
  for (const city of cities) {
    const fields = city.search;
    const display = locale === 'en' ? fields.nameEn : fields.nameZh;
    const other = locale === 'en' ? fields.nameZh : fields.nameEn;
    const country = locale === 'en' ? fields.countryEn : fields.countryZh;
    const otherCountry = locale === 'en' ? fields.countryZh : fields.countryEn;
    const admin = locale === 'en' ? fields.adminEn : fields.adminZh;
    const otherAdmin = locale === 'en' ? fields.adminZh : fields.adminEn;
    const aliases = fields.aliases;
    let score: number | null = null;
    if (display === normalized) score = 0;
    else if (other === normalized || includesExact(aliases, normalized))
      score = 1;
    else if (display.startsWith(normalized)) score = 2;
    else if (
      other.startsWith(normalized) ||
      includesPrefix(aliases, normalized)
    )
      score = 3;
    else if (
      tokenStartsWith(display, normalized) ||
      tokenStartsWith(other, normalized) ||
      includesTokenPrefix(aliases, normalized)
    )
      score = 4;
    else if (
      display.includes(normalized) ||
      other.includes(normalized) ||
      includesSubstring(aliases, normalized)
    )
      score = 5;
    else if (
      country.includes(normalized) ||
      otherCountry.includes(normalized) ||
      admin.includes(normalized) ||
      otherAdmin.includes(normalized)
    )
      score = 6;
    if (score === null) continue;
    insertBest(best, { city, score }, locale);
  }
  return best.map((entry) => entry.city);
}

export function estimateGeoNamesDecodedBytes(
  cities: readonly GeoNamesCity[],
  serializedBytes: number,
): number {
  const normalized = new Set<string>();
  let aliasReferences = 0;
  for (const city of cities) {
    const fields = city.search;
    normalized.add(fields.nameEn);
    normalized.add(fields.nameZh);
    normalized.add(fields.countryEn);
    normalized.add(fields.countryZh);
    normalized.add(fields.adminEn);
    normalized.add(fields.adminZh);
    for (const alias of fields.aliases) normalized.add(alias);
    aliasReferences += fields.aliases.length;
  }
  let normalizedBytes = 0;
  for (const value of normalized) normalizedBytes += 24 + value.length * 2;
  const searchObjectBytes = cities.length * (64 + 6 * 8 + 24);
  const aliasReferenceBytes = aliasReferences * 8;
  return (
    serializedBytes * 4 +
    normalizedBytes +
    searchObjectBytes +
    aliasReferenceBytes
  );
}

export function findNearestMajorCity(
  point: GeoPoint,
  cities: readonly GeoNamesCity[],
): NearestMajorCity {
  if (cities.length === 0)
    throw new Error('Cannot find a nearest city in an empty index');
  let nearestCity = cities[0]!;
  let nearestDistanceKm = greatCircleDistanceKm(point, nearestCity.point);
  for (let index = 1; index < cities.length; index += 1) {
    const city = cities[index]!;
    const distanceKm = greatCircleDistanceKm(point, city.point);
    if (
      distanceKm < nearestDistanceKm ||
      (distanceKm === nearestDistanceKm &&
        (city.population > nearestCity.population ||
          (city.population === nearestCity.population &&
            city.id < nearestCity.id)))
    ) {
      nearestCity = city;
      nearestDistanceKm = distanceKm;
    }
  }
  return { city: nearestCity, distanceKm: nearestDistanceKm };
}

export function configureGeoNamesCityImporter(value: DataImporter) {
  if (!importer) importer = value;
}

export function loadGeoNamesCityIndex(): Promise<readonly GeoNamesCity[]> {
  if (cityPromise) return cityPromise;
  if (!importer)
    return Promise.reject(
      new Error('GeoNames city importer is not configured'),
    );
  cityPromise = importer()
    .then((module) => decodeGeoNamesCityIndex(module.default))
    .catch((error) => {
      cityPromise = null;
      throw error;
    });
  return cityPromise;
}

export function resetGeoNamesCityIndex() {
  cityPromise = null;
  importer = null;
}

export function setGeoNamesCityImporterForTests(value: DataImporter) {
  importer = value;
}

function featureRank(city: GeoNamesCity) {
  return city.featureCode === 'PPLC' ? 0 : city.featureCode === 'PPLA' ? 1 : 2;
}

function insertBest(
  best: { city: GeoNamesCity; score: number }[],
  candidate: { city: GeoNamesCity; score: number },
  locale: Locale,
) {
  let index = 0;
  while (
    index < best.length &&
    compareResult(best[index]!, candidate, locale) <= 0
  )
    index += 1;
  if (index >= 6) return;
  best.splice(index, 0, candidate);
  if (best.length > 6) best.pop();
}

function compareResult(
  a: { city: GeoNamesCity; score: number },
  b: { city: GeoNamesCity; score: number },
  locale: Locale,
) {
  return (
    a.score - b.score ||
    featureRank(a.city) - featureRank(b.city) ||
    b.city.population - a.city.population ||
    a.city.name[locale].localeCompare(
      b.city.name[locale],
      locale === 'zh' ? 'zh-CN' : 'en',
    ) ||
    a.city.id - b.city.id
  );
}

function includesExact(values: readonly string[], query: string) {
  for (const value of values) if (value === query) return true;
  return false;
}

function includesPrefix(values: readonly string[], query: string) {
  for (const value of values) if (value.startsWith(query)) return true;
  return false;
}

function includesSubstring(values: readonly string[], query: string) {
  for (const value of values) if (value.includes(query)) return true;
  return false;
}

function includesTokenPrefix(values: readonly string[], query: string) {
  for (const value of values) if (tokenStartsWith(value, query)) return true;
  return false;
}

function tokenStartsWith(value: string, query: string) {
  if (value.startsWith(query)) return true;
  let space = value.indexOf(' ');
  while (space >= 0) {
    if (value.startsWith(query, space + 1)) return true;
    space = value.indexOf(' ', space + 1);
  }
  return false;
}

function greatCircleDistanceKm(a: GeoPoint, b: GeoPoint) {
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
