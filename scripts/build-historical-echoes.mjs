// Historical Echoes Wikidata extraction.
//
// Contract source: the tracked Historical Echoes data gate and profile record
// in docs/data/historical-echoes.md.
//
// The pure selection rules (computeTypeClosure, isQualifying, selectStart,
// selectLabel, referenceYear) are deterministic and I/O-free, so each can be
// asserted independently. The streaming driver accepts only the pinned gzip
// dump as an explicit file. It verifies the complete compressed source before
// opening a second stream for extraction.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

export const SEED_ROOTS = ['Q811979', 'Q486972', 'Q56061', 'Q839954'];
export const PHASE0_ROOTS = [
  'Q839954',
  'Q15661340',
  'Q1081138',
  'Q109607',
  'Q23413',
  'Q57821',
  'Q350895',
  'Q74047',
  'Q21751582',
  'Q744099',
  'Q192601',
  'Q16748868',
  'Q164240',
  'Q34023',
  'Q44613',
  'Q16970',
  'Q44539',
  'Q32815',
];
export const ROOT_PROFILES = Object.freeze({
  current: SEED_ROOTS,
  phase0: PHASE0_ROOTS,
});
export const DENYLIST = ['Q5', 'Q43229', 'Q1190554', 'Q838948'];
export const START_PROPERTIES = ['P571', 'P580'];
export const COORDINATE_PROPERTY = 'P625';
export const EARTH_GLOBE = 'http://www.wikidata.org/entity/Q2';
export const YEAR_LIMIT = 1500;
export const PRECISION_MIN = 6;
export const PRECISION_MAX = 11;
export const WIKIDATA_SOURCE_IDENTITY = Object.freeze({
  snapshot: '2026-08-10',
  fileName: 'wikidata-20260810-all.json.gz',
  distributionUrl:
    'https://dumps.wikimedia.org/wikidatawiki/entities/20260810/wikidata-20260810-all.json.gz',
  bytes: 155_457_882_747,
  md5: '88a9a7d75846374f6c3c4ae142bcdbd0',
  sha1: '0deaac8823b5fa722c8dc577941393cdbaae7bc5',
  sha256: '3d9c0999deafc6bcf00e0ec993b32539f9b384003872e5a3117dcf9eb2ca3618',
});

const PROPERTY_RANK = new Map(
  START_PROPERTIES.map((property, index) => [property, index]),
);
const TIME_PATTERN =
  /^([+-])(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

export function computeTypeClosure(p279Edges, options = {}) {
  const seedRoots = options.seedRoots ?? SEED_ROOTS;
  const denylist = options.denylist ?? DENYLIST;
  const children = new Map();
  for (const edge of p279Edges) {
    if (
      !edge ||
      typeof edge.parent !== 'string' ||
      typeof edge.child !== 'string'
    ) {
      continue;
    }
    let siblings = children.get(edge.parent);
    if (!siblings) children.set(edge.parent, (siblings = new Set()));
    siblings.add(edge.child);
  }

  // Each root is traversed breadth-first so every class retains its nearest
  // seed. Equal-distance ties use the reviewed seed-root priority. The
  // denylist is a downward barrier rather than a post-hoc subtraction.
  const deny = new Set(denylist);
  const closure = new Map();
  for (
    let rootPriority = 0;
    rootPriority < seedRoots.length;
    rootPriority += 1
  ) {
    const root = seedRoots[rootPriority];
    labelReachable(root, children, closure, deny, rootPriority, seedRoots);
  }
  return closure;
}

export function createInputStats() {
  return {
    entities: 0,
    parseErrors: 0,
    p31Entities: 0,
    startClaimEntities: 0,
    coordinateClaimEntities: 0,
    labeledEntities: 0,
    p279Edges: 0,
    p279Deprecated: 0,
    p31Statements: { preferred: 0, normal: 0, deprecated: 0, valid: 0 },
    startStatements: { preferred: 0, normal: 0, deprecated: 0, valid: 0 },
    coordinateStatements: {
      preferred: 0,
      normal: 0,
      deprecated: 0,
      validEarth: 0,
      invalid: 0,
      nonEarth: 0,
    },
  };
}

export function recordInputStats(entity, stats) {
  stats.entities += 1;
  const claims = (entity && entity.claims) || {};
  if ((claims.P31 || []).length > 0) stats.p31Entities += 1;
  if ((claims.P571 || []).length > 0 || (claims.P580 || []).length > 0) {
    stats.startClaimEntities += 1;
  }
  if ((claims.P625 || []).length > 0) stats.coordinateClaimEntities += 1;
  if (selectLabel(entity) !== null) stats.labeledEntities += 1;

  for (const statement of claims.P31 || []) {
    const rank = statement?.rank;
    if (rank === 'preferred' || rank === 'normal' || rank === 'deprecated') {
      stats.p31Statements[rank] += 1;
    }
    if (
      rank !== 'deprecated' &&
      (rank === 'preferred' || rank === 'normal') &&
      entityIdValue(statement) !== null &&
      hasStableStatementId(statement)
    ) {
      stats.p31Statements.valid += 1;
    }
  }

  for (const property of START_PROPERTIES) {
    for (const statement of claims[property] || []) {
      const rank = statement?.rank;
      if (rank === 'preferred' || rank === 'normal' || rank === 'deprecated') {
        stats.startStatements[rank] += 1;
      }
      if (timeValue(statement) !== null && rank !== 'deprecated') {
        stats.startStatements.valid += 1;
      }
    }
  }

  if (isGraphEntity(entity)) {
    for (const statement of claims.P279 || []) {
      if (statement?.rank === 'deprecated') {
        stats.p279Deprecated += 1;
        continue;
      }
      if (entityIdValue(statement) !== null) stats.p279Edges += 1;
    }
  }

  for (const statement of claims.P625 || []) {
    const rank = statement?.rank;
    if (rank === 'preferred' || rank === 'normal' || rank === 'deprecated') {
      stats.coordinateStatements[rank] += 1;
    }
    if (rank === 'deprecated') continue;
    const value = coordinateValue(statement);
    if (value === null) {
      const globe = statement?.mainsnak?.datavalue?.value?.globe;
      if (globe !== undefined && globe !== EARTH_GLOBE && globe !== 'Q2') {
        stats.coordinateStatements.nonEarth += 1;
      } else {
        stats.coordinateStatements.invalid += 1;
      }
    } else {
      stats.coordinateStatements.validEarth += 1;
    }
  }
}

export function isQualifying(entity, typeClosure, seedRoots = SEED_ROOTS) {
  if (classifyType(entity, typeClosure, seedRoots) === null) return false;
  if (selectLabel(entity) === null) return false;
  if (selectCoordinate(entity) === null) return false;
  const start = selectStart(entity);
  if (start === null) return false;
  const year = referenceYear(start.time);
  return year !== null && year < YEAR_LIMIT;
}

export function selectStart(entity) {
  const claims = (entity && entity.claims) || {};
  const candidates = [];
  for (const property of START_PROPERTIES) {
    for (const statement of claims[property] || []) {
      if (statement.rank === 'deprecated') continue;
      const value = timeValue(statement);
      if (value === null) continue;
      if (typeof statement.id !== 'string' || statement.id.length === 0) {
        continue;
      }
      candidates.push({
        property,
        ...value,
        rank: statement.rank,
        id: statement.id,
      });
    }
  }
  if (candidates.length === 0) return null;

  const preferred = candidates.filter(
    (candidate) => candidate.rank === 'preferred',
  );
  const pool =
    preferred.length > 0
      ? preferred
      : candidates.filter((candidate) => candidate.rank === 'normal');
  if (pool.length === 0) return null;

  pool.sort(compareStart);
  const selected = pool[0];
  return {
    property: selected.property,
    time: selected.time,
    precision: selected.precision,
    calendarmodel: selected.calendarmodel,
    before: selected.before,
    after: selected.after,
    timezone: selected.timezone,
    rank: selected.rank,
    id: selected.id,
  };
}

export function selectLabel(entity) {
  return selectLabelInfo(entity)?.value ?? null;
}

export function selectLabelInfo(entity) {
  const labels = (entity && entity.labels) || {};
  for (const language of ['en', 'zh']) {
    const label = labels[language];
    if (label && typeof label.value === 'string' && label.value.trim() !== '') {
      return { language, value: label.value };
    }
  }
  return null;
}

export function selectCoordinate(entity) {
  const claims = (entity && entity.claims) || {};
  const candidates = [];
  for (const statement of claims[COORDINATE_PROPERTY] || []) {
    if (statement.rank === 'deprecated') continue;
    const value = coordinateValue(statement);
    if (value === null) continue;
    if (typeof statement.id !== 'string' || statement.id.length === 0) {
      continue;
    }
    candidates.push({
      ...value,
      rank: statement.rank,
      id: statement.id,
    });
  }
  if (candidates.length === 0) return null;

  const preferred = candidates.filter(
    (candidate) => candidate.rank === 'preferred',
  );
  const pool =
    preferred.length > 0
      ? preferred
      : candidates.filter((candidate) => candidate.rank === 'normal');
  if (pool.length === 0) return null;

  pool.sort(compareCoordinate);
  const selected = pool[0];
  return {
    latitude: selected.latitude,
    longitude: selected.longitude,
    precision: selected.precision,
    globe: selected.globe,
    rank: selected.rank,
    id: selected.id,
  };
}

export function referenceYear(time) {
  const parsed = parseTime(time);
  return parsed === null ? null : parsed.year;
}

// Keeps the exact fields the tested readers consume, dropping qualifiers,
// references, and every other claim, so the candidate stays small but still
// passes through isQualifying / selectStart / selectLabel unchanged.
export function slimCandidate(entity) {
  if (!entity || entity.type !== 'item' || typeof entity.id !== 'string') {
    return null;
  }
  const claims = entity.claims || {};
  if (!claims.P31 || (!claims.P571 && !claims.P580) || !claims.P625) {
    return null;
  }
  const labels = entity.labels || {};

  const slimLabels = {};
  if (labels.en) slimLabels.en = { value: labels.en.value };
  if (labels.zh) slimLabels.zh = { value: labels.zh.value };

  const slimClaims = { P31: claims.P31.map(slimStatement) };
  if (claims.P571) slimClaims.P571 = claims.P571.map(slimStatement);
  if (claims.P580) slimClaims.P580 = claims.P580.map(slimStatement);
  slimClaims.P625 = claims.P625.map(slimCoordinateStatement);

  return { id: entity.id, labels: slimLabels, claims: slimClaims };
}

// Picks the nearest qualifying P31 class after applying Wikibase best-rank.
export function classifyType(entity, typeClosure, seedRoots = SEED_ROOTS) {
  const candidates = selectP31Statements(entity)
    .filter((candidate) => typeClosure.has(candidate.id))
    .map((candidate) => ({
      ...candidate,
      ...typeClosure.get(candidate.id),
    }));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    const priorityA = seedPriority(a.root, seedRoots);
    const priorityB = seedPriority(b.root, seedRoots);
    if (priorityA !== priorityB) return priorityA - priorityB;
    const classCompare = compareQid(a.id, b.id);
    if (classCompare !== 0) return classCompare;
    return compareStrings(a.statementId, b.statementId);
  });
  const selected = candidates[0];
  return {
    type: selected.root,
    typeClass: selected.id,
    distance: selected.distance,
    rank: selected.rank,
    statementId: selected.statementId,
  };
}

export function buildRecord(entity, typeClosure, seedRoots = SEED_ROOTS) {
  const start = selectStart(entity);
  if (start === null) return null;
  const coordinates = selectCoordinate(entity);
  if (coordinates === null) return null;
  const label = selectLabelInfo(entity);
  if (label === null) return null;
  const classified = classifyType(entity, typeClosure, seedRoots);
  if (classified === null) return null;
  return {
    id: entity.id,
    label: label.value,
    type: classified.type,
    typeClass: classified.typeClass,
    coordinates: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      precision: coordinates.precision,
      globe: coordinates.globe,
    },
    start: {
      property: start.property,
      time: start.time,
      precision: start.precision,
      calendarmodel: start.calendarmodel,
      before: start.before,
      after: start.after,
      timezone: start.timezone,
    },
    provenance: {
      type: {
        rank: classified.rank,
        statementId: classified.statementId,
        distance: classified.distance,
      },
      start: {
        property: start.property,
        rank: start.rank,
        statementId: start.id,
      },
      coordinate: {
        rank: coordinates.rank,
        statementId: coordinates.id,
      },
      labelLanguage: label.language,
    },
  };
}

// Collects the truthy P279 (subclass-of) edges of an item, dropping deprecated
// statements so the type closure is built only on valid subclass relationships
// (spec §2, §12).
export function extractP279Edges(entity) {
  if (!isGraphEntity(entity)) return [];
  const edges = [];
  for (const statement of entity.claims?.P279 ?? []) {
    if (statement?.rank === 'deprecated') continue;
    const parent = entityIdValue(statement);
    if (parent !== null) edges.push({ child: entity.id, parent });
  }
  return edges;
}

function isGraphEntity(entity) {
  return entity?.type === 'item' && typeof entity.id === 'string';
}

export async function verifySourceIdentity(
  inputPath,
  expectedIdentity = WIKIDATA_SOURCE_IDENTITY,
) {
  await precheckSourceIdentity(inputPath, expectedIdentity);
  const identity = createIdentityTracker();
  for await (const chunk of createReadStream(inputPath)) identity.update(chunk);
  return assertSourceIdentity(
    identity.digest(expectedIdentity),
    expectedIdentity,
  );
}

async function precheckSourceIdentity(inputPath, expectedIdentity) {
  if (typeof inputPath !== 'string' || inputPath.length === 0) {
    throw new Error(
      'Historical Echoes requires an explicit --input path to the pinned gzip dump; stdin is not accepted',
    );
  }
  if (basename(inputPath) !== expectedIdentity.fileName) {
    throw new Error(
      `Historical Echoes source filename mismatch: expected ${expectedIdentity.fileName}, received ${basename(inputPath)}`,
    );
  }

  const sourceStat = await stat(inputPath);
  if (!sourceStat.isFile()) {
    throw new Error(
      `Historical Echoes source is not a regular file: ${inputPath}`,
    );
  }
  if (sourceStat.size !== expectedIdentity.bytes) {
    throw new Error(
      `Historical Echoes source byte count mismatch: expected ${expectedIdentity.bytes}, received ${sourceStat.size}`,
    );
  }
  return sourceStat;
}

function assertSourceIdentity(actualIdentity, expectedIdentity) {
  if (actualIdentity.bytes !== expectedIdentity.bytes) {
    throw new Error(
      `Historical Echoes source byte count mismatch: expected ${expectedIdentity.bytes}, received ${actualIdentity.bytes}`,
    );
  }
  for (const algorithm of ['md5', 'sha1', 'sha256']) {
    if (actualIdentity[algorithm] !== expectedIdentity[algorithm]) {
      throw new Error(
        `Historical Echoes source ${algorithm.toUpperCase()} mismatch: expected ${expectedIdentity[algorithm]}, received ${actualIdentity[algorithm]}`,
      );
    }
  }
  return actualIdentity;
}

function createIdentityTracker() {
  const hashes = {
    md5: createHash('md5'),
    sha1: createHash('sha1'),
    sha256: createHash('sha256'),
  };
  let bytes = 0;
  return {
    update(chunk) {
      bytes += chunk.byteLength;
      for (const hash of Object.values(hashes)) hash.update(chunk);
    },
    digest(expectedIdentity) {
      return {
        ...expectedIdentity,
        bytes,
        md5: hashes.md5.digest('hex'),
        sha1: hashes.sha1.digest('hex'),
        sha256: hashes.sha256.digest('hex'),
      };
    },
  };
}

export async function buildHistoricalEchoes({
  inputPath,
  outputPath,
  metadataPath,
  profile = 'current',
  expectedSourceIdentity = WIKIDATA_SOURCE_IDENTITY,
}) {
  const seedRoots = ROOT_PROFILES[profile];
  if (!seedRoots) {
    throw new Error(
      `Unknown Historical Echoes root profile: ${profile}. Expected one of ${Object.keys(ROOT_PROFILES).join(', ')}`,
    );
  }
  await precheckSourceIdentity(inputPath, expectedSourceIdentity);

  const edges = [];
  const candidates = [];
  const inputStats = createInputStats();
  let entities = 0;
  let sawArrayStart = false;
  let sawArrayEnd = false;
  const sourceTracker = createIdentityTracker();
  const identityTap = new Transform({
    transform(chunk, _encoding, callback) {
      sourceTracker.update(chunk);
      callback(null, chunk);
    },
  });
  const gzipInput = createReadStream(inputPath)
    .pipe(identityTap)
    .pipe(createGunzip());
  for await (const line of createInterface({
    input: gzipInput,
    crlfDelay: Infinity,
  })) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (trimmed === '[') {
      if (sawArrayStart) {
        throw new Error(
          'Historical Echoes input contained a duplicate array start',
        );
      }
      sawArrayStart = true;
      continue;
    }
    if (trimmed === ']') {
      if (!sawArrayStart || sawArrayEnd) {
        throw new Error(
          'Historical Echoes input contained an invalid array end',
        );
      }
      sawArrayEnd = true;
      continue;
    }
    if (sawArrayEnd) {
      throw new Error(
        'Historical Echoes input contained data after the array end',
      );
    }
    const json = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
    let entity;
    try {
      entity = JSON.parse(json);
    } catch {
      inputStats.parseErrors += 1;
      continue;
    }
    entities += 1;
    recordInputStats(entity, inputStats);
    if (entities % 5_000_000 === 0) {
      process.stderr.write(
        `historical-echoes: entities=${entities} edges=${edges.length} candidates=${candidates.length}\n`,
      );
    }

    edges.push(...extractP279Edges(entity));

    const slim = slimCandidate(entity);
    if (slim !== null) candidates.push(slim);
  }

  // A malformed line means the input stream was not the complete pinned dump.
  // Never publish a partial artifact that could look valid to the downstream
  // audit.
  if (inputStats.parseErrors > 0) {
    throw new Error(
      `Historical Echoes input contained ${inputStats.parseErrors} malformed JSON line(s); refusing to write a partial artifact`,
    );
  }
  if (!sawArrayStart || !sawArrayEnd) {
    throw new Error(
      'Historical Echoes input ended before the complete JSON array was closed; refusing to write a partial artifact',
    );
  }
  const sourceIdentity = assertSourceIdentity(
    sourceTracker.digest(expectedSourceIdentity),
    expectedSourceIdentity,
  );

  const closure = computeTypeClosure(edges, { seedRoots });
  const records = [];
  const qualificationStats = {
    candidates: candidates.length,
    typeMatched: 0,
    labelMatched: 0,
    coordinateMatched: 0,
    startMatched: 0,
    pre1500Matched: 0,
  };
  for (const candidate of candidates) {
    const typeMatched = classifyType(candidate, closure, seedRoots) !== null;
    if (!typeMatched) continue;
    qualificationStats.typeMatched += 1;

    const labelMatched = selectLabel(candidate) !== null;
    if (!labelMatched) continue;
    qualificationStats.labelMatched += 1;

    const coordinateMatched = selectCoordinate(candidate) !== null;
    if (!coordinateMatched) continue;
    qualificationStats.coordinateMatched += 1;

    const start = selectStart(candidate);
    if (start === null) continue;
    qualificationStats.startMatched += 1;

    const pre1500Matched =
      referenceYear(start.time) !== null &&
      referenceYear(start.time) < YEAR_LIMIT;
    if (!pre1500Matched) continue;
    qualificationStats.pre1500Matched += 1;

    const record = buildRecord(candidate, closure, seedRoots);
    if (record !== null) records.push(record);
  }
  records.sort(compareRecords);

  if (records.length === 0) {
    throw new Error(
      'Historical Echoes input produced no qualifying records; refusing to write an empty artifact',
    );
  }

  const artifactStats = summarizeRecords(records);

  await mkdir(dirname(outputPath), { recursive: true });
  const artifactBytes = Buffer.from(`${JSON.stringify(records)}\n`);
  await writeFile(outputPath, artifactBytes);
  const closureEntries = [...closure.entries()].sort(([a], [b]) =>
    compareQid(a, b),
  );
  const closureFingerprint = createHash('sha256')
    .update(
      closureEntries
        .map(
          ([id, classification]) =>
            `${id}\t${classification.root}\t${classification.distance}\n`,
        )
        .join(''),
    )
    .digest('hex');
  if (metadataPath) {
    await mkdir(dirname(metadataPath), { recursive: true });
    await writeFile(
      metadataPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          profile,
          seedRoots,
          denylist: DENYLIST,
          source: sourceIdentity,
          closure: {
            size: closureEntries.length,
            classes: closureEntries.map(([id, classification]) => ({
              id,
              root: classification.root,
              distance: classification.distance,
            })),
            fingerprint: closureFingerprint,
          },
          input: { ...inputStats },
          qualificationStats: {
            ...qualificationStats,
            qualifying: records.length,
          },
          artifactStats,
          output: {
            path: 'historical-echoes.json',
            recordCount: records.length,
            sha256: createHash('sha256').update(artifactBytes).digest('hex'),
            bytes: artifactBytes.byteLength,
          },
        },
        null,
        2,
      )}\n`,
    );
  }
  return {
    entities,
    p279Edges: edges.length,
    closureClasses: closure.size,
    candidates: candidates.length,
    records: records.length,
    profile,
    source: sourceIdentity,
    seedRoots,
    closureFingerprint,
    metadata: metadataPath,
    inputStats,
    qualificationStats: {
      ...qualificationStats,
      qualifying: records.length,
    },
    artifactStats,
    output: outputPath,
  };
}

async function main() {
  const root = resolve(import.meta.dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolve(
    args.output ?? resolve(root, 'src/data/generated/historical-echoes.json'),
  );
  const metadataPath = resolve(
    args.metadata ??
      resolve(root, 'src/data/generated/historical-echoes.metadata.json'),
  );
  const result = await buildHistoricalEchoes({
    inputPath: resolve(args.input),
    outputPath,
    metadataPath,
    profile: args.profile,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function parseArgs(args) {
  const options = {
    input: null,
    profile: 'current',
    output: null,
    metadata: null,
  };
  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      options.input = requiredArgumentValue(arg, '--input');
    } else if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length);
    } else if (arg.startsWith('--output=')) {
      options.output = requiredArgumentValue(arg, '--output');
    } else if (arg.startsWith('--metadata=')) {
      options.metadata = requiredArgumentValue(arg, '--metadata');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.input === null) {
    throw new Error(
      'Historical Echoes requires an explicit --input path to the pinned gzip dump; stdin is not accepted',
    );
  }
  return options;
}

function requiredArgumentValue(argument, name) {
  const value = argument.slice(`${name}=`.length);
  if (value === '') throw new Error(`${name} requires a value`);
  return value;
}

function summarizeRecords(records) {
  const stats = {
    countsByType: {},
    countsByTypeClass: {},
    countsByStartProperty: {},
    countsByStartRank: {},
    countsByCoordinateRank: {},
    countsByLabelLanguage: {},
  };
  for (const record of records) {
    count(stats.countsByType, record.type);
    count(stats.countsByTypeClass, record.typeClass);
    count(stats.countsByStartProperty, record.start.property);
    count(stats.countsByStartRank, record.provenance.start.rank);
    count(stats.countsByCoordinateRank, record.provenance.coordinate.rank);
    count(stats.countsByLabelLanguage, record.provenance.labelLanguage);
  }
  return stats;
}

function count(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function slimStatement(statement) {
  const snak = statement && statement.mainsnak;
  const slim = { mainsnak: {}, rank: statement.rank, id: statement.id };
  if (!snak) return slim;
  slim.mainsnak.snaktype = snak.snaktype;
  const datavalue = snak.datavalue;
  if (!datavalue) return slim;
  const value = datavalue.value;
  const slimDatavalue = { type: datavalue.type };
  if (datavalue.type === 'wikibase-entityid' && value) {
    slimDatavalue.value = { 'entity-type': value['entity-type'], id: value.id };
  } else if (datavalue.type === 'time' && value) {
    slimDatavalue.value = {
      time: value.time,
      precision: value.precision,
      calendarmodel: value.calendarmodel,
      before: value.before,
      after: value.after,
      timezone: value.timezone,
    };
  }
  slim.mainsnak.datavalue = slimDatavalue;
  return slim;
}

function slimCoordinateStatement(statement) {
  const snak = statement && statement.mainsnak;
  const slim = { mainsnak: {}, rank: statement.rank, id: statement.id };
  if (!snak) return slim;
  slim.mainsnak.snaktype = snak.snaktype;
  const datavalue = snak.datavalue;
  if (!datavalue || datavalue.type !== 'globecoordinate') return slim;
  const value = datavalue.value;
  if (!value || typeof value !== 'object') return slim;
  slim.mainsnak.datavalue = {
    type: 'globecoordinate',
    value: {
      latitude: value.latitude,
      longitude: value.longitude,
      precision: value.precision,
      globe: value.globe,
    },
  };
  return slim;
}

function seedPriority(root, seedRoots) {
  const index = seedRoots.indexOf(root);
  return index === -1 ? seedRoots.length : index;
}

function numericId(id) {
  const match = /^Q(\d+)$/.exec(id);
  return match === null ? null : BigInt(match[1]);
}

function compareQid(a, b) {
  const numberA = numericId(a);
  const numberB = numericId(b);
  if (numberA !== null && numberB !== null) {
    return numberA < numberB ? -1 : numberA > numberB ? 1 : 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareRecords(a, b) {
  return compareQid(a.id, b.id);
}

function labelReachable(
  root,
  children,
  closure,
  deny,
  rootPriority,
  seedRoots,
) {
  const queue = [{ id: root, distance: 0 }];
  const visited = new Map();
  for (let index = 0; index < queue.length; index += 1) {
    const { id: current, distance } = queue[index];
    const previousDistance = visited.get(current);
    if (previousDistance !== undefined && previousDistance <= distance)
      continue;
    visited.set(current, distance);
    if (deny.has(current)) continue;
    const previous = closure.get(current);
    const previousPriority =
      previous === undefined
        ? Number.POSITIVE_INFINITY
        : seedPriority(previous.root, seedRoots);
    if (
      previous === undefined ||
      distance < previous.distance ||
      (distance === previous.distance && rootPriority < previousPriority)
    ) {
      closure.set(current, { root, distance });
    }
    const kids = children.get(current);
    if (!kids) continue;
    for (const kid of kids) queue.push({ id: kid, distance: distance + 1 });
  }
}

function selectP31Statements(entity) {
  const candidates = [];
  for (const statement of entity?.claims?.P31 ?? []) {
    if (statement?.rank !== 'preferred' && statement?.rank !== 'normal') {
      continue;
    }
    const id = entityIdValue(statement);
    if (id === null || !hasStableStatementId(statement)) continue;
    candidates.push({
      id,
      rank: statement.rank,
      statementId: statement.id,
    });
  }
  const preferred = candidates.filter(
    (candidate) => candidate.rank === 'preferred',
  );
  return preferred.length > 0
    ? preferred
    : candidates.filter((candidate) => candidate.rank === 'normal');
}

function hasStableStatementId(statement) {
  return typeof statement?.id === 'string' && statement.id.length > 0;
}

function entityIdValue(statement) {
  const snak = statement && statement.mainsnak;
  if (!snak || snak.snaktype !== 'value') return null;
  const datavalue = snak.datavalue;
  if (!datavalue || datavalue.type !== 'wikibase-entityid') return null;
  const value = datavalue.value;
  if (!value || value['entity-type'] !== 'item') return null;
  return typeof value.id === 'string' && value.id !== '' ? value.id : null;
}

function timeValue(statement) {
  const snak = statement && statement.mainsnak;
  if (!snak || snak.snaktype !== 'value') return null;
  const datavalue = snak.datavalue;
  if (!datavalue || datavalue.type !== 'time') return null;
  const value = datavalue.value;
  if (!value || typeof value.time !== 'string') return null;
  if (parseTime(value.time) === null) return null;
  const precision = value.precision;
  if (
    !Number.isInteger(precision) ||
    precision < PRECISION_MIN ||
    precision > PRECISION_MAX
  ) {
    return null;
  }
  const { calendarmodel, before, after, timezone } = value;
  if (
    typeof calendarmodel !== 'string' ||
    !/^https?:\/\/www\.wikidata\.org\/entity\/Q[1-9]\d*$/.test(calendarmodel) ||
    !Number.isSafeInteger(before) ||
    before < 0 ||
    !Number.isSafeInteger(after) ||
    after < 0 ||
    !Number.isSafeInteger(timezone)
  ) {
    return null;
  }
  return {
    time: value.time,
    precision,
    calendarmodel,
    before,
    after,
    timezone,
  };
}

function parseTime(time) {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const yearDigits = match[2];
  const month = Number.parseInt(match[3], 10);
  const day = Number.parseInt(match[4], 10);
  const absoluteYear = Number.parseInt(yearDigits, 10);
  const hour = Number.parseInt(match[5], 10);
  const minute = Number.parseInt(match[6], 10);
  const second = Number.parseInt(match[7], 10);
  if (!Number.isSafeInteger(absoluteYear)) return null;
  if (hour > 23 || minute > 59 || second > 60) return null;
  if (month < 0 || month > 12 || day < 0 || day > 31) return null;
  if (month === 0 && day !== 0) return null;
  return {
    year: sign * absoluteYear,
    month,
    day,
  };
}

function compareStart(a, b) {
  if (a.property !== b.property) {
    return PROPERTY_RANK.get(a.property) - PROPERTY_RANK.get(b.property);
  }
  if (a.precision !== b.precision) return b.precision - a.precision;
  const timeCompare = compareTime(a.time, b.time);
  if (timeCompare !== 0) return timeCompare;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareCoordinate(a, b) {
  const precisionA = a.precision ?? Number.POSITIVE_INFINITY;
  const precisionB = b.precision ?? Number.POSITIVE_INFINITY;
  if (precisionA !== precisionB) return precisionA - precisionB;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function coordinateValue(statement) {
  const snak = statement && statement.mainsnak;
  if (!snak || snak.snaktype !== 'value') return null;
  const datavalue = snak.datavalue;
  if (!datavalue || datavalue.type !== 'globecoordinate') return null;
  const value = datavalue.value;
  if (!value || typeof value !== 'object') return null;
  const { latitude, longitude, precision, globe } = value;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  if (globe !== EARTH_GLOBE && globe !== 'Q2') return null;
  if (
    precision !== undefined &&
    (!Number.isFinite(precision) || precision <= 0)
  ) {
    return null;
  }
  return {
    latitude,
    longitude,
    precision: precision === undefined ? null : precision,
    globe: EARTH_GLOBE,
  };
}

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareTime(a, b) {
  const parsedA = parseTime(a);
  const parsedB = parseTime(b);
  if (parsedA !== null && parsedB !== null) {
    if (parsedA.year !== parsedB.year) return parsedA.year - parsedB.year;
    if (parsedA.month !== parsedB.month) return parsedA.month - parsedB.month;
    if (parsedA.day !== parsedB.day) return parsedA.day - parsedB.day;
    return 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
