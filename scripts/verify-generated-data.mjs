import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const assets = [
  {
    manifest: 'src/data/manifests/natural-earth-110m.json',
    asset: 'node_modules/world-atlas/countries-110m.json',
    hashField: 'sha256',
  },
  {
    manifest: 'src/data/manifests/natural-earth-populated-places-50m.json',
    asset: 'src/data/generated/natural-earth-populated-places-50m.json',
    hashField: 'derivedAssetSha256',
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
}

if (failed) process.exitCode = 1;
