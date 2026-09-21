import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const SOURCES = {
  '50m': {
    path: 'node_modules/world-atlas/countries-50m.json',
    url: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json',
    sha256: '04342cdc1e3016bcd7db1630de95684d67b79fe3c8c460321e87aef469502394',
  },
  '110m': {
    path: 'node_modules/world-atlas/countries-110m.json',
    url: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',
    sha256: '2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8',
  },
};

const { computeCountryLabelAnchor, getCountryLabelClearance } =
  await import('../src/features/globe/countryLabel.ts');

const sourceBytes = await Promise.all(
  Object.values(SOURCES).map(async (source) => {
    const bytes = await readFile(source.path);
    const actual = sha256(bytes);
    if (actual !== source.sha256) {
      throw new Error(
        `${source.path}: expected ${source.sha256}, received ${actual}`,
      );
    }
    return bytes;
  }),
);
const features = Object.fromEntries(
  Object.keys(SOURCES).map((detail, index) => [
    detail,
    topologyFeatures(JSON.parse(sourceBytes[index].toString('utf8'))),
  ]),
);
const byDetail = Object.fromEntries(
  Object.entries(features).map(([detail, countries]) => [
    detail,
    new Map(
      countries.map((country) => [country.properties.countryId, country]),
    ),
  ]),
);

const anchors = {};
const skipped = [];
for (const [countryId, highResolution] of byDetail['50m']) {
  const lowResolution = byDetail['110m'].get(countryId);
  const candidates = [highResolution, lowResolution].filter(Boolean);
  const viable = candidates
    .map((country) => computeCountryLabelAnchor(country))
    .filter((anchor) => anchor !== null)
    .filter((anchor) =>
      [highResolution, lowResolution]
        .filter(Boolean)
        .every((country) =>
          geoContains(country, [anchor.point.longitude, anchor.point.latitude]),
        ),
    )
    .map((anchor) => ({
      anchor,
      clearanceDegrees: Math.min(
        ...[highResolution, lowResolution]
          .filter(Boolean)
          .map((country) => getCountryLabelClearance(country, anchor.point)),
      ),
    }))
    .filter(({ clearanceDegrees }) => clearanceDegrees > 0);

  const best = viable.toSorted(
    (a, b) =>
      b.clearanceDegrees - a.clearanceDegrees ||
      a.anchor.point.latitude - b.anchor.point.latitude ||
      a.anchor.point.longitude - b.anchor.point.longitude,
  )[0];
  if (!best) {
    skipped.push(countryId);
    continue;
  }
  anchors[countryId] = {
    point: {
      latitude: round(best.anchor.point.latitude),
      longitude: round(best.anchor.point.longitude),
    },
    clearanceDegrees: round(best.clearanceDegrees),
  };
}

const output = {
  schemaVersion: 1,
  sourceName: 'Natural Earth Admin 0 country polygons',
  sourceDetail: '50m anchors cross-checked against 110m picking geometry',
  sourceAssets: Object.fromEntries(
    Object.entries(SOURCES).map(([detail, source]) => [
      detail,
      {
        distributionUrl: source.url,
        sha256: source.sha256,
      },
    ]),
  ),
  anchors,
};
await writeFile(
  'src/data/generated/country-label-anchors.json',
  `${JSON.stringify(output)}\n`,
);
console.log(
  JSON.stringify({
    anchorCount: Object.keys(anchors).length,
    skipped,
    output: 'src/data/generated/country-label-anchors.json',
  }),
);

function topologyFeatures(topology) {
  const merged = new Map();
  for (const country of feature(topology, topology.objects.countries)
    .features) {
    const countryId = countryIdFor(country.id, country.properties.name);
    const normalized = {
      ...country,
      properties: { ...country.properties, countryId },
    };
    const existing = merged.get(countryId);
    if (!existing) {
      merged.set(countryId, normalized);
      continue;
    }
    existing.geometry = {
      type: 'MultiPolygon',
      coordinates: [
        ...asPolygons(existing.geometry),
        ...asPolygons(normalized.geometry),
      ],
    };
  }
  return [...merged.values()];
}

function asPolygons(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function countryIdFor(sourceId, sourceName) {
  if (sourceId !== undefined && sourceId !== null) {
    return `ne-${String(sourceId).padStart(3, '0')}`;
  }
  const exception = {
    'N. Cyprus': 'ne-x-northern-cyprus',
    Somaliland: 'ne-x-somaliland',
    Kosovo: 'ne-x-kosovo',
    'Indian Ocean Ter.': 'ne-x-indian-ocean-territories',
    'Siachen Glacier': 'ne-x-siachen-glacier',
  }[sourceName];
  if (!exception)
    throw new Error(`Missing countryId mapping for ${sourceName}`);
  return exception;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function round(value) {
  return Number(value.toFixed(6));
}
