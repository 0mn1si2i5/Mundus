// Read-only audit for a derived Historical Echoes record artifact.
//
// The audit deliberately does not decide whether the type closure is
// scientifically acceptable. It reports the observable artifact facts that
// must be reviewed before a manifest or runtime query index is created.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIME_PATTERN =
  /^([+-])(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const ALLOWED_START_PROPERTIES = new Set(['P571', 'P580']);
const QID_PATTERN = /^Q\d+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CALENDAR_MODEL_PATTERN = /^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/;
export const EARTH_GLOBE = 'http://www.wikidata.org/entity/Q2';
export const EXPECTED_PROFILE = 'current';
export const EXPECTED_SEED_ROOTS = Object.freeze([
  'Q811979',
  'Q486972',
  'Q56061',
  'Q839954',
]);
export const EXPECTED_DENYLIST = Object.freeze([
  'Q5',
  'Q43229',
  'Q1190554',
  'Q838948',
]);
export const EXPECTED_SOURCE_IDENTITY = Object.freeze({
  snapshot: '2026-08-10',
  fileName: 'wikidata-20260810-all.json.gz',
  distributionUrl:
    'https://dumps.wikimedia.org/wikidatawiki/entities/20260810/wikidata-20260810-all.json.gz',
  bytes: 155_457_882_747,
  md5: '88a9a7d75846374f6c3c4ae142bcdbd0',
  sha1: '0deaac8823b5fa722c8dc577941393cdbaae7bc5',
  sha256: '3d9c0999deafc6bcf00e0ec993b32539f9b384003872e5a3117dcf9eb2ca3618',
});

export function auditRecords(records, options = {}) {
  const typeClosure = options.typeClosure ?? null;
  const report = {
    recordCount: Array.isArray(records) ? records.length : 0,
    duplicateIds: [],
    orderingViolations: [],
    schemaErrors: [],
    coordinateMissing: 0,
    coordinateInvalid: 0,
    dateInvalid: 0,
    provenanceMissing: 0,
    provenanceInvalid: 0,
    labelProvenanceMissing: 0,
    labelProvenanceInvalid: 0,
    closureMembershipErrors: [],
    metadataErrors: [],
    countsByType: {},
    countsByTypeClass: {},
    countsByStartProperty: {},
    countsByPrecision: {},
    bceRecords: 0,
    coarseRecords: 0,
    yearRange: null,
  };

  if (!Array.isArray(records)) {
    report.schemaErrors.push('artifact must be a JSON array');
    return report;
  }
  if (records.length === 0) {
    report.schemaErrors.push('artifact must contain at least one record');
  }

  const seen = new Set();
  let previousId = null;
  let minYear = null;
  let maxYear = null;

  records.forEach((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      report.schemaErrors.push(`record ${index}: expected an object`);
      return;
    }

    const id = record.id;
    if (!QID_PATTERN.test(id ?? '')) {
      report.schemaErrors.push(`record ${index}: invalid id`);
    } else {
      if (seen.has(id)) report.duplicateIds.push(id);
      seen.add(id);
      if (previousId !== null && compareQid(previousId, id) > 0) {
        report.orderingViolations.push({ index, previousId, id });
      }
      previousId = id;
    }

    if (typeof record.label !== 'string' || record.label.trim() === '') {
      report.schemaErrors.push(`record ${index}: missing label`);
    }
    if (
      !QID_PATTERN.test(record.type ?? '') ||
      !QID_PATTERN.test(record.typeClass ?? '')
    ) {
      report.schemaErrors.push(`record ${index}: missing type classification`);
    } else {
      increment(report.countsByType, record.type);
      increment(report.countsByTypeClass, record.typeClass);
    }

    if (!record.coordinates) {
      report.coordinateMissing += 1;
    } else if (!validCoordinates(record.coordinates)) {
      report.coordinateInvalid += 1;
    }

    const start = record.start;
    const parsed = parseStart(start);
    if (parsed === null) {
      report.dateInvalid += 1;
    } else {
      increment(report.countsByStartProperty, parsed.property);
      increment(report.countsByPrecision, String(parsed.precision));
      if (parsed.year < 0) report.bceRecords += 1;
      if (parsed.precision <= 8) report.coarseRecords += 1;
      minYear = minYear === null ? parsed.year : Math.min(minYear, parsed.year);
      maxYear = maxYear === null ? parsed.year : Math.max(maxYear, parsed.year);
    }

    if (!record.provenance) {
      report.provenanceMissing += 1;
    } else {
      const closureEntry = typeClosure?.get(record.typeClass) ?? null;
      if (!validProvenance(record, closureEntry)) {
        report.provenanceInvalid += 1;
      }
      if (!record.provenance.labelLanguage) {
        report.labelProvenanceMissing += 1;
      } else if (!['en', 'zh'].includes(record.provenance.labelLanguage)) {
        report.labelProvenanceInvalid += 1;
      }
    }

    if (typeClosure !== null) {
      const expected = typeClosure.get(record.typeClass);
      if (expected?.root !== record.type) {
        report.closureMembershipErrors.push({
          index,
          type: record.type,
          typeClass: record.typeClass,
          expectedRoot: expected?.root ?? null,
          expectedDistance: expected?.distance ?? null,
        });
      }
    }
  });

  if (minYear !== null) report.yearRange = { min: minYear, max: maxYear };
  return report;
}

export function auditHasErrors(report) {
  return (
    report.schemaErrors.length > 0 ||
    report.duplicateIds.length > 0 ||
    report.orderingViolations.length > 0 ||
    report.coordinateMissing > 0 ||
    report.coordinateInvalid > 0 ||
    report.dateInvalid > 0 ||
    report.provenanceMissing > 0 ||
    report.provenanceInvalid > 0 ||
    report.labelProvenanceMissing > 0 ||
    report.labelProvenanceInvalid > 0 ||
    report.closureMembershipErrors.length > 0 ||
    report.metadataErrors.length > 0
  );
}

export function validateMetadata(
  metadata,
  records,
  artifactBytes,
  options = {},
) {
  const errors = [];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return ['metadata must be an object'];
  }
  if (metadata.schemaVersion !== 1) {
    errors.push('metadata schemaVersion must be 1');
  }
  if (metadata.profile !== EXPECTED_PROFILE) {
    errors.push('metadata profile must be current');
  }
  if (!deepEqual(metadata.seedRoots, EXPECTED_SEED_ROOTS)) {
    errors.push(
      'metadata seedRoots must match the four reviewed current roots',
    );
  }
  if (!deepEqual(metadata.denylist, EXPECTED_DENYLIST)) {
    errors.push('metadata denylist must match the reviewed denylist');
  }
  if (!deepEqual(metadata.source, EXPECTED_SOURCE_IDENTITY)) {
    errors.push(
      'metadata source identity does not match the pinned Wikidata dump',
    );
  }

  const expectedClosureFingerprint = options.expectedClosureFingerprint;
  if (!SHA256_PATTERN.test(expectedClosureFingerprint ?? '')) {
    errors.push(
      'an external expected closure fingerprint must be supplied as 64 lowercase hex characters',
    );
  }

  const classes = metadata.closure?.classes;
  if (!Array.isArray(classes)) {
    errors.push('metadata closure.classes must be an array');
  } else if (
    classes.some(
      (entry) =>
        !entry ||
        typeof entry.id !== 'string' ||
        !QID_PATTERN.test(entry.id) ||
        typeof entry.root !== 'string' ||
        !QID_PATTERN.test(entry.root) ||
        !Number.isSafeInteger(entry.distance) ||
        entry.distance < 0,
    )
  ) {
    errors.push('metadata closure.classes contains an invalid entry');
  } else {
    const ids = classes.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      errors.push('metadata closure.classes contains duplicate ids');
    }
    if (classes.some(({ id }) => EXPECTED_DENYLIST.includes(id))) {
      errors.push(
        'metadata closure.classes must exclude denylisted barrier classes',
      );
    }
    if (
      classes.some(
        ({ id, root, distance }) => (distance === 0) !== (id === root),
      )
    ) {
      errors.push(
        'metadata closure distance zero must be reserved for root self-mappings',
      );
    }
    if (classes.some(({ root }) => !EXPECTED_SEED_ROOTS.includes(root))) {
      errors.push(
        'metadata closure.classes contains a root outside current profile',
      );
    }
    for (const root of EXPECTED_SEED_ROOTS) {
      if (
        !classes.some(
          (entry) =>
            entry.id === root && entry.root === root && entry.distance === 0,
        )
      ) {
        errors.push(
          `metadata closure.classes must contain current root ${root} mapped to itself at distance zero`,
        );
      }
    }
    const sortedIds = [...ids].sort(compareQid);
    if (!deepEqual(ids, sortedIds)) {
      errors.push('metadata closure.classes must be sorted by numeric QID');
    }
    if (metadata.closure?.size !== classes.length) {
      errors.push('metadata closure size does not match classes');
    }
    const fingerprint = createHash('sha256')
      .update(
        [...classes]
          .sort((a, b) => compareQid(a.id, b.id))
          .map(({ id, root, distance }) => `${id}\t${root}\t${distance}\n`)
          .join(''),
      )
      .digest('hex');
    if (metadata.closure?.fingerprint !== fingerprint) {
      errors.push('metadata closure fingerprint does not match classes');
    }
    if (
      SHA256_PATTERN.test(expectedClosureFingerprint ?? '') &&
      metadata.closure?.fingerprint !== expectedClosureFingerprint
    ) {
      errors.push(
        'metadata closure fingerprint does not match the external expected fingerprint',
      );
    }
  }

  validateInputStats(metadata.input, errors);
  validateQualificationStats(metadata, records, errors);
  const expectedArtifactStats = summarizeArtifact(records);
  if (!deepEqual(metadata.artifactStats, expectedArtifactStats)) {
    errors.push('metadata artifactStats do not match the artifact');
  }

  const output = metadata.output;
  if (!output || typeof output !== 'object') {
    errors.push('metadata output must be an object');
  } else {
    if (output.path !== 'historical-echoes.json') {
      errors.push('metadata output path must be historical-echoes.json');
    }
    if (output.recordCount !== (Array.isArray(records) ? records.length : 0)) {
      errors.push('metadata recordCount does not match artifact');
    }
    const actualSha256 = createHash('sha256')
      .update(artifactBytes)
      .digest('hex');
    if (output.sha256 !== actualSha256) {
      errors.push('metadata artifact sha256 does not match artifact');
    }
    if (output.bytes !== artifactBytes.byteLength) {
      errors.push('metadata artifact byte count does not match artifact');
    }
  }
  return errors;
}

function validateInputStats(input, errors) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    errors.push('metadata input stats must be an object');
    return;
  }
  const scalarKeys = [
    'entities',
    'parseErrors',
    'p31Entities',
    'startClaimEntities',
    'coordinateClaimEntities',
    'labeledEntities',
    'p279Edges',
    'p279Deprecated',
  ];
  for (const key of scalarKeys) {
    if (!isCounter(input[key])) {
      errors.push(`metadata input.${key} must be a non-negative integer`);
    }
  }
  if (input.entities === 0) {
    errors.push('metadata input.entities must be greater than zero');
  }
  if (input.parseErrors !== 0) {
    errors.push('metadata input.parseErrors must be zero');
  }
  if (isCounter(input.entities)) {
    for (const key of [
      'p31Entities',
      'startClaimEntities',
      'coordinateClaimEntities',
      'labeledEntities',
    ]) {
      if (isCounter(input[key]) && input[key] > input.entities) {
        errors.push(`metadata input.${key} exceeds input.entities`);
      }
    }
  }
  validateCounterMap(
    input.p31Statements,
    ['preferred', 'normal', 'deprecated', 'valid'],
    'metadata input.p31Statements',
    errors,
  );
  validateCounterMap(
    input.startStatements,
    ['preferred', 'normal', 'deprecated', 'valid'],
    'metadata input.startStatements',
    errors,
  );
  validateCounterMap(
    input.coordinateStatements,
    ['preferred', 'normal', 'deprecated', 'validEarth', 'invalid', 'nonEarth'],
    'metadata input.coordinateStatements',
    errors,
  );
}

function validateQualificationStats(metadata, records, errors) {
  const stats = metadata.qualificationStats;
  const keys = [
    'candidates',
    'typeMatched',
    'labelMatched',
    'coordinateMatched',
    'startMatched',
    'pre1500Matched',
    'qualifying',
  ];
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    errors.push('metadata qualificationStats must be an object');
    return;
  }
  for (const key of keys) {
    if (!isCounter(stats[key])) {
      errors.push(
        `metadata qualificationStats.${key} must be a non-negative integer`,
      );
    }
  }
  if (keys.some((key) => !isCounter(stats[key]))) return;
  const funnel = keys.map((key) => stats[key]);
  if (funnel.some((value, index) => index > 0 && value > funnel[index - 1])) {
    errors.push('metadata qualificationStats must be a cumulative funnel');
  }
  const recordCount = Array.isArray(records) ? records.length : 0;
  if (stats.qualifying !== recordCount) {
    errors.push(
      'metadata qualificationStats.qualifying does not match artifact',
    );
  }
  if (stats.pre1500Matched !== stats.qualifying) {
    errors.push(
      'metadata qualificationStats has unexplained loss after pre1500Matched',
    );
  }
  const input = metadata.input;
  if (input && typeof input === 'object') {
    for (const key of [
      'entities',
      'p31Entities',
      'startClaimEntities',
      'coordinateClaimEntities',
    ]) {
      if (isCounter(input[key]) && stats.candidates > input[key]) {
        errors.push(
          `metadata qualificationStats.candidates exceeds input.${key}`,
        );
      }
    }
  }
}

function validateCounterMap(value, keys, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of keys) {
    if (!isCounter(value[key])) {
      errors.push(`${label}.${key} must be a non-negative integer`);
    }
  }
}

function isCounter(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function summarizeArtifact(records) {
  const stats = {
    countsByType: {},
    countsByTypeClass: {},
    countsByStartProperty: {},
    countsByStartRank: {},
    countsByCoordinateRank: {},
    countsByLabelLanguage: {},
  };
  if (!Array.isArray(records)) return stats;
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (typeof record.type === 'string')
      increment(stats.countsByType, record.type);
    if (typeof record.typeClass === 'string') {
      increment(stats.countsByTypeClass, record.typeClass);
    }
    if (typeof record.start?.property === 'string') {
      increment(stats.countsByStartProperty, record.start.property);
    }
    if (typeof record.provenance?.start?.rank === 'string') {
      increment(stats.countsByStartRank, record.provenance.start.rank);
    }
    if (typeof record.provenance?.coordinate?.rank === 'string') {
      increment(
        stats.countsByCoordinateRank,
        record.provenance.coordinate.rank,
      );
    }
    if (typeof record.provenance?.labelLanguage === 'string') {
      increment(stats.countsByLabelLanguage, record.provenance.labelLanguage);
    }
  }
  return stats;
}

function deepEqual(a, b) {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function parseStart(start) {
  if (!start || typeof start !== 'object') return null;
  if (!ALLOWED_START_PROPERTIES.has(start.property)) return null;
  if (
    !Number.isInteger(start.precision) ||
    start.precision < 6 ||
    start.precision > 11
  ) {
    return null;
  }
  if (typeof start.time !== 'string') return null;
  if (!CALENDAR_MODEL_PATTERN.test(start.calendarmodel ?? '')) return null;
  if (!Number.isSafeInteger(start.before) || start.before < 0) return null;
  if (!Number.isSafeInteger(start.after) || start.after < 0) return null;
  if (!Number.isSafeInteger(start.timezone)) return null;
  const match = TIME_PATTERN.exec(start.time);
  if (!match) return null;
  const absoluteYear = Number.parseInt(match[2], 10);
  if (!Number.isSafeInteger(absoluteYear)) return null;
  const month = Number.parseInt(match[3], 10);
  const day = Number.parseInt(match[4], 10);
  const hour = Number.parseInt(match[5], 10);
  const minute = Number.parseInt(match[6], 10);
  const second = Number.parseInt(match[7], 10);
  if (month < 0 || month > 12 || day < 0 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 60) return null;
  if (month === 0 && day !== 0) return null;
  const year = (match[1] === '-' ? -1 : 1) * absoluteYear;
  if (!Number.isSafeInteger(year) || year >= 1500) return null;
  return { property: start.property, precision: start.precision, year };
}

function validProvenance(record, closureEntry) {
  const type = record.provenance?.type;
  const start = record.provenance?.start;
  const coordinate = record.provenance?.coordinate;
  return (
    (type?.rank === 'preferred' || type?.rank === 'normal') &&
    typeof type.statementId === 'string' &&
    type.statementId.length > 0 &&
    Number.isSafeInteger(type.distance) &&
    type.distance >= 0 &&
    (closureEntry === null || type.distance === closureEntry.distance) &&
    start?.property === record.start?.property &&
    (start.rank === 'preferred' || start.rank === 'normal') &&
    typeof start.statementId === 'string' &&
    start.statementId.length > 0 &&
    (coordinate?.rank === 'preferred' || coordinate?.rank === 'normal') &&
    typeof coordinate.statementId === 'string' &&
    coordinate.statementId.length > 0 &&
    (record.provenance?.labelLanguage === 'en' ||
      record.provenance?.labelLanguage === 'zh')
  );
}

function validCoordinates(coordinates) {
  return (
    coordinates !== null &&
    typeof coordinates === 'object' &&
    Object.hasOwn(coordinates, 'precision') &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180 &&
    coordinates.globe === EARTH_GLOBE &&
    (coordinates.precision === null ||
      coordinates.precision === undefined ||
      (Number.isFinite(coordinates.precision) && coordinates.precision > 0))
  );
}

function increment(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function compareQid(a, b) {
  const numberA = BigInt(a.slice(1));
  const numberB = BigInt(b.slice(1));
  return numberA < numberB ? -1 : numberA > numberB ? 1 : 0;
}

async function main() {
  const root = resolve(import.meta.dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const artifactPath = resolve(
    args.artifact ?? resolve(root, 'src/data/generated/historical-echoes.json'),
  );
  const metadataPath = resolve(
    args.metadata ??
      resolve(root, 'src/data/generated/historical-echoes.metadata.json'),
  );
  const artifactBytes = await readFile(artifactPath);
  const records = JSON.parse(artifactBytes);
  let metadata = null;
  let metadataReadError = null;
  try {
    metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  } catch (error) {
    metadataReadError =
      error && typeof error === 'object' && error.code === 'ENOENT'
        ? `metadata file is required but missing: ${metadataPath}`
        : `metadata file could not be read: ${error instanceof Error ? error.message : String(error)}`;
  }
  const typeClosure = new Map(
    (metadata?.closure?.classes ?? []).map(
      ({ id, root: closureRoot, distance }) => [
        id,
        { root: closureRoot, distance },
      ],
    ),
  );
  const report = auditRecords(records, {
    typeClosure: metadata === null ? null : typeClosure,
  });
  report.metadataErrors =
    metadataReadError === null
      ? validateMetadata(metadata, records, artifactBytes, {
          expectedClosureFingerprint: args.expectedClosureFingerprint,
        })
      : [metadataReadError];
  process.stdout.write(
    `${JSON.stringify({ artifact: artifactPath, metadata: metadataPath, ...report }, null, 2)}\n`,
  );
  if (auditHasErrors(report)) {
    process.exitCode = 1;
  }
}

function parseArgs(arguments_) {
  const options = {
    artifact: null,
    metadata: null,
    expectedClosureFingerprint: null,
  };
  for (const argument of arguments_) {
    if (argument.startsWith('--artifact=')) {
      options.artifact = requiredArgumentValue(argument, '--artifact');
    } else if (argument.startsWith('--metadata=')) {
      options.metadata = requiredArgumentValue(argument, '--metadata');
    } else if (argument.startsWith('--expected-closure-fingerprint=')) {
      options.expectedClosureFingerprint = requiredArgumentValue(
        argument,
        '--expected-closure-fingerprint',
      );
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function requiredArgumentValue(argument, name) {
  const value = argument.slice(`${name}=`.length);
  if (value === '') throw new Error(`${name} requires a value`);
  return value;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
