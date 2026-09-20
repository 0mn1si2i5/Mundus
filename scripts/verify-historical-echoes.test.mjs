import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPECTED_SOURCE_IDENTITY } from './audit-historical-echoes.mjs';
import { validateSourceBinding } from './verify-historical-echoes.mjs';

test('verification binds manifest and metadata to the pinned source', () => {
  const manifest = { sourceSnapshot: EXPECTED_SOURCE_IDENTITY };
  const metadata = { source: EXPECTED_SOURCE_IDENTITY };

  assert.deepEqual(validateSourceBinding(manifest, metadata), []);

  const driftedManifest = structuredClone(manifest);
  driftedManifest.sourceSnapshot.sha256 = '0'.repeat(64);
  assert.deepEqual(validateSourceBinding(driftedManifest, metadata), [
    'manifest source snapshot, metadata source, and pinned source identity must match',
  ]);

  const driftedMetadata = structuredClone(metadata);
  driftedMetadata.source.bytes -= 1;
  assert.deepEqual(validateSourceBinding(manifest, driftedMetadata), [
    'manifest source snapshot, metadata source, and pinned source identity must match',
  ]);
});
