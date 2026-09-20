import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_DENYLIST,
  EXPECTED_PROFILE,
  EXPECTED_SEED_ROOTS,
  EXPECTED_SOURCE_IDENTITY,
  EARTH_GLOBE,
  auditHasErrors,
  auditRecords,
  validateMetadata,
} from './audit-historical-echoes.mjs';

const coordinates = {
  latitude: 31.2304,
  longitude: 121.4737,
  precision: 0.0001,
  globe: EARTH_GLOBE,
};
const GREGORIAN_CALENDAR = 'http://www.wikidata.org/entity/Q1985727';
const JULIAN_CALENDAR = 'http://www.wikidata.org/entity/Q1985786';

function start(
  property = 'P571',
  time = '+1200-00-00T00:00:00Z',
  precision = 9,
) {
  return {
    property,
    time,
    precision,
    calendarmodel: GREGORIAN_CALENDAR,
    before: 0,
    after: 0,
    timezone: 0,
  };
}

function provenance(property = 'P571') {
  return {
    type: {
      rank: 'normal',
      statementId: 'P31-1',
      distance: 1,
    },
    start: { property, rank: 'normal', statementId: `${property}-1` },
    coordinate: { rank: 'normal', statementId: 'P625-1' },
    labelLanguage: 'en',
  };
}

function record(id, overrides = {}) {
  return {
    id,
    label: `Record ${id}`,
    type: 'Q811979',
    typeClass: 'Q16970',
    coordinates,
    start: start(),
    provenance: provenance(),
    ...overrides,
  };
}

function metadataFor(records) {
  const artifactBytes = Buffer.from(`${JSON.stringify(records)}\n`);
  const classes = [
    { id: 'Q16970', root: 'Q811979', distance: 1 },
    { id: 'Q56061', root: 'Q56061', distance: 0 },
    { id: 'Q486972', root: 'Q486972', distance: 0 },
    { id: 'Q811979', root: 'Q811979', distance: 0 },
    { id: 'Q839954', root: 'Q839954', distance: 0 },
  ];
  const closureFingerprint = createHash('sha256')
    .update(
      classes
        .map(({ id, root, distance }) => `${id}\t${root}\t${distance}\n`)
        .join(''),
    )
    .digest('hex');
  const countsByTypeClass = {};
  const countsByStartProperty = {};
  for (const item of records) {
    countsByTypeClass[item.typeClass] =
      (countsByTypeClass[item.typeClass] ?? 0) + 1;
    countsByStartProperty[item.start.property] =
      (countsByStartProperty[item.start.property] ?? 0) + 1;
  }
  return {
    artifactBytes,
    closureFingerprint,
    metadata: {
      schemaVersion: 1,
      profile: EXPECTED_PROFILE,
      seedRoots: EXPECTED_SEED_ROOTS,
      denylist: EXPECTED_DENYLIST,
      source: EXPECTED_SOURCE_IDENTITY,
      closure: {
        size: classes.length,
        classes,
        fingerprint: closureFingerprint,
      },
      input: {
        entities: records.length,
        parseErrors: 0,
        p31Entities: records.length,
        startClaimEntities: records.length,
        coordinateClaimEntities: records.length,
        labeledEntities: records.length,
        p279Edges: 0,
        p279Deprecated: 0,
        p31Statements: {
          preferred: 0,
          normal: records.length,
          deprecated: 0,
          valid: records.length,
        },
        startStatements: {
          preferred: 0,
          normal: records.length,
          deprecated: 0,
          valid: records.length,
        },
        coordinateStatements: {
          preferred: 0,
          normal: records.length,
          deprecated: 0,
          validEarth: records.length,
          invalid: 0,
          nonEarth: 0,
        },
      },
      qualificationStats: {
        candidates: records.length,
        typeMatched: records.length,
        labelMatched: records.length,
        coordinateMatched: records.length,
        startMatched: records.length,
        pre1500Matched: records.length,
        qualifying: records.length,
      },
      artifactStats: {
        countsByType: { Q811979: records.length },
        countsByTypeClass,
        countsByStartProperty,
        countsByStartRank: { normal: records.length },
        countsByCoordinateRank: { normal: records.length },
        countsByLabelLanguage: { en: records.length },
      },
      output: {
        path: 'historical-echoes.json',
        recordCount: records.length,
        sha256: createHash('sha256').update(artifactBytes).digest('hex'),
        bytes: artifactBytes.byteLength,
      },
    },
  };
}

test('audits a valid sorted artifact and reports distributions', () => {
  const report = auditRecords([
    record('Q1'),
    record('Q2', {
      typeClass: 'Q23413',
      start: start('P580', '-0050-00-00T00:00:00Z', 7),
      provenance: provenance('P580'),
    }),
  ]);
  assert.equal(auditHasErrors(report), false);
  assert.equal(report.recordCount, 2);
  assert.deepEqual(report.countsByTypeClass, { Q16970: 1, Q23413: 1 });
  assert.deepEqual(report.countsByStartProperty, { P571: 1, P580: 1 });
  assert.deepEqual(report.countsByPrecision, { 7: 1, 9: 1 });
  assert.equal(report.bceRecords, 1);
  assert.equal(report.coarseRecords, 1);
  assert.deepEqual(report.yearRange, { min: -50, max: 1200 });
});

test('reports missing coordinates, duplicates, ordering, and invalid dates', () => {
  const report = auditRecords([
    record('Q2', { coordinates: undefined }),
    record('Q1', {
      coordinates: {
        latitude: 91,
        longitude: 0,
        precision: 0.1,
        globe: EARTH_GLOBE,
      },
      start: start('P571', '+1500-00-00T00:00:00Z', 9),
    }),
    record('Q1'),
  ]);
  assert.equal(report.coordinateMissing, 1);
  assert.equal(report.coordinateInvalid, 1);
  assert.equal(report.dateInvalid, 1);
  assert.deepEqual(report.duplicateIds, ['Q1']);
  assert.equal(report.orderingViolations.length, 1);
  assert.equal(auditHasErrors(report), true);
});

test('strict artifact audit treats the old coordinate-free output as invalid', () => {
  const report = auditRecords([
    {
      id: 'Q1',
      label: 'Old schema',
      type: 'Q811979',
      typeClass: 'Q16970',
      start: start(),
    },
  ]);
  assert.equal(report.coordinateMissing, 1);
  assert.equal(auditHasErrors(report), true);
});

test('strict artifact audit rejects an empty artifact and invalid type IDs', () => {
  const empty = auditRecords([]);
  assert.equal(auditHasErrors(empty), true);

  const report = auditRecords([
    record('Q1', { type: 'architectural structure', typeClass: 'building' }),
  ]);
  assert.equal(report.schemaErrors.length, 1);
  assert.equal(auditHasErrors(report), true);
});

test('strict artifact audit rejects malformed calendar components and omitted precision', () => {
  const report = auditRecords([
    record('Q1', {
      coordinates: { latitude: 31, longitude: 121 },
      start: start('P571', '+1200-13-00T00:00:00Z', 9),
    }),
  ]);
  assert.equal(report.coordinateInvalid, 1);
  assert.equal(report.dateInvalid, 1);
  assert.equal(auditHasErrors(report), true);
});

test('strict artifact audit preserves calendar semantics without imposing Gregorian leap rules', () => {
  const julian = {
    ...start('P571', '+1201-02-29T00:00:00Z', 11),
    calendarmodel: JULIAN_CALENDAR,
  };
  const valid = auditRecords([record('Q1', { start: julian })]);
  assert.equal(valid.dateInvalid, 0);
  assert.equal(auditHasErrors(valid), false);
});

test('strict artifact audit requires source calendar uncertainty fields and Earth globe identity', () => {
  const missingCalendar = auditRecords([
    record('Q1', {
      start: {
        property: 'P571',
        time: '+1200-00-00T00:00:00Z',
        precision: 9,
      },
    }),
  ]);
  assert.equal(missingCalendar.dateInvalid, 1);

  const missingGlobe = auditRecords([
    record('Q1', {
      coordinates: { latitude: 31, longitude: 121, precision: 0.1 },
    }),
  ]);
  assert.equal(missingGlobe.coordinateInvalid, 1);

  const moon = auditRecords([
    record('Q1', {
      coordinates: {
        latitude: 31,
        longitude: 121,
        precision: 0.1,
        globe: 'http://www.wikidata.org/entity/Q405',
      },
    }),
  ]);
  assert.equal(moon.coordinateInvalid, 1);
});

test('strict artifact audit requires selection provenance', () => {
  const report = auditRecords([record('Q1', { provenance: undefined })]);
  assert.equal(report.provenanceMissing, 1);
  assert.equal(auditHasErrors(report), true);
});

test('strict artifact audit binds type provenance to closure distance', () => {
  const subject = record('Q1');
  const closure = new Map([['Q16970', { root: 'Q811979', distance: 2 }]]);
  const report = auditRecords([subject], { typeClosure: closure });
  assert.equal(report.provenanceInvalid, 1);
  assert.equal(auditHasErrors(report), true);
});

test('metadata validation binds the full current-profile contract', () => {
  const records = [record('Q1')];
  const fixture = metadataFor(records);
  assert.deepEqual(
    validateMetadata(fixture.metadata, records, fixture.artifactBytes, {
      expectedClosureFingerprint: fixture.closureFingerprint,
    }),
    [],
  );
});

test('metadata validation requires an independent closure fingerprint', () => {
  const records = [record('Q1')];
  const fixture = metadataFor(records);
  assert.deepEqual(
    validateMetadata(fixture.metadata, records, fixture.artifactBytes),
    [
      'an external expected closure fingerprint must be supplied as 64 lowercase hex characters',
    ],
  );
  assert.deepEqual(
    validateMetadata(fixture.metadata, records, fixture.artifactBytes, {
      expectedClosureFingerprint: '0'.repeat(64),
    }),
    [
      'metadata closure fingerprint does not match the external expected fingerprint',
    ],
  );
});

test('metadata validation rejects denylisted closure members', () => {
  const records = [record('Q1')];
  const fixture = metadataFor(records);
  const metadata = structuredClone(fixture.metadata);
  metadata.closure.classes.unshift({
    id: 'Q5',
    root: 'Q811979',
    distance: 1,
  });
  metadata.closure.size = metadata.closure.classes.length;
  metadata.closure.fingerprint = createHash('sha256')
    .update(
      metadata.closure.classes
        .map(({ id, root, distance }) => `${id}\t${root}\t${distance}\n`)
        .join(''),
    )
    .digest('hex');

  const errors = validateMetadata(metadata, records, fixture.artifactBytes, {
    expectedClosureFingerprint: metadata.closure.fingerprint,
  });
  assert.ok(
    errors.includes(
      'metadata closure.classes must exclude denylisted barrier classes',
    ),
  );
});

test('metadata validation reserves distance zero for root self-mappings', () => {
  const records = [record('Q1')];
  const fixture = metadataFor(records);
  const metadata = structuredClone(fixture.metadata);
  metadata.closure.classes[0].distance = 0;
  metadata.closure.fingerprint = createHash('sha256')
    .update(
      metadata.closure.classes
        .map(({ id, root, distance }) => `${id}\t${root}\t${distance}\n`)
        .join(''),
    )
    .digest('hex');

  const errors = validateMetadata(metadata, records, fixture.artifactBytes, {
    expectedClosureFingerprint: metadata.closure.fingerprint,
  });
  assert.ok(
    errors.includes(
      'metadata closure distance zero must be reserved for root self-mappings',
    ),
  );
});

test('metadata validation rejects contract drift and falsified statistics', () => {
  const records = [record('Q1')];
  const fixture = metadataFor(records);
  const metadata = structuredClone(fixture.metadata);
  metadata.profile = 'phase0';
  metadata.seedRoots = [...EXPECTED_SEED_ROOTS].reverse();
  metadata.denylist = EXPECTED_DENYLIST.slice(0, 3);
  metadata.source.sha256 = '0'.repeat(64);
  metadata.closure.classes[0].distance = -1;
  metadata.input.p31Statements.valid = -1;
  metadata.qualificationStats.typeMatched = 2;
  metadata.artifactStats.countsByType.Q811979 = 2;
  const errors = validateMetadata(metadata, records, fixture.artifactBytes, {
    expectedClosureFingerprint: fixture.closureFingerprint,
  });
  assert.ok(errors.includes('metadata profile must be current'));
  assert.ok(
    errors.includes(
      'metadata seedRoots must match the four reviewed current roots',
    ),
  );
  assert.ok(
    errors.includes('metadata denylist must match the reviewed denylist'),
  );
  assert.ok(
    errors.includes(
      'metadata source identity does not match the pinned Wikidata dump',
    ),
  );
  assert.ok(
    errors.includes('metadata closure.classes contains an invalid entry'),
  );
  assert.ok(
    errors.includes(
      'metadata input.p31Statements.valid must be a non-negative integer',
    ),
  );
  assert.ok(
    errors.includes('metadata qualificationStats must be a cumulative funnel'),
  );
  assert.ok(
    errors.includes('metadata artifactStats do not match the artifact'),
  );
});

test('CLI audit is strict by default and rejects missing closure authority', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-audit-'));
  try {
    const records = [record('Q1')];
    const fixture = metadataFor(records);
    const artifactPath = join(directory, 'historical-echoes.json');
    const metadataPath = join(directory, 'historical-echoes.metadata.json');
    writeFileSync(artifactPath, fixture.artifactBytes);
    writeFileSync(
      metadataPath,
      `${JSON.stringify(fixture.metadata, null, 2)}\n`,
    );
    const command = fileURLToPath(
      new URL('./audit-historical-echoes.mjs', import.meta.url),
    );
    const missingMetadata = spawnSync(
      process.execPath,
      [
        command,
        `--artifact=${artifactPath}`,
        `--metadata=${join(directory, 'missing.metadata.json')}`,
      ],
      { encoding: 'utf8' },
    );
    assert.notEqual(missingMetadata.status, 0);
    assert.match(
      missingMetadata.stdout,
      /metadata file is required but missing/,
    );

    const missingAuthority = spawnSync(
      process.execPath,
      [command, `--artifact=${artifactPath}`, `--metadata=${metadataPath}`],
      { encoding: 'utf8' },
    );
    assert.notEqual(missingAuthority.status, 0);
    assert.match(
      missingAuthority.stdout,
      /external expected closure fingerprint/,
    );

    const accepted = spawnSync(
      process.execPath,
      [
        command,
        `--artifact=${artifactPath}`,
        `--metadata=${metadataPath}`,
        `--expected-closure-fingerprint=${fixture.closureFingerprint}`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
