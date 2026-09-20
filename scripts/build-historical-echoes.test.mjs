import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  DENYLIST,
  COORDINATE_PROPERTY,
  EARTH_GLOBE,
  PHASE0_ROOTS,
  ROOT_PROFILES,
  SEED_ROOTS,
  START_PROPERTIES,
  WIKIDATA_SOURCE_IDENTITY,
  buildRecord,
  buildHistoricalEchoes,
  classifyType,
  computeTypeClosure,
  createInputStats,
  extractP279Edges,
  isQualifying,
  referenceYear,
  recordInputStats,
  selectLabel,
  selectLabelInfo,
  selectCoordinate,
  selectStart,
  slimCandidate,
  verifySourceIdentity,
} from './build-historical-echoes.mjs';

function entityIdStatement(id, options = {}) {
  return {
    mainsnak: {
      snaktype: 'value',
      datatype: 'wikibase-item',
      datavalue: {
        type: 'wikibase-entityid',
        value: { 'entity-type': 'item', id },
      },
    },
    rank: options.rank ?? 'normal',
    id: options.id ?? `P31-${id}`,
  };
}

function timeStatement(property, time, precision, options = {}) {
  return {
    mainsnak: {
      snaktype: 'value',
      datatype: 'time',
      datavalue: {
        type: 'time',
        value: {
          time,
          timezone: options.timezone ?? 0,
          before: options.before ?? 0,
          after: options.after ?? 0,
          precision,
          calendarmodel:
            options.calendarmodel ?? 'http://www.wikidata.org/entity/Q1985727',
        },
      },
    },
    rank: options.rank ?? 'normal',
    id: options.id ?? `${property}-1`,
  };
}

function coordinateStatement(
  latitude = 31.2304,
  longitude = 121.4737,
  precision = 0.0001,
  options = {},
) {
  return {
    mainsnak: {
      snaktype: 'value',
      datatype: 'globe-coordinate',
      datavalue: {
        type: 'globecoordinate',
        value: {
          latitude,
          longitude,
          precision,
          globe: options.globe ?? EARTH_GLOBE,
        },
      },
    },
    rank: options.rank ?? 'normal',
    id: options.id ?? 'P625-1',
  };
}

function entity(options = {}) {
  const {
    labels = { en: { value: 'Example' } },
    instanceOf = ['Q811979'],
    claims,
  } = options;
  const resolvedClaims = claims ?? {
    P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)],
  };
  if (resolvedClaims.P625 === undefined) {
    resolvedClaims.P625 = [coordinateStatement()];
  }
  return {
    type: 'item',
    id: 'Q1',
    labels,
    claims: {
      P31: instanceOf.map((id) => entityIdStatement(id)),
      ...resolvedClaims,
    },
  };
}

function closure() {
  return computeTypeClosure([]);
}

function runBuilder(input, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('./build-historical-echoes.mjs', import.meta.url)),
      ...extraArgs,
    ],
    { input, encoding: 'utf8' },
  );
}

function writeGzipFixture(directory, text, fileName = 'fixture.json.gz') {
  const path = join(directory, fileName);
  const bytes = gzipSync(Buffer.from(text));
  writeFileSync(path, bytes);
  return {
    path,
    identity: {
      ...WIKIDATA_SOURCE_IDENTITY,
      fileName: basename(path),
      bytes: bytes.byteLength,
      md5: createHash('md5').update(bytes).digest('hex'),
      sha1: createHash('sha1').update(bytes).digest('hex'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}

async function buildFixture(directory, text, outputName) {
  const source = writeGzipFixture(directory, text, `${outputName}.json.gz`);
  const outputPath = join(directory, `${outputName}.json`);
  const metadataPath = join(directory, `${outputName}.metadata.json`);
  const result = await buildHistoricalEchoes({
    inputPath: source.path,
    outputPath,
    metadataPath,
    expectedSourceIdentity: source.identity,
  });
  return { ...result, outputPath, metadataPath, source };
}

test('pins the seed roots, denylist, and start properties', () => {
  assert.deepEqual(SEED_ROOTS, ['Q811979', 'Q486972', 'Q56061', 'Q839954']);
  assert.deepEqual(DENYLIST, ['Q5', 'Q43229', 'Q1190554', 'Q838948']);
  assert.deepEqual(START_PROPERTIES, ['P571', 'P580']);
  assert.equal(COORDINATE_PROPERTY, 'P625');
  assert.equal(EARTH_GLOBE, 'http://www.wikidata.org/entity/Q2');
  assert.equal(ROOT_PROFILES.current, SEED_ROOTS);
  assert.equal(ROOT_PROFILES.phase0, PHASE0_ROOTS);
  assert.equal(PHASE0_ROOTS.length, 18);
  assert.deepEqual(WIKIDATA_SOURCE_IDENTITY, {
    snapshot: '2026-08-10',
    fileName: 'wikidata-20260810-all.json.gz',
    distributionUrl:
      'https://dumps.wikimedia.org/wikidatawiki/entities/20260810/wikidata-20260810-all.json.gz',
    bytes: 155_457_882_747,
    md5: '88a9a7d75846374f6c3c4ae142bcdbd0',
    sha1: '0deaac8823b5fa722c8dc577941393cdbaae7bc5',
    sha256: '3d9c0999deafc6bcf00e0ec993b32539f9b384003872e5a3117dcf9eb2ca3618',
  });
});

test('recordInputStats reports claim ranks and coordinate rejection classes', () => {
  const stats = createInputStats();
  const subject = entity({
    claims: {
      P31: [
        entityIdStatement('Q811979'),
        entityIdStatement('Q486972', { rank: 'preferred' }),
        entityIdStatement('Q56061', { rank: 'deprecated' }),
        entityIdStatement('', { id: 'invalid' }),
      ],
      P571: [
        timeStatement('P571', '+1200-00-00T00:00:00Z', 9),
        timeStatement('P571', '+1100-00-00T00:00:00Z', 9, {
          rank: 'deprecated',
        }),
      ],
      P625: [
        coordinateStatement(31, 121, 0.1),
        coordinateStatement(32, 122, 0.1, { rank: 'preferred' }),
        coordinateStatement(33, 123, 0.1, { rank: 'deprecated' }),
        {
          ...coordinateStatement(0, 0, 0.1, { id: 'moon' }),
          mainsnak: {
            ...coordinateStatement(0, 0, 0.1).mainsnak,
            datavalue: {
              type: 'globecoordinate',
              value: {
                latitude: 0,
                longitude: 0,
                precision: 0.1,
                globe: 'http://www.wikidata.org/entity/Q405',
              },
            },
          },
        },
        coordinateStatement(Number.NaN, 0, 0.1, { id: 'nan' }),
      ],
      P279: [
        entityIdStatement('Q811979'),
        { ...entityIdStatement('Q43229'), rank: 'deprecated' },
      ],
    },
  });
  recordInputStats(subject, stats);
  assert.deepEqual(stats, {
    entities: 1,
    parseErrors: 0,
    p31Entities: 1,
    startClaimEntities: 1,
    coordinateClaimEntities: 1,
    labeledEntities: 1,
    p279Edges: 1,
    p279Deprecated: 1,
    p31Statements: { preferred: 1, normal: 2, deprecated: 1, valid: 2 },
    startStatements: { preferred: 0, normal: 1, deprecated: 1, valid: 1 },
    coordinateStatements: {
      preferred: 1,
      normal: 3,
      deprecated: 1,
      validEarth: 2,
      invalid: 1,
      nonEarth: 1,
    },
  });
});

test('computeTypeClosure includes seed roots and transitive subclasses', () => {
  const result = computeTypeClosure([
    { child: 'Q41176', parent: 'Q811979' },
    { child: 'Q16970', parent: 'Q41176' },
    { child: 'Q515', parent: 'Q486972' },
  ]);
  assert.deepEqual(result.get('Q811979'), { root: 'Q811979', distance: 0 });
  assert.deepEqual(result.get('Q41176'), { root: 'Q811979', distance: 1 });
  assert.deepEqual(result.get('Q16970'), { root: 'Q811979', distance: 2 });
  assert.deepEqual(result.get('Q515'), { root: 'Q486972', distance: 1 });
});

test('computeTypeClosure excludes denylist members and their subclasses', () => {
  const result = computeTypeClosure([
    { child: 'Q7278', parent: 'Q43229' },
    { child: 'Q1234', parent: 'Q5' },
  ]);
  assert.equal(result.has('Q43229'), false);
  assert.equal(result.has('Q7278'), false);
  assert.equal(result.has('Q5'), false);
  assert.equal(result.has('Q1234'), false);
});

test('computeTypeClosure labels a class by its highest-priority seed root', () => {
  const result = computeTypeClosure([
    { child: 'Q1', parent: 'Q811979' },
    { child: 'Q1', parent: 'Q486972' },
  ]);
  assert.deepEqual(result.get('Q1'), { root: 'Q811979', distance: 1 });
});

test('computeTypeClosure chooses the nearest root before root priority', () => {
  const result = computeTypeClosure([
    { child: 'Q10', parent: 'Q811979' },
    { child: 'Q1', parent: 'Q10' },
    { child: 'Q1', parent: 'Q486972' },
  ]);
  assert.deepEqual(result.get('Q1'), { root: 'Q486972', distance: 1 });
});

test('computeTypeClosure uses root priority only for equal distances', () => {
  const result = computeTypeClosure([
    { child: 'Q1', parent: 'Q811979' },
    { child: 'Q1', parent: 'Q486972' },
  ]);
  assert.deepEqual(result.get('Q1'), { root: 'Q811979', distance: 1 });
});

test('denylist is a barrier: a seed-root subclass stays even with a deny ancestor', () => {
  const result = computeTypeClosure([
    { child: 'Q1', parent: 'Q811979' },
    { child: 'Q1', parent: 'Q43229' },
  ]);
  assert.deepEqual(result.get('Q1'), { root: 'Q811979', distance: 1 });
});

test('denylist ancestor does not wipe the seed-root subtree', () => {
  const result = computeTypeClosure([
    { child: 'Q56061', parent: 'Q43229' },
    { child: 'Q6256', parent: 'Q56061' },
  ]);
  assert.deepEqual(result.get('Q56061'), { root: 'Q56061', distance: 0 });
  assert.deepEqual(result.get('Q6256'), { root: 'Q56061', distance: 1 });
  assert.equal(result.has('Q43229'), false);
});

test('extractP279Edges drops deprecated subclass edges', () => {
  const edges = extractP279Edges({
    type: 'item',
    id: 'Q1',
    claims: {
      P279: [
        entityIdStatement('Q56061'),
        { ...entityIdStatement('Q43229'), rank: 'deprecated' },
      ],
    },
  });
  assert.equal(edges.length, 1);
  assert.equal(edges[0].parent, 'Q56061');
});

test('extractP279Edges ignores malformed subclass statements consistently', () => {
  const edges = extractP279Edges({
    type: 'item',
    id: 'Q1',
    claims: {
      P279: [null, {}, entityIdStatement('Q56061')],
    },
  });
  assert.deepEqual(edges, [{ child: 'Q1', parent: 'Q56061' }]);
});

test('P279 statistics use the same item admission boundary as graph edges', () => {
  const stats = createInputStats();
  const property = entity({
    claims: { P279: [entityIdStatement('Q43229')] },
  });
  property.type = 'property';
  property.id = 'P279';
  const missingId = entity({
    claims: { P279: [entityIdStatement('Q43229')] },
  });
  delete missingId.id;

  recordInputStats(property, stats);
  recordInputStats(missingId, stats);

  assert.equal(stats.p279Edges, 0);
  assert.equal(extractP279Edges(property).length, 0);
  assert.equal(extractP279Edges(missingId).length, 0);
});

test('selectLabel prefers English and falls back to Chinese', () => {
  assert.equal(
    selectLabel(
      entity({ labels: { en: { value: 'Rome' }, zh: { value: '罗马' } } }),
    ),
    'Rome',
  );
  assert.equal(
    selectLabel(entity({ labels: { zh: { value: '罗马' } } })),
    '罗马',
  );
  assert.equal(
    selectLabel(entity({ labels: { fr: { value: 'Rome' } } })),
    null,
  );
  assert.deepEqual(selectLabelInfo(entity()), {
    language: 'en',
    value: 'Example',
  });
  assert.deepEqual(
    selectLabelInfo(entity({ labels: { zh: { value: '罗马' } } })),
    {
      language: 'zh',
      value: '罗马',
    },
  );
});

test('selectCoordinate accepts valid Earth coordinates and ranks deterministically', () => {
  const subject = entity({
    claims: {
      P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)],
      P625: [
        coordinateStatement(31.2, 121.4, 0.01, { id: 'coarse' }),
        coordinateStatement(31.23, 121.47, 0.0001, { id: 'fine' }),
      ],
    },
  });
  assert.deepEqual(selectCoordinate(subject), {
    latitude: 31.23,
    longitude: 121.47,
    precision: 0.0001,
    globe: EARTH_GLOBE,
    rank: 'normal',
    id: 'fine',
  });
});

test('selectCoordinate prefers preferred claims and rejects invalid globes/ranges', () => {
  const subject = entity({
    claims: {
      P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)],
      P625: [
        coordinateStatement(200, 10, 0.0001, { id: 'invalid-range' }),
        {
          ...coordinateStatement(40, 20, 0.0001, { id: 'moon' }),
          mainsnak: {
            ...coordinateStatement(40, 20, 0.0001).mainsnak,
            datavalue: {
              type: 'globecoordinate',
              value: {
                latitude: 40,
                longitude: 20,
                precision: 0.0001,
                globe: 'http://www.wikidata.org/entity/Q405',
              },
            },
          },
        },
        coordinateStatement(30, 10, 0.1, { id: 'normal' }),
        coordinateStatement(31, 11, 0.1, {
          id: 'preferred',
          rank: 'preferred',
        }),
      ],
    },
  });
  assert.deepEqual(selectCoordinate(subject), {
    latitude: 31,
    longitude: 11,
    precision: 0.1,
    globe: EARTH_GLOBE,
    rank: 'preferred',
    id: 'preferred',
  });
});

test('selectCoordinate normalizes the Q2 globe URI', () => {
  const subject = entity({
    claims: {
      P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)],
      P625: [coordinateStatement(31, 121, 0.1, { globe: 'Q2' })],
    },
  });
  assert.equal(selectCoordinate(subject)?.globe, EARTH_GLOBE);
});

test('isQualifying requires a valid P625 coordinate', () => {
  const subject = entity({
    claims: {
      P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)],
      P625: [],
    },
  });
  assert.equal(isQualifying(subject, closure()), false);
});

test('isQualifying requires a P31 value inside the type closure', () => {
  assert.equal(isQualifying(entity({ instanceOf: ['Q5'] }), closure()), false);
  assert.equal(
    isQualifying(entity({ instanceOf: ['Q811979'] }), closure()),
    true,
  );
});

test('isQualifying requires an English or Chinese label', () => {
  assert.equal(
    isQualifying(entity({ labels: { fr: { value: 'Rome' } } }), closure()),
    false,
  );
});

test('selectStart ignores deprecated statements', () => {
  const subject = entity({
    claims: {
      P571: [
        timeStatement('P571', '+1200-00-00T00:00:00Z', 9, {
          rank: 'deprecated',
          id: 'a',
        }),
      ],
      P580: [timeStatement('P580', '+1100-00-00T00:00:00Z', 9, { id: 'b' })],
    },
  });
  assert.equal(selectStart(subject).property, 'P580');
});

test('selectStart prefers preferred statements over normal', () => {
  const subject = entity({
    claims: {
      P571: [
        timeStatement('P571', '+1200-00-00T00:00:00Z', 9, {
          rank: 'normal',
          id: 'n',
        }),
        timeStatement('P571', '+1000-00-00T00:00:00Z', 9, {
          rank: 'preferred',
          id: 'p',
        }),
      ],
    },
  });
  assert.equal(selectStart(subject).time, '+1000-00-00T00:00:00Z');
});

test('selectStart prefers P571 over P580 at equal rank', () => {
  const subject = entity({
    claims: {
      P580: [timeStatement('P580', '+0900-00-00T00:00:00Z', 9, { id: 'p580' })],
      P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9, { id: 'p571' })],
    },
  });
  assert.equal(selectStart(subject).property, 'P571');
});

test('selectStart prefers finer precision at equal property and rank', () => {
  const subject = entity({
    claims: {
      P571: [
        timeStatement('P571', '+1200-00-00T00:00:00Z', 7, { id: 'coarse' }),
        timeStatement('P571', '+1200-00-00T00:00:00Z', 9, { id: 'fine' }),
      ],
    },
  });
  assert.equal(selectStart(subject).precision, 9);
});

test('selectStart prefers the earlier date at equal property and precision', () => {
  const subject = entity({
    claims: {
      P571: [
        timeStatement('P571', '+1300-00-00T00:00:00Z', 9, { id: 'later' }),
        timeStatement('P571', '+1100-00-00T00:00:00Z', 9, { id: 'earlier' }),
      ],
    },
  });
  assert.equal(selectStart(subject).time, '+1100-00-00T00:00:00Z');
});

test('selectStart breaks ties by statement id', () => {
  const subject = entity({
    claims: {
      P571: [
        timeStatement('P571', '+1200-00-00T00:00:00Z', 9, { id: 'z' }),
        timeStatement('P571', '+1200-00-00T00:00:00Z', 9, { id: 'a' }),
      ],
    },
  });
  assert.equal(selectStart(subject).id, 'a');
});

test('selectStart returns null without a usable start statement', () => {
  assert.equal(selectStart(entity({ claims: {} })), null);
  assert.equal(
    selectStart(
      entity({
        claims: {
          P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 5)],
        },
      }),
    ),
    null,
  );
});

test('selection rejects statements without stable IDs', () => {
  const subject = entity({
    claims: {
      P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9, { id: '' })],
      P625: [coordinateStatement(31, 121, 0.1, { id: '' })],
    },
  });
  assert.equal(selectStart(subject), null);
  assert.equal(selectCoordinate(subject), null);
});

test('selectStart rejects impossible calendar components and unsafe years', () => {
  assert.equal(
    selectStart(
      entity({
        claims: {
          P571: [timeStatement('P571', '+1200-13-00T00:00:00Z', 9)],
        },
      }),
    ),
    null,
  );
  assert.equal(
    selectStart(
      entity({
        claims: {
          P571: [
            timeStatement(
              'P571',
              '+999999999999999999999999-00-00T00:00:00Z',
              9,
            ),
          ],
        },
      }),
    ),
    null,
  );
  assert.equal(
    selectStart(
      entity({
        claims: {
          P571: [timeStatement('P571', '+1201-02-29T00:00:00Z', 11)],
        },
      }),
    )?.time,
    '+1201-02-29T00:00:00Z',
  );
  assert.equal(
    selectStart(
      entity({
        claims: {
          P571: [timeStatement('P571', '+1200-02-29T00:00:00Z', 11)],
        },
      }),
    )?.time,
    '+1200-02-29T00:00:00Z',
  );
});

test('selectStart drops non-time datavalues and non-value snaks', () => {
  const subject = entity({
    claims: {
      P571: [
        {
          mainsnak: { snaktype: 'somevalue', datatype: 'time' },
          rank: 'normal',
          id: 'somevalue',
        },
        {
          mainsnak: {
            snaktype: 'value',
            datatype: 'string',
            datavalue: { type: 'string', value: 'not a time' },
          },
          rank: 'normal',
          id: 'string',
        },
      ],
    },
  });
  assert.equal(selectStart(subject), null);
});

test('selectStart preserves non-Gregorian calendar metadata and safe qualifiers', () => {
  const subject = entity({
    claims: {
      P571: [
        timeStatement('P571', '+1201-02-29T00:00:00Z', 11, {
          calendarmodel: 'http://www.wikidata.org/entity/Q1985786',
          before: 2,
          after: 3,
          timezone: -60,
        }),
      ],
    },
  });
  assert.deepEqual(selectStart(subject), {
    property: 'P571',
    time: '+1201-02-29T00:00:00Z',
    precision: 11,
    calendarmodel: 'http://www.wikidata.org/entity/Q1985786',
    before: 2,
    after: 3,
    timezone: -60,
    rank: 'normal',
    id: 'P571-1',
  });
});

test('selectStart rejects malformed calendar metadata', () => {
  assert.equal(
    selectStart(
      entity({
        claims: {
          P571: [
            timeStatement('P571', '+1200-01-01T00:00:00Z', 11, {
              calendarmodel: 'Q1985727',
            }),
          ],
        },
      }),
    ),
    null,
  );
});

test('referenceYear returns a sign-aware numeric year', () => {
  assert.equal(referenceYear('+1200-00-00T00:00:00Z'), 1200);
  assert.equal(referenceYear('-0050-00-00T00:00:00Z'), -50);
});

test('isQualifying accepts a century whose reference year precedes 1500', () => {
  assert.equal(
    isQualifying(
      entity({
        claims: {
          P571: [timeStatement('P571', '+1400-00-00T00:00:00Z', 7)],
        },
      }),
      closure(),
    ),
    true,
  );
});

test('isQualifying rejects a start at or after 1500', () => {
  assert.equal(
    isQualifying(
      entity({
        claims: {
          P571: [timeStatement('P571', '+1500-00-00T00:00:00Z', 7)],
        },
      }),
      closure(),
    ),
    false,
  );
});

test('isQualifying accepts BCE coarse precision without inventing finer dates', () => {
  assert.equal(
    isQualifying(
      entity({
        claims: {
          P571: [timeStatement('P571', '-0050-00-00T00:00:00Z', 7)],
        },
      }),
      closure(),
    ),
    true,
  );
});

test('slimCandidate keeps only the fields the readers consume', () => {
  const full = entity({
    instanceOf: ['Q16970'],
    claims: { P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)] },
  });
  full.claims.P31[0].references = [{ hash: 'big-reference' }];
  full.claims.P571[0].qualifiers = { P580: [{ big: 'qualifier' }] };

  const slim = slimCandidate(full);
  assert.ok(slim);
  assert.equal(slim.id, 'Q1');
  assert.deepEqual(slim.labels, { en: { value: 'Example' } });
  assert.equal(slim.claims.P31[0].references, undefined);
  assert.equal(slim.claims.P571[0].qualifiers, undefined);
  assert.equal(
    slim.claims.P571[0].mainsnak.datavalue.value.time,
    '+1200-00-00T00:00:00Z',
  );
  assert.deepEqual(slim.claims.P625[0].mainsnak.datavalue.value, {
    latitude: 31.2304,
    longitude: 121.4737,
    precision: 0.0001,
    globe: EARTH_GLOBE,
  });
});

test('slimCandidate requires an item, P31, a start, and a coordinate', () => {
  assert.equal(
    slimCandidate({ type: 'item', id: 'Q1', claims: { P571: [] } }),
    null,
  );
  assert.deepEqual(
    slimCandidate({
      type: 'item',
      id: 'Q1',
      claims: {
        P31: [entityIdStatement('Q811979')],
        P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)],
        P625: [coordinateStatement()],
      },
      labels: {},
    })?.labels,
    {},
  );
  assert.equal(
    slimCandidate({
      type: 'item',
      id: 'Q1',
      claims: {
        P31: [entityIdStatement('Q811979')],
        P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)],
      },
      labels: { en: { value: 'x' } },
    }),
    null,
  );
  assert.equal(
    slimCandidate({
      type: 'lexeme',
      id: 'L1',
      claims: { P31: [], P571: [] },
      labels: { en: { value: 'x' } },
    }),
    null,
  );
});

test('classifyType picks the highest-priority seed root among qualifying classes', () => {
  const typedClosure = computeTypeClosure([
    { child: 'Q16970', parent: 'Q811979' },
    { child: 'Q515', parent: 'Q486972' },
  ]);
  const subject = entity({ instanceOf: ['Q515', 'Q16970'] });
  assert.deepEqual(classifyType(subject, typedClosure), {
    type: 'Q811979',
    typeClass: 'Q16970',
    distance: 1,
    rank: 'normal',
    statementId: 'P31-Q16970',
  });
});

test('classifyType uses the selected profile root priority', () => {
  const typedClosure = new Map([
    ['Q100', { root: 'Q839954', distance: 0 }],
    ['Q101', { root: 'Q15661340', distance: 0 }],
  ]);
  const subject = entity({ instanceOf: ['Q100', 'Q101'] });
  const profileRoots = ['Q839954', 'Q15661340'];
  assert.deepEqual(classifyType(subject, typedClosure, profileRoots), {
    type: 'Q839954',
    typeClass: 'Q100',
    distance: 0,
    rank: 'normal',
    statementId: 'P31-Q100',
  });
  assert.deepEqual(
    classifyType(subject, typedClosure, [...profileRoots].reverse()),
    {
      type: 'Q15661340',
      typeClass: 'Q101',
      distance: 0,
      rank: 'normal',
      statementId: 'P31-Q101',
    },
  );
});

test('classifyType puts an unrecognized closure label after profile roots', () => {
  const typedClosure = new Map([
    ['Q100', { root: 'Q839954', distance: 0 }],
    ['Q101', { root: 'Q999999', distance: 0 }],
  ]);
  const subject = entity({ instanceOf: ['Q101', 'Q100'] });
  assert.deepEqual(classifyType(subject, typedClosure, ['Q839954']), {
    type: 'Q839954',
    typeClass: 'Q100',
    distance: 0,
    rank: 'normal',
    statementId: 'P31-Q100',
  });
});

test('classifyType applies best-rank and stable statement tie-breaks', () => {
  const typedClosure = computeTypeClosure([
    { child: 'Q16970', parent: 'Q811979' },
  ]);
  const subject = entity({
    instanceOf: [],
    claims: {
      P31: [
        entityIdStatement('Q16970', { rank: 'normal', id: 'z' }),
        entityIdStatement('Q16970', { rank: 'normal', id: 'a' }),
        entityIdStatement('Q811979', { rank: 'preferred', id: 'preferred' }),
      ],
    },
  });
  assert.deepEqual(classifyType(subject, typedClosure), {
    type: 'Q811979',
    typeClass: 'Q811979',
    distance: 0,
    rank: 'preferred',
    statementId: 'preferred',
  });
  subject.claims.P31 = [
    entityIdStatement('Q16970', { rank: 'normal', id: 'z' }),
    entityIdStatement('Q16970', { rank: 'normal', id: 'a' }),
  ];
  assert.equal(classifyType(subject, typedClosure)?.statementId, 'a');
});

test('classifyType chooses the nearest qualifying P31 class', () => {
  const typedClosure = new Map([
    ['Q100', { root: 'Q811979', distance: 2 }],
    ['Q200', { root: 'Q486972', distance: 1 }],
  ]);
  const subject = entity({ instanceOf: ['Q100', 'Q200'] });
  assert.deepEqual(classifyType(subject, typedClosure), {
    type: 'Q486972',
    typeClass: 'Q200',
    distance: 1,
    rank: 'normal',
    statementId: 'P31-Q200',
  });
});

test('classifyType ignores invalid preferred P31 statements', () => {
  const typedClosure = computeTypeClosure([]);
  const subject = entity({ instanceOf: [] });
  subject.claims.P31 = [
    entityIdStatement('', { rank: 'preferred', id: 'invalid' }),
    entityIdStatement('Q811979', { rank: 'normal', id: 'normal' }),
  ];
  assert.equal(classifyType(subject, typedClosure)?.statementId, 'normal');
});

test('buildRecord emits the deterministic record shape', () => {
  const typedClosure = computeTypeClosure([
    { child: 'Q16970', parent: 'Q811979' },
  ]);
  const subject = entity({
    instanceOf: ['Q16970'],
    claims: { P571: [timeStatement('P571', '+1200-00-00T00:00:00Z', 9)] },
  });
  assert.deepEqual(buildRecord(subject, typedClosure), {
    id: 'Q1',
    label: 'Example',
    type: 'Q811979',
    typeClass: 'Q16970',
    coordinates: {
      latitude: 31.2304,
      longitude: 121.4737,
      precision: 0.0001,
      globe: EARTH_GLOBE,
    },
    start: {
      property: 'P571',
      time: '+1200-00-00T00:00:00Z',
      precision: 9,
      calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
      before: 0,
      after: 0,
      timezone: 0,
    },
    provenance: {
      type: {
        rank: 'normal',
        statementId: 'P31-Q16970',
        distance: 1,
      },
      start: { property: 'P571', rank: 'normal', statementId: 'P571-1' },
      coordinate: { rank: 'normal', statementId: 'P625-1' },
      labelLanguage: 'en',
    },
  });
});

test('CLI requires an explicit source file and does not read stdin', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const output = join(directory, 'artifact.json');
    const input = `[\n${JSON.stringify(entity())}\n]\n`;
    const result = runBuilder(input, [`--output=${output}`]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /explicit --input path/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI rejects an alternate source before extraction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const output = join(directory, 'artifact.json');
    const alternate = writeGzipFixture(
      directory,
      `[\n${JSON.stringify(entity())}\n]\n`,
      WIKIDATA_SOURCE_IDENTITY.fileName,
    );
    const result = runBuilder('', [
      `--input=${alternate.path}`,
      `--output=${output}`,
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source byte count mismatch/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('source verification fails closed on every pinned hash', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const source = writeGzipFixture(directory, '[]\n');
    for (const algorithm of ['md5', 'sha1', 'sha256']) {
      await assert.rejects(
        verifySourceIdentity(source.path, {
          ...source.identity,
          [algorithm]: '0'.repeat(source.identity[algorithm].length),
        }),
        new RegExp(`${algorithm.toUpperCase()} mismatch`),
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('streaming build validates the compressed bytes it actually extracts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const source = writeGzipFixture(
      directory,
      `[\n${JSON.stringify(entity())}\n]\n`,
    );
    const output = join(directory, 'artifact.json');
    await assert.rejects(
      buildHistoricalEchoes({
        inputPath: source.path,
        outputPath: output,
        expectedSourceIdentity: {
          ...source.identity,
          sha256: '0'.repeat(64),
        },
      }),
      /SHA256 mismatch/,
    );
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('streaming build refuses malformed input instead of writing a partial artifact', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const output = join(directory, 'artifact.json');
    const metadata = join(directory, 'metadata.json');
    const source = writeGzipFixture(
      directory,
      `[\n${JSON.stringify(entity())},\nnot-json\n]\n`,
    );
    await assert.rejects(
      buildHistoricalEchoes({
        inputPath: source.path,
        outputPath: output,
        metadataPath: metadata,
        expectedSourceIdentity: source.identity,
      }),
      /malformed JSON line/,
    );
    assert.equal(existsSync(output), false);
    assert.equal(existsSync(metadata), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('streaming build refuses a truncated JSON array', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const output = join(directory, 'artifact.json');
    const source = writeGzipFixture(
      directory,
      `[\n${JSON.stringify(entity())},\n`,
    );
    await assert.rejects(
      buildHistoricalEchoes({
        inputPath: source.path,
        outputPath: output,
        metadataPath: join(directory, 'metadata.json'),
        expectedSourceIdentity: source.identity,
      }),
      /complete JSON array was closed/,
    );
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('streaming build refuses an empty qualifying result', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const output = join(directory, 'artifact.json');
    const input =
      '[\n' + JSON.stringify(entity({ instanceOf: ['Q5'] })) + '\n]\n';
    const source = writeGzipFixture(directory, input);
    await assert.rejects(
      buildHistoricalEchoes({
        inputPath: source.path,
        outputPath: output,
        metadataPath: join(directory, 'metadata.json'),
        expectedSourceIdentity: source.identity,
      }),
      /no qualifying records/,
    );
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('streaming build refuses an input without a JSON array boundary', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const output = join(directory, 'artifact.json');
    const source = writeGzipFixture(directory, `${JSON.stringify(entity())}\n`);
    await assert.rejects(
      buildHistoricalEchoes({
        inputPath: source.path,
        outputPath: output,
        metadataPath: join(directory, 'metadata.json'),
        expectedSourceIdentity: source.identity,
      }),
      /complete JSON array was closed/,
    );
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('streaming build is byte-stable and records source identity plus cumulative stats', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const first = entity();
    first.id = 'Q20';
    const second = entity();
    second.id = 'Q3';
    const input = `[\n${JSON.stringify(first)},\n${JSON.stringify(second)}\n]\n`;
    const resultA = await buildFixture(directory, input, 'a');
    const resultB = await buildFixture(directory, input, 'b');
    const bytesA = readFileSync(resultA.outputPath, 'utf8');
    const bytesB = readFileSync(resultB.outputPath, 'utf8');
    assert.equal(bytesA, bytesB);
    assert.deepEqual(
      JSON.parse(bytesA).map((record) => record.id),
      ['Q3', 'Q20'],
    );
    const metadata = JSON.parse(readFileSync(resultA.metadataPath, 'utf8'));
    assert.deepEqual(metadata.source, resultA.source.identity);
    assert.deepEqual(metadata.closure.classes, [
      { id: 'Q56061', root: 'Q56061', distance: 0 },
      { id: 'Q486972', root: 'Q486972', distance: 0 },
      { id: 'Q811979', root: 'Q811979', distance: 0 },
      { id: 'Q839954', root: 'Q839954', distance: 0 },
    ]);
    assert.equal(
      metadata.closure.fingerprint,
      createHash('sha256')
        .update(
          'Q56061\tQ56061\t0\n' +
            'Q486972\tQ486972\t0\n' +
            'Q811979\tQ811979\t0\n' +
            'Q839954\tQ839954\t0\n',
        )
        .digest('hex'),
    );
    assert.equal(metadata.input.p31Statements.valid, 2);
    assert.deepEqual(metadata.qualificationStats, {
      candidates: 2,
      typeMatched: 2,
      labelMatched: 2,
      coordinateMatched: 2,
      startMatched: 2,
      pre1500Matched: 2,
      qualifying: 2,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('qualification stats retain unlabeled candidates until the label gate', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mundus-he-build-'));
  try {
    const labeled = entity();
    labeled.id = 'Q1';
    const unlabeled = entity({ labels: {} });
    unlabeled.id = 'Q2';
    const input = `[\n${JSON.stringify(labeled)},\n${JSON.stringify(unlabeled)}\n]\n`;
    const result = await buildFixture(directory, input, 'funnel');
    assert.deepEqual(result.qualificationStats, {
      candidates: 2,
      typeMatched: 2,
      labelMatched: 1,
      coordinateMatched: 1,
      startMatched: 1,
      pre1500Matched: 1,
      qualifying: 1,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
