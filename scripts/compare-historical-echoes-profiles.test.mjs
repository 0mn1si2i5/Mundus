import assert from 'node:assert/strict';
import test from 'node:test';
import { compareProfiles } from './compare-historical-echoes-profiles.mjs';

function profile(records, metadata = {}) {
  return { records, metadata };
}

test('compares shared, profile-only, and semantic record differences', () => {
  const current = profile(
    [
      {
        id: 'Q2',
        label: 'same',
        coordinates: { latitude: 1 },
        start: { time: '+0100' },
        type: 'current-type',
        typeClass: 'Q1',
        provenance: { type: { distance: 1 }, start: { property: 'P571' } },
      },
      { id: 'Q10', label: 'current-only' },
    ],
    {
      profile: 'current',
      seedRoots: ['Q1'],
      source: { sha256: 'source' },
      closure: { size: 2, fingerprint: 'current-closure' },
      input: { entities: 10, parseErrors: 0, p279Edges: 4, p279Deprecated: 1 },
    },
  );
  const baseline = profile(
    [
      {
        id: 'Q2',
        label: 'same',
        coordinates: { latitude: 1 },
        start: { time: '+0100' },
        type: 'baseline-type',
        typeClass: 'Q9',
        provenance: { type: { distance: 2 }, start: { property: 'P571' } },
      },
      { id: 'Q3', label: 'baseline-only' },
    ],
    {
      profile: 'phase0',
      seedRoots: ['Q9'],
      source: { sha256: 'source' },
      closure: { size: 3, fingerprint: 'baseline-closure' },
      input: { entities: 10, parseErrors: 0, p279Edges: 5, p279Deprecated: 1 },
    },
  );

  const result = compareProfiles({ current, baseline });
  assert.deepEqual(result.records, {
    current: 2,
    baseline: 2,
    shared: 1,
    currentOnly: 1,
    baselineOnly: 1,
    sharedSemanticAgreement: 1,
    sharedSemanticDifferences: 0,
    sharedFullRecordDifferences: 1,
    fieldDifferenceCounts: {
      label: 0,
      coordinates: 0,
      start: 0,
      type: 1,
      typeClass: 1,
      'provenance.type': 1,
      'provenance.start': 0,
      'provenance.coordinate': 0,
      'provenance.labelLanguage': 0,
    },
    currentOnlySample: ['Q10'],
    baselineOnlySample: ['Q3'],
    sharedIdSha256: result.records.sharedIdSha256,
    currentOnlyIdSha256: result.records.currentOnlyIdSha256,
    baselineOnlyIdSha256: result.records.baselineOnlyIdSha256,
  });
  assert.equal(result.metadata.sourceIdentityEqual, true);
  assert.equal(result.metadata.currentInput.p279Edges, 4);
  assert.equal(result.metadata.baselineInput.p279Edges, 5);
});

test('rejects duplicate record ids', () => {
  assert.throws(
    () =>
      compareProfiles({
        current: profile([{ id: 'Q1' }, { id: 'Q1' }]),
        baseline: profile([]),
      }),
    /Duplicate record id: Q1/u,
  );
});
