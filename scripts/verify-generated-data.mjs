import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const assets = [
  {
    manifest: 'src/data/manifests/natural-earth-110m.json',
    asset: 'node_modules/world-atlas/countries-110m.json',
    hashField: 'sha256',
  },
  {
    manifest: 'src/data/manifests/geonames-major-cities.json',
    asset: 'src/data/generated/geonames-major-cities.json',
    hashField: 'derivedAssetSha256',
    budgets: true,
  },
  {
    manifest: 'src/data/manifests/undp-hdr-2025-development.json',
    asset: 'src/data/generated/undp-hdr-2025-development.json',
    hashField: 'derivedAssetSha256',
  },
];

let failed = false;
for (const entry of assets) {
  const [manifestBytes, assetBytes] = await Promise.all([
    readFile(entry.manifest),
    readFile(entry.asset),
  ]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const expected = manifest[entry.hashField];
  const actual = createHash('sha256').update(assetBytes).digest('hex');
  if (typeof expected !== 'string' || actual !== expected) {
    failed = true;
    console.error(
      `${entry.asset}: expected ${String(expected)}, received ${actual}`,
    );
  } else {
    console.log(`${entry.asset}: verified ${actual}`);
  }
  if (entry.budgets) {
    const parsed = JSON.parse(assetBytes.toString('utf8'));
    const measurements = {
      recordCount: parsed.rows?.length,
      rawBytes: assetBytes.byteLength,
      gzipBytes: gzipSync(assetBytes, { level: 9, mtime: 0 }).byteLength,
      staticDecodedBytesEstimate: assetBytes.byteLength * 4,
      runtimeDecodedBytesEstimate: estimateRuntimeDecodedBytes(
        parsed,
        assetBytes.byteLength,
      ),
    };
    for (const [field, actualValue] of Object.entries(measurements)) {
      if (actualValue !== manifest[field]) {
        failed = true;
        console.error(
          `${entry.asset}: ${field} expected ${manifest[field]}, received ${actualValue}`,
        );
      }
    }
    if (
      measurements.recordCount > 10_000 ||
      measurements.rawBytes > 1.5 * 1024 * 1024 ||
      measurements.gzipBytes > 450 * 1024 ||
      manifest.runtimeDecodedBytesEstimate > 8 * 1024 * 1024
    ) {
      failed = true;
      console.error(`${entry.asset}: GeoNames budget exceeded`);
    }
  }
}

if (failed) process.exitCode = 1;

function estimateRuntimeDecodedBytes(asset, serializedBytes) {
  // Keep in sync with the fixed-vector-tested build/runtime estimator.
  const normalized = new Set();
  let aliasReferences = 0;
  for (const row of asset.rows) {
    for (const index of row.slice(6, 12)) {
      normalized.add(index === null ? '' : normalize(asset.strings[index]));
    }
    for (const index of row[12]) {
      normalized.add(normalize(asset.strings[index]));
      aliasReferences += 1;
    }
  }
  let normalizedBytes = 0;
  for (const value of normalized) normalizedBytes += 24 + value.length * 2;
  return (
    serializedBytes * 4 +
    normalizedBytes +
    asset.rows.length * (64 + 6 * 8 + 24) +
    aliasReferences * 8
  );
}

function normalize(value) {
  return value
    .trim()
    .toLocaleLowerCase('und')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
