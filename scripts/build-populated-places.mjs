import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(
  root,
  'src/data/manifests/natural-earth-populated-places-50m.json',
);
const outputPath = resolve(
  root,
  'src/data/generated/natural-earth-populated-places-50m.json',
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const response = await fetch(manifest.distributionUrl);

if (!response.ok) {
  throw new Error(`Natural Earth download failed: ${response.status}`);
}

const source = Buffer.from(await response.arrayBuffer());
const sourceSha256 = sha256(source);

if (sourceSha256 !== manifest.sha256) {
  throw new Error(
    `Natural Earth checksum mismatch: expected ${manifest.sha256}, received ${sourceSha256}`,
  );
}

const geojson = JSON.parse(source.toString('utf8'));
const places = geojson.features
  .map((feature) => {
    const properties = feature.properties;
    const [longitude, latitude] = feature.geometry.coordinates;
    return [
      properties.ne_id,
      properties.nameascii || properties.name,
      properties.adm0name,
      latitude,
      longitude,
      properties.pop_max ?? null,
    ];
  })
  .sort((a, b) => a[0] - b[0]);
const output = `${JSON.stringify({ formatVersion: 1, places })}\n`;
const derivedSha256 = sha256(output);

if (derivedSha256 !== manifest.derivedAssetSha256) {
  throw new Error(
    `Derived asset checksum mismatch: expected ${manifest.derivedAssetSha256}, received ${derivedSha256}`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);

console.log(
  JSON.stringify(
    {
      records: places.length,
      sourceSha256,
      derivedSha256,
      output: outputPath,
    },
    null,
    2,
  ),
);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
