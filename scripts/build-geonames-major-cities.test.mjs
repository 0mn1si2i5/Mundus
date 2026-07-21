import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  buildCompactIndex,
  buildFeasibilityIndex,
  chooseLocalizedNames,
  candidateIncludesCity,
  ensureSourceFiles,
  estimateRuntimeDecodedBytes,
  readZipLines,
  isEligibleCity,
  hasExactJoins,
  parseAdmin1Row,
  parseAlternateNameRow,
  parseCityRow,
  parseCountryRow,
  selectCompactAliases,
  simplifyExistingChineseNames,
  writeGeneratedAssetAtomically,
} from './build-geonames-major-cities.mjs';

const cityRow = ({
  id = '1816670',
  name = 'Beijing',
  ascii = 'Beijing',
  aliases = 'Peking,北京',
  latitude = '39.9075',
  longitude = '116.39723',
  featureClass = 'P',
  featureCode = 'PPLC',
  countryCode = 'CN',
  admin1Code = '22',
  population = '11716620',
} = {}) =>
  [
    id,
    name,
    ascii,
    aliases,
    latitude,
    longitude,
    featureClass,
    featureCode,
    countryCode,
    '',
    admin1Code,
    '',
    '',
    '',
    population,
    '',
    '',
    'Asia/Shanghai',
    '2025-09-24',
  ].join('\t');

test('parses the 19-column city contract and rejects malformed coordinates', () => {
  assert.deepEqual(parseCityRow(cityRow()), {
    id: 1816670,
    canonicalName: 'Beijing',
    asciiName: 'Beijing',
    sourceAliases: ['Peking', '北京'],
    latitude: 39.9075,
    longitude: 116.39723,
    featureClass: 'P',
    featureCode: 'PPLC',
    countryCode: 'CN',
    admin1Code: '22',
    population: 11716620,
  });
  assert.equal(parseCityRow(cityRow({ latitude: 'north' })), null);
  assert.equal(
    parseCityRow(cityRow().split('\t').slice(0, 18).join('\t')),
    null,
  );
});

test('applies the active populated-place eligibility policy', () => {
  assert.equal(isEligibleCity(parseCityRow(cityRow())), true);
  assert.equal(
    isEligibleCity(
      parseCityRow(cityRow({ featureCode: 'PPLA', population: '0' })),
    ),
    true,
  );
  assert.equal(
    isEligibleCity(
      parseCityRow(cityRow({ featureCode: 'PPL', population: '99999' })),
    ),
    false,
  );
  assert.equal(
    isEligibleCity(
      parseCityRow(cityRow({ featureCode: 'PPLX', population: '900000' })),
    ),
    false,
  );
  assert.equal(
    isEligibleCity(
      parseCityRow(cityRow({ featureClass: 'S', population: '900000' })),
    ),
    false,
  );
});

test('parses exact country, admin-1, and current alternate-name identities', () => {
  const countryColumns = Array(19).fill('');
  countryColumns[0] = 'CN';
  countryColumns[4] = 'China';
  countryColumns[16] = '1814991';
  assert.deepEqual(parseCountryRow(countryColumns.join('\t')), {
    code: 'CN',
    name: 'China',
    geoNameId: 1814991,
  });
  assert.deepEqual(parseAdmin1Row('CN.22\tBeijing\tBeijing\t2038349'), {
    key: 'CN.22',
    name: 'Beijing',
    geoNameId: 2038349,
  });
  assert.deepEqual(
    parseAlternateNameRow('1\t1816670\tzh-CN\t北京\t1\t0\t0\t0\t\t'),
    {
      id: 1,
      geoNameId: 1816670,
      language: 'zh-CN',
      name: '北京',
      preferred: true,
    },
  );
  assert.equal(
    parseAlternateNameRow('2\t1816670\ten\tPeking\t0\t0\t0\t1\t\t'),
    null,
  );
  assert.equal(
    parseAlternateNameRow('3\t1816670\ten\tOld Beijing\t0\t0\t0\t0\t2020\t'),
    null,
  );
});

test('selects deterministic English and Chinese names without translation', () => {
  const names = chooseLocalizedNames('Beijing', [
    { id: 4, language: 'zh', name: '北京市', preferred: false },
    { id: 3, language: 'zh-Hans', name: '北京', preferred: true },
    { id: 2, language: 'en', name: 'Peking', preferred: false },
    { id: 1, language: 'en', name: 'Beijing', preferred: true },
  ]);
  assert.deepEqual(names, {
    en: 'Beijing',
    zh: '北京',
    enFallback: false,
    zhFallback: false,
  });
  assert.equal(chooseLocalizedNames('Fallback', []).zh, 'Fallback');
  assert.equal(chooseLocalizedNames('Fallback', []).zhFallback, true);
});

test('builds deterministic ID-sorted tuples with exact joins and duplicate checks', () => {
  const input = {
    cities: [
      parseCityRow(cityRow({ id: '2', name: 'Shanghai', admin1Code: '23' })),
      parseCityRow(cityRow({ id: '1' })),
    ],
    countries: new Map([['CN', { code: 'CN', name: 'China', geoNameId: 10 }]]),
    admin1: new Map([
      ['CN.22', { key: 'CN.22', name: 'Beijing', geoNameId: 11 }],
      ['CN.23', { key: 'CN.23', name: 'Shanghai', geoNameId: 12 }],
    ]),
    alternateNames: new Map([
      [1, [{ id: 1, language: 'zh', name: '北京', preferred: true }]],
      [2, [{ id: 2, language: 'zh', name: '上海', preferred: true }]],
      [10, [{ id: 3, language: 'zh', name: '中国', preferred: true }]],
    ]),
  };
  const first = buildCompactIndex(input);
  const second = buildCompactIndex(input);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.rows.map((row) => row[0]),
    [1, 2],
  );
  assert.equal(first.rows[0][1], 3990750);
  assert.throws(
    () =>
      buildCompactIndex({
        ...input,
        cities: [input.cities[0], input.cities[0]],
      }),
    /Duplicate GeoNames city ID/,
  );
  assert.throws(
    () =>
      buildCompactIndex({
        ...input,
        countries: new Map(),
      }),
    /country join/,
  );
  assert.throws(
    () =>
      buildCompactIndex({
        ...input,
        cities: [{ ...input.cities[0], admin1Code: '' }],
      }),
    /admin-1 join/,
  );
});

test('treats exact country and admin-1 joins as eligibility conditions', () => {
  const city = parseCityRow(cityRow());
  const countries = new Map([
    ['CN', { code: 'CN', name: 'China', geoNameId: 10 }],
  ]);
  const admin1 = new Map([
    ['CN.22', { key: 'CN.22', name: 'Beijing', geoNameId: 11 }],
  ]);
  assert.equal(hasExactJoins(city, countries, admin1), true);
  assert.equal(
    hasExactJoins({ ...city, admin1Code: '' }, countries, admin1),
    false,
  );
  assert.equal(
    hasExactJoins({ ...city, admin1Code: '00' }, countries, admin1),
    false,
  );
  assert.equal(
    hasExactJoins({ ...city, countryCode: 'ZZ' }, countries, admin1),
    false,
  );
});

test('bounds English aliases while retaining every distinct Chinese source and derived form', () => {
  const names = [
    { id: 7, language: 'en', name: 'Peking', preferred: false },
    { id: 3, language: 'en', name: 'Beijing City', preferred: true },
    { id: 9, language: 'en', name: 'Pei-ching', preferred: false },
    { id: 4, language: 'zh', name: '北京市', preferred: true },
    { id: 5, language: 'zh-Hans', name: '京城', preferred: false },
    { id: 6, language: 'zh', name: '北平', preferred: false },
  ];
  assert.deepEqual(
    selectCompactAliases(
      { canonicalName: 'Beijing', asciiName: 'Beijing' },
      { en: 'Beijing', zh: '北京' },
      names,
    ),
    ['Beijing City', 'Peking', '北京市', '京城', '北平'],
  );
});

test('applies candidate A-D scope rules without treating fallback labels as real Chinese', () => {
  const base = parseCityRow(
    cityRow({ featureCode: 'PPL', population: '100000' }),
  );
  assert.equal(candidateIncludesCity('A', base, false), true);
  assert.equal(candidateIncludesCity('B', base, false), false);
  assert.equal(
    candidateIncludesCity('B', { ...base, population: 250000 }, false),
    true,
  );
  assert.equal(
    candidateIncludesCity('C', { ...base, population: 499999 }, false),
    false,
  );
  assert.equal(
    candidateIncludesCity('D', { ...base, population: 15000 }, true),
    true,
  );
  assert.equal(
    candidateIncludesCity('D', { ...base, population: 15000 }, false),
    false,
  );
  assert.equal(
    candidateIncludesCity(
      'D',
      { ...base, featureCode: 'PPLA', population: 0 },
      false,
    ),
    true,
  );
});

test('builds the compact feasibility encoding without coverage metadata in the asset', () => {
  const city = parseCityRow(cityRow());
  const index = buildFeasibilityIndex({
    cities: [city],
    countries: new Map([['CN', { code: 'CN', name: 'China', geoNameId: 10 }]]),
    admin1: new Map([
      ['CN.22', { key: 'CN.22', name: 'Beijing', geoNameId: 11 }],
    ]),
    alternateNames: new Map([
      [
        city.id,
        [
          { id: 1, language: 'en', name: 'Beijing', preferred: true },
          { id: 2, language: 'zh', name: '北京', preferred: true },
          { id: 3, language: 'en', name: 'Peking', preferred: false },
        ],
      ],
      [10, [{ id: 4, language: 'zh', name: '中国', preferred: true }]],
    ]),
  });
  assert.equal(index.rows.length, 1);
  assert.equal(index.coverage.cityRealZh, 1);
  assert.equal(index.asset.coverage, undefined);
  assert.equal(index.asset.strings.includes('Peking'), true);
});

test('converts only existing Chinese source names and retains traditional originals', () => {
  const converted = simplifyExistingChineseNames([
    {
      id: 1,
      geoNameId: 5128581,
      language: 'zh',
      name: '紐約市',
      preferred: true,
    },
    {
      id: 2,
      geoNameId: 1816670,
      language: 'zh',
      name: '北京',
      preferred: true,
    },
    {
      id: 3,
      geoNameId: 5128581,
      language: 'en',
      name: 'New York',
      preferred: true,
    },
  ]);
  assert.deepEqual(converted, [
    {
      id: 1,
      geoNameId: 5128581,
      language: 'zh',
      name: '纽约市',
      preferred: true,
      originalName: '紐約市',
    },
    {
      id: 2,
      geoNameId: 1816670,
      language: 'zh',
      name: '北京',
      preferred: true,
    },
    {
      id: 3,
      geoNameId: 5128581,
      language: 'en',
      name: 'New York',
      preferred: true,
    },
  ]);
  const aliases = selectCompactAliases(
    { canonicalName: 'New York City', asciiName: 'New York City' },
    { en: 'New York City', zh: '纽约市' },
    converted,
  );
  assert.equal(aliases.includes('紐約市'), true);
  assert.equal(aliases.includes('New York'), true);
});

test('retains all original and derived Chinese aliases without counting them against English aliases', () => {
  const converted = simplifyExistingChineseNames([
    { id: 1, language: 'zh', name: '紐約市', preferred: true },
    { id: 2, language: 'zh', name: '紐約', preferred: false },
    { id: 3, language: 'zh', name: '大紐約', preferred: false },
  ]);
  const aliases = selectCompactAliases(
    { canonicalName: 'New York City', asciiName: 'New York City' },
    { en: 'New York City', zh: '纽约市' },
    converted,
  );
  const chineseAliases = aliases.filter((alias) =>
    /\p{Script=Han}/u.test(alias),
  );
  assert.deepEqual(chineseAliases, [
    '紐約市',
    '纽约',
    '紐約',
    '大纽约',
    '大紐約',
  ]);
});

test('downloads missing sources atomically and verifies their checksum', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'mundus-geonames-download-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from('verified source');
  const manifest = sourceManifest('cities15000.zip', bytes);
  const requests = [];

  await ensureSourceFiles(directory, manifest, async (url) => {
    requests.push(url);
    return new Response(bytes, { status: 200 });
  });

  assert.deepEqual(requests, [manifest.distributionUrl]);
  assert.deepEqual(await readFile(join(directory, 'cities15000.zip')), bytes);
  assert.deepEqual(await readdir(directory), ['cities15000.zip']);
});

test('reuses a verified cached source without fetching', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'mundus-geonames-cache-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from('cached source');
  const manifest = sourceManifest('cities15000.zip', bytes);
  await writeFile(join(directory, 'cities15000.zip'), bytes);
  let requests = 0;

  await ensureSourceFiles(directory, manifest, async () => {
    requests += 1;
    throw new Error('verified cache must not fetch');
  });

  assert.equal(requests, 0);
});

test('rejects a mismatched download and removes its atomic temporary file', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'mundus-geonames-mismatch-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = sourceManifest('cities15000.zip', Buffer.from('expected'));

  await assert.rejects(
    ensureSourceFiles(
      directory,
      manifest,
      async () => new Response(Buffer.from('wrong'), { status: 200 }),
    ),
    /checksum mismatch/,
  );

  assert.deepEqual(await readdir(directory), []);
});

test('rejects a corrupt cached source without replacing or downloading it', async (context) => {
  const directory = await mkdtemp(
    join(tmpdir(), 'mundus-geonames-corrupt-cache-'),
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  const cached = Buffer.from('corrupt cache');
  const manifest = sourceManifest('cities15000.zip', Buffer.from('expected'));
  await writeFile(join(directory, 'cities15000.zip'), cached);
  let requests = 0;

  await assert.rejects(
    ensureSourceFiles(directory, manifest, async () => {
      requests += 1;
      return new Response(Buffer.from('expected'));
    }),
    /cached checksum mismatch/,
  );

  assert.equal(requests, 0);
  assert.deepEqual(await readFile(join(directory, 'cities15000.zip')), cached);
});

function sourceManifest(fileName, bytes) {
  return {
    distributionUrl: `https://example.test/${fileName}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    auxiliarySources: [],
  };
}

test('rejects missing and corrupt ZIP archives without yielding partial success', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'mundus-geonames-zip-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const corrupt = join(directory, 'corrupt.zip');
  await writeFile(corrupt, 'not a zip');

  await assert.rejects(
    readZipLines(join(directory, 'missing.zip'), 'cities15000.txt', () => {}),
    /unzip failed/,
  );
  await assert.rejects(
    readZipLines(corrupt, 'cities15000.txt', () => {}),
    /unzip failed/,
  );
});

test('waits for unzip close and rejects nonzero exit after stdout ends', async () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  const seen = [];
  const promise = readZipLines(
    'archive.zip',
    'member.txt',
    (line) => seen.push(line),
    () => child,
  );
  child.stdout.end('partial\n');
  queueMicrotask(() => child.emit('close', 9, null));

  await assert.rejects(promise, /unzip failed with 9/);
  assert.deepEqual(seen, ['partial']);
});

test('writes generated assets atomically and leaves no temporary file', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'mundus-geonames-output-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'cities.json');

  await writeGeneratedAssetAtomically(target, Buffer.from('complete'));

  assert.equal(await readFile(target, 'utf8'), 'complete');
  assert.deepEqual(await readdir(directory), ['cities.json']);
});

test('cleans an interrupted generated-asset temp and preserves the prior asset', async (context) => {
  const directory = await mkdtemp(
    join(tmpdir(), 'mundus-geonames-output-fail-'),
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'cities.json');
  await writeFile(target, 'prior');

  await assert.rejects(
    writeGeneratedAssetAtomically(target, Buffer.from('partial'), {
      beforeRename: async () => {
        throw new Error('interrupted');
      },
    }),
    /interrupted/,
  );

  assert.equal(await readFile(target, 'utf8'), 'prior');
  assert.deepEqual(await readdir(directory), ['cities.json']);
});

test('estimates static plus normalized runtime memory from fixed vectors', () => {
  const asset = {
    strings: ['City', '城市', 'Country', '国家', 'Admin', '行政', 'Alias'],
    rows: [[1, 0, 0, 1, 2, 0, 0, 1, 2, 3, 4, 5, [6]]],
  };
  const serializedBytes = 100;
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
  assert.equal(
    estimateRuntimeDecodedBytes(asset, serializedBytes),
    serializedBytes * 4 + normalizedBytes + (64 + 6 * 8 + 24) + 8,
  );
});
