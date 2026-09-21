import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CSV_URL =
  'https://raw.githubusercontent.com/sigpwned/popular-names-by-country-dataset/v1.2/common-surnames-by-country.csv';
const COUNTRY_INFO_URL =
  'https://download.geonames.org/export/dump/countryInfo.txt';
const CSV_SHA256 =
  '32cb28bea558a9d353feeef097da03c6488a4e7ba9398e5983cee2f0b9caa91c';
const COUNTRY_INFO_SHA256 =
  '93bafc525813f22e4711ff9ed6d626343094ce48c26388dc7c49189b3d7d5512';

const reviewedChinese = new Map([
  ['CN:CN-1', '王'],
  ['TW:TW-1', '陈'],
  ['KR:KR-1', '金'],
  ['JP:JP-1', '佐藤'],
  ['VN:VN-1', '阮'],
]);

const wikipediaSourceUrls = {
  asia: 'https://en.wikipedia.org/wiki/List_of_most_common_surnames_in_Asian_countries',
  europe:
    'https://en.wikipedia.org/wiki/List_of_most_common_surnames_in_European_countries',
  northAmerica:
    'https://en.wikipedia.org/wiki/List_of_most_common_surnames_in_North_American_countries',
  oceania:
    'https://en.wikipedia.org/wiki/List_of_most_common_surnames_in_Oceanian_countries',
  southAmerica:
    'https://en.wikipedia.org/wiki/List_of_most_common_surnames_in_South_American_countries',
};

const wikipediaCountryRegions = new Map([
  ...[
    'AM',
    'AZ',
    'BD',
    'CN',
    'IN',
    'IL',
    'JP',
    'KH',
    'KR',
    'KZ',
    'LK',
    'NP',
    'PH',
    'TR',
    'TW',
    'VN',
  ].map((country) => [country, 'asia']),
  ...[
    'AL',
    'AT',
    'BA',
    'BE',
    'BG',
    'BY',
    'CH',
    'CZ',
    'DE',
    'DK',
    'EE',
    'ES',
    'FI',
    'FO',
    'FR',
    'GB',
    'GE',
    'GR',
    'HR',
    'HU',
    'IE',
    'IS',
    'IT',
    'LT',
    'LU',
    'LV',
    'MD',
    'ME',
    'MK',
    'MT',
    'NL',
    'NO',
    'PL',
    'PT',
    'RO',
    'RS',
    'RU',
    'SI',
    'SK',
    'SR',
    'UA',
    'XK',
  ].map((country) => [country, 'europe']),
  ...['CA', 'US'].map((country) => [country, 'northAmerica']),
  ...['AU', 'FJ', 'NZ'].map((country) => [country, 'oceania']),
  ...['AR', 'BR', 'CL', 'CO', 'PE', 'PY'].map((country) => [
    country,
    'southAmerica',
  ]),
  ...['CR', 'CU', 'DO', 'GT', 'MX', 'SV'].map((country) => [
    country,
    'northAmerica',
  ]),
]);

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (value.startsWith('--') && process.argv[index + 1]) {
    args.set(value, process.argv[index + 1]);
    index += 1;
  }
}

const csvBytes = await loadBytes(
  args.get('--csv'),
  CSV_URL,
  CSV_SHA256,
  join(tmpdir(), 'mundus-common-surnames-by-country.csv'),
);
const countryInfoBytes = await loadBytes(
  args.get('--country-info'),
  COUNTRY_INFO_URL,
  COUNTRY_INFO_SHA256,
  join(tmpdir(), 'mundus-countryInfo.txt'),
);

const countryCodes = parseCountryInfo(countryInfoBytes.toString('utf8'));
const parsedRows = parseCsv(csvBytes.toString('utf8'));
const sourceCountryCodes = new Set(parsedRows.map((row) => row.Country));
const rows = parsedRows
  .filter((row) => row.Rank === 1)
  .sort((a, b) => a.Country.localeCompare(b.Country) || a.Index - b.Index);
const byCountry = new Map();
for (const row of rows) {
  const country = byCountry.get(row.Country) ?? [];
  byCountry.set(row.Country, country);
  const key = `${row.Country}:${row['Name Group']}`;
  let record = country.find((candidate) => candidate.key === key);
  if (!record) {
    record = {
      key,
      rank: row.Rank,
      localForms: [],
      romanizedForms: [],
      count: parseNumber(row.Count),
      share: parseNumber(row.Percent),
      statYear: null,
    };
    country.push(record);
  }
  if (row['Localized Name']) {
    record.localForms.push({
      value: row['Localized Name'],
      script: detectScript(row['Localized Name']),
    });
  }
  if (row['Romanized Name']) record.romanizedForms.push(row['Romanized Name']);
  if (record.count === null) record.count = parseNumber(row.Count);
  if (record.share === null) record.share = parseNumber(row.Percent);
}

const countries = {};
for (const countryIso2 of [...sourceCountryCodes].sort()) {
  const numeric = countryCodes.get(countryIso2);
  if (!numeric)
    throw new Error(`Missing countryInfo numeric code for ${countryIso2}`);
  const countryId = numeric === '000' ? 'ne-x-kosovo' : `ne-${numeric}`;
  const sourceRegion = wikipediaCountryRegions.get(countryIso2);
  if (!sourceRegion) {
    throw new Error(`Missing Wikipedia source region for ${countryIso2}`);
  }
  const records = (byCountry.get(countryIso2) ?? []).map((record) => ({
    rank: record.rank,
    localForms: uniqueLocalForms(record.localForms),
    romanizedForms: uniqueStrings(record.romanizedForms),
    zhDisplay: reviewedChinese.get(record.key) ?? null,
    zhMethod: reviewedChinese.has(record.key) ? 'reviewed' : 'missing',
    count: record.count,
    share: record.share,
    statYear: record.statYear,
  }));
  countries[countryId] = {
    countryIso2,
    sourceUrls: [wikipediaSourceUrls[sourceRegion]],
    records,
  };
}

const output = {
  schemaVersion: 1,
  sourceSnapshot:
    'sigpwned/popular-names-by-country-dataset v1.2; source lists collected during the week of 2023-07-08',
  sourceKind: 'community',
  sourceUrl: [
    'https://github.com/sigpwned/popular-names-by-country-dataset/tree/v1.2',
    'https://en.wikipedia.org/wiki/Lists_of_most_common_surnames',
    ...new Set(Object.values(wikipediaSourceUrls)),
  ],
  license:
    'Dataset repository CC0; upstream Wikipedia list pages are generally CC BY-SA 4.0.',
  coverageNote:
    'Community-compiled source-listed records, not a unified official global ranking. Rank-one records are absent for some countries in this snapshot.',
  countries,
};

const outputPath =
  args.get('--output') ?? 'src/data/generated/surnames-by-country.json';
await mkdir(join(outputPath, '..'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`wrote ${outputPath}`);
console.log(
  `countries=${Object.keys(countries).length} rankOneRows=${rows.length}`,
);

async function loadBytes(path, url, expectedSha256, fallbackPath) {
  const bytes = path ? await readFile(path) : await fetchBytes(url);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedSha256) {
    throw new Error(`${url}: expected ${expectedSha256}, received ${actual}`);
  }
  if (!path) await writeFile(fallbackPath, bytes);
  return bytes;
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function parseCountryInfo(text) {
  const result = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const fields = line.split('\t');
    const code = fields[0];
    const numeric = fields[2];
    if (/^[A-Z]{2}$/.test(code) && /^\d+$/.test(numeric)) {
      result.set(code, numeric.padStart(3, '0'));
    }
  }
  return result;
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const headers = parseCsvLine(lines.shift());
  return lines
    .map((line) => {
      const fields = parseCsvLine(line);
      return Object.fromEntries(
        headers.map((header, index) => [header, fields[index] ?? '']),
      );
    })
    .map((row) => ({
      ...row,
      Rank: Number(row.Rank),
      Index: Number(row.Index),
    }));
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function parseNumber(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function uniqueLocalForms(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = `${value.value}\u0000${value.script ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectScript(value) {
  if (/\p{Script=Han}/u.test(value)) return 'Han';
  if (/\p{Script=Latin}/u.test(value)) return 'Latin';
  if (/\p{Script=Cyrillic}/u.test(value)) return 'Cyrillic';
  if (/\p{Script=Greek}/u.test(value)) return 'Greek';
  if (/\p{Script=Armenian}/u.test(value)) return 'Armenian';
  if (/\p{Script=Georgian}/u.test(value)) return 'Georgian';
  if (/\p{Script=Arabic}/u.test(value)) return 'Arabic';
  if (/\p{Script=Devanagari}/u.test(value)) return 'Devanagari';
  if (/\p{Script=Bengali}/u.test(value)) return 'Bengali';
  if (/\p{Script=Khmer}/u.test(value)) return 'Khmer';
  if (/\p{Script=Hebrew}/u.test(value)) return 'Hebrew';
  return null;
}
