import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(
  root,
  'src/data/manifests/undp-hdr-2025-development.json',
);
const outputPath = resolve(
  root,
  'src/data/generated/undp-hdr-2025-development.json',
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const crosswalkSource = manifest.auxiliarySources[0];

const [csvBytes, countryBytes] = await Promise.all([
  download(manifest.distributionUrl),
  download(crosswalkSource.distributionUrl),
]);
verifyChecksum(csvBytes, manifest.sha256, 'UNDP time series');
verifyChecksum(countryBytes, crosswalkSource.sha256, 'Natural Earth crosswalk');

const csv = new TextDecoder('windows-1252').decode(csvBytes);
const [header, ...sourceRows] = parseCsv(csv);
const column = new Map(header.map((name, index) => [name, index]));
const years = Array.from({ length: 34 }, (_, index) => 1990 + index);
const requiredColumns = [
  'iso3',
  'country',
  ...years.flatMap((year) => [
    `hdi_${year}`,
    `le_${year}`,
    `eys_${year}`,
    `mys_${year}`,
    `gnipc_${year}`,
  ]),
];
for (const name of requiredColumns) {
  if (!column.has(name))
    throw new Error(`Missing required UNDP column: ${name}`);
}

const naturalEarth = JSON.parse(new TextDecoder().decode(countryBytes));
const countryIds = buildCountryIdCrosswalk(naturalEarth.features);
const countries = sourceRows
  .filter((row) => /^[A-Z]{3}$/.test(value(row, column, 'iso3')))
  .map((row) => {
    const iso3 = value(row, column, 'iso3');
    const hdi = years.map((year) => numeric(row, column, `hdi_${year}`));
    const health = years.map((year) =>
      dimensionIndex(numeric(row, column, `le_${year}`), 20, 85),
    );
    const education = years.map((year) => {
      const expected = dimensionIndex(
        numeric(row, column, `eys_${year}`),
        0,
        18,
      );
      const mean = dimensionIndex(numeric(row, column, `mys_${year}`), 0, 15);
      return expected === null || mean === null
        ? null
        : rounded((expected + mean) / 2);
    });
    const income = years.map((year) => {
      const gni = numeric(row, column, `gnipc_${year}`);
      return gni === null || gni <= 0
        ? null
        : rounded(
            clamp(
              (Math.log(gni) - Math.log(100)) /
                (Math.log(75_000) - Math.log(100)),
            ),
          );
    });
    return [
      iso3,
      value(row, column, 'country'),
      countryIds.get(iso3) ?? null,
      hdi,
      health,
      education,
      income,
    ];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

validateCountries(countries, years.length);

const output = `${JSON.stringify({
  formatVersion: 1,
  edition: 'HDR 2025',
  years,
  indicators: ['hdi', 'health', 'education', 'income'],
  countries,
})}\n`;
const derivedSha256 = sha256(output);

if (
  manifest.derivedAssetSha256 !== 'TO_BE_GENERATED' &&
  derivedSha256 !== manifest.derivedAssetSha256
) {
  throw new Error(
    `Derived asset checksum mismatch: expected ${manifest.derivedAssetSha256}, received ${derivedSha256}`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);

console.log(
  JSON.stringify(
    {
      records: countries.length,
      mappedCountries: countries.filter((country) => country[2]).length,
      years: [years[0], years.at(-1)],
      sourceSha256: sha256(csvBytes),
      derivedSha256,
      output: outputPath,
    },
    null,
    2,
  ),
);

async function download(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Download failed (${response.status}): ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

function verifyChecksum(bytes, expected, label) {
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(
      `${label} checksum mismatch: expected ${expected}, received ${actual}`,
    );
  }
}

function buildCountryIdCrosswalk(features) {
  const result = new Map();
  for (const feature of features) {
    const properties = feature.properties;
    const iso3 =
      properties.ISO_A3 !== '-99' ? properties.ISO_A3 : properties.ADM0_A3;
    let numericCode =
      properties.ISO_N3 !== '-99' ? properties.ISO_N3 : properties.UN_A3;
    if (iso3 === 'NOR') numericCode = '578';
    if (!/^[0-9]{3}$/.test(numericCode)) continue;
    result.set(iso3, `ne-${numericCode}`);
    if (/^[A-Z]{3}$/.test(properties.ADM0_A3)) {
      result.set(properties.ADM0_A3, `ne-${numericCode}`);
    }
  }
  return result;
}

function validateCountries(countries, yearCount) {
  if (countries.length < 190) {
    throw new Error(`Unexpected UNDP country coverage: ${countries.length}`);
  }

  assertUnique(
    countries.map((country) => country[0]),
    'UNDP ISO code',
  );
  assertUnique(
    countries.map((country) => country[2]).filter(Boolean),
    'mapped Natural Earth country id',
  );

  for (const country of countries) {
    for (const series of country.slice(3)) {
      if (series.length !== yearCount) {
        throw new Error(`Unexpected series length for ${country[0]}`);
      }
      if (
        series.some(
          (entry) =>
            entry !== null &&
            (!Number.isFinite(entry) || entry < 0 || entry > 1),
        )
      ) {
        throw new Error(`Out-of-range index value for ${country[0]}`);
      }
    }
  }
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label}`);
  }
}

function dimensionIndex(actual, minimum, maximum) {
  return actual === null
    ? null
    : rounded(clamp((actual - minimum) / (maximum - minimum)));
}

function numeric(row, columns, name) {
  const raw = value(row, columns, name).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function value(row, columns, name) {
  const index = columns.get(name);
  if (index === undefined) throw new Error(`Unknown column: ${name}`);
  return row[index] ?? '';
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function rounded(value) {
  return Number(value.toFixed(4));
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
