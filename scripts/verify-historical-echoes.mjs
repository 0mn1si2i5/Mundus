import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_SOURCE_IDENTITY,
  auditHasErrors,
  auditRecords,
  validateMetadata,
} from './audit-historical-echoes.mjs';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(
  root,
  'src/data/manifests/wikidata-historical-echoes-2026-08-10.json',
);
const artifactPath = resolve(root, 'src/data/generated/historical-echoes.json');
const metadataPath = resolve(
  root,
  'src/data/generated/historical-echoes.metadata.json',
);

async function main() {
  const [manifestBytes, artifactBytes, metadataBytes] = await Promise.all([
    readFile(manifestPath),
    readFile(artifactPath),
    readFile(metadataPath),
  ]);
  const manifest = JSON.parse(manifestBytes);
  const records = JSON.parse(artifactBytes);
  const metadata = JSON.parse(metadataBytes);
  const errors = validateSourceBinding(manifest, metadata);

  const artifactIdentity = manifest.derivedAsset;
  if (
    artifactIdentity?.path !== 'src/data/generated/historical-echoes.json' ||
    artifactIdentity.sha256 !== sha256(artifactBytes) ||
    artifactIdentity.rawBytes !== artifactBytes.byteLength ||
    manifest.recordCount !== records.length
  ) {
    errors.push(
      'manifest derived artifact identity does not match the artifact',
    );
  }

  const auditIdentity = manifest.auditMetadata;
  if (
    auditIdentity?.path !==
      'src/data/generated/historical-echoes.metadata.json' ||
    auditIdentity.sha256 !== sha256(metadataBytes) ||
    auditIdentity.rawBytes !== metadataBytes.byteLength
  ) {
    errors.push('manifest audit metadata identity does not match metadata');
  }

  const typeClosure = new Map(
    (metadata?.closure?.classes ?? []).map(({ id, root, distance }) => [
      id,
      { root, distance },
    ]),
  );
  const report = auditRecords(records, { typeClosure });
  report.metadataErrors = validateMetadata(metadata, records, artifactBytes, {
    expectedClosureFingerprint: auditIdentity?.closureFingerprint,
  });
  if (auditHasErrors(report)) {
    errors.push('Historical Echoes artifact audit failed');
  }

  process.stdout.write(
    `${JSON.stringify({ manifest: manifestPath, artifact: artifactPath, metadata: metadataPath, errors, report }, null, 2)}\n`,
  );
  if (errors.length > 0) process.exitCode = 1;
}

export function validateSourceBinding(manifest, metadata) {
  if (
    !isDeepStrictEqual(manifest?.sourceSnapshot, EXPECTED_SOURCE_IDENTITY) ||
    !isDeepStrictEqual(metadata?.source, EXPECTED_SOURCE_IDENTITY) ||
    !isDeepStrictEqual(manifest?.sourceSnapshot, metadata?.source)
  ) {
    return [
      'manifest source snapshot, metadata source, and pinned source identity must match',
    ];
  }
  return [];
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export { artifactPath, metadataPath, manifestPath };

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
