import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RECORD_FIELDS = [
  'label',
  'coordinates',
  'start',
  'type',
  'typeClass',
  'provenance.type',
  'provenance.start',
  'provenance.coordinate',
  'provenance.labelLanguage',
];
const SEMANTIC_FIELDS = RECORD_FIELDS.filter(
  (field) =>
    field !== 'type' && field !== 'typeClass' && field !== 'provenance.type',
);

export function compareProfiles({ current, baseline }) {
  const currentById = indexRecords(current.records);
  const baselineById = indexRecords(baseline.records);
  const sharedIds = [...currentById.keys()]
    .filter((id) => baselineById.has(id))
    .sort(compareQid);
  const currentOnlyIds = [...currentById.keys()]
    .filter((id) => !baselineById.has(id))
    .sort(compareQid);
  const baselineOnlyIds = [...baselineById.keys()]
    .filter((id) => !currentById.has(id))
    .sort(compareQid);
  const fieldDifferenceCounts = Object.fromEntries(
    RECORD_FIELDS.map((field) => [field, 0]),
  );
  let fullRecordDifferences = 0;
  let semanticAgreement = 0;
  for (const id of sharedIds) {
    const currentRecord = currentById.get(id);
    const baselineRecord = baselineById.get(id);
    if (stableJson(currentRecord) !== stableJson(baselineRecord)) {
      fullRecordDifferences += 1;
    }
    let recordHasSemanticDifference = false;
    for (const field of RECORD_FIELDS) {
      if (
        stableJson(readField(currentRecord, field)) !==
        stableJson(readField(baselineRecord, field))
      ) {
        fieldDifferenceCounts[field] += 1;
      }
    }
    for (const field of SEMANTIC_FIELDS) {
      if (
        stableJson(readField(currentRecord, field)) !==
        stableJson(readField(baselineRecord, field))
      ) {
        recordHasSemanticDifference = true;
        break;
      }
    }
    if (!recordHasSemanticDifference) semanticAgreement += 1;
  }

  return {
    schemaVersion: 1,
    current: summarizeProfile(current),
    baseline: summarizeProfile(baseline),
    records: {
      current: current.records.length,
      baseline: baseline.records.length,
      shared: sharedIds.length,
      currentOnly: currentOnlyIds.length,
      baselineOnly: baselineOnlyIds.length,
      sharedSemanticAgreement: semanticAgreement,
      sharedSemanticDifferences: sharedIds.length - semanticAgreement,
      sharedFullRecordDifferences: fullRecordDifferences,
      fieldDifferenceCounts,
      currentOnlySample: currentOnlyIds.slice(0, 20),
      baselineOnlySample: baselineOnlyIds.slice(0, 20),
      sharedIdSha256: sha256(Buffer.from(`${sharedIds.join('\n')}\n`)),
      currentOnlyIdSha256: sha256(
        Buffer.from(`${currentOnlyIds.join('\n')}\n`),
      ),
      baselineOnlyIdSha256: sha256(
        Buffer.from(`${baselineOnlyIds.join('\n')}\n`),
      ),
    },
    metadata: {
      sourceIdentityEqual:
        stableJson(current.metadata?.source) ===
        stableJson(baseline.metadata?.source),
      denylistEqual:
        stableJson(current.metadata?.denylist) ===
        stableJson(baseline.metadata?.denylist),
      currentProfile: current.metadata?.profile ?? null,
      baselineProfile: baseline.metadata?.profile ?? null,
      currentSeedRoots: current.metadata?.seedRoots ?? [],
      baselineSeedRoots: baseline.metadata?.seedRoots ?? [],
      currentClosure: closureSummary(current.metadata),
      baselineClosure: closureSummary(baseline.metadata),
      currentInput: inputSummary(current.metadata),
      baselineInput: inputSummary(baseline.metadata),
      currentQualification: current.metadata?.qualificationStats ?? null,
      baselineQualification: baseline.metadata?.qualificationStats ?? null,
    },
  };
}

export function summarizeProfile({
  records,
  metadata,
  artifactBytes,
  metadataBytes,
}) {
  return {
    recordCount: records.length,
    artifactSha256: sha256(
      artifactBytes ?? Buffer.from(JSON.stringify(records)),
    ),
    metadataSha256: metadataBytes ? sha256(metadataBytes) : null,
    profile: metadata?.profile ?? null,
    seedRoots: metadata?.seedRoots ?? [],
    sourceSha256: metadata?.source?.sha256 ?? null,
    closure: closureSummary(metadata),
  };
}

function indexRecords(records) {
  const byId = new Map();
  for (const record of records) {
    if (!record || typeof record.id !== 'string') {
      throw new Error('Every Historical Echoes record must have a string id');
    }
    if (byId.has(record.id))
      throw new Error(`Duplicate record id: ${record.id}`);
    byId.set(record.id, record);
  }
  return byId;
}

function readField(record, field) {
  return field.split('.').reduce((value, key) => value?.[key], record);
}

function closureSummary(metadata) {
  return {
    size: metadata?.closure?.size ?? null,
    fingerprint: metadata?.closure?.fingerprint ?? null,
  };
}

function inputSummary(metadata) {
  const input = metadata?.input;
  return input
    ? {
        entities: input.entities,
        parseErrors: input.parseErrors,
        p279Edges: input.p279Edges,
        p279Deprecated: input.p279Deprecated,
      }
    : null;
}

function compareQid(first, second) {
  const firstNumber = Number(first.slice(1));
  const secondNumber = Number(second.slice(1));
  return firstNumber - secondNumber || first.localeCompare(second);
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function loadProfile(artifactPath, metadataPath) {
  const [artifactBytes, metadataBytes] = await Promise.all([
    readFile(artifactPath),
    readFile(metadataPath),
  ]);
  return {
    records: JSON.parse(artifactBytes),
    metadata: JSON.parse(metadataBytes),
    artifactBytes,
    metadataBytes,
  };
}

function argumentValue(args, name) {
  const prefix = `${name}=`;
  const argument = args.find((value) => value.startsWith(prefix));
  if (!argument || argument.slice(prefix.length) === '') {
    throw new Error(`${name}=... is required`);
  }
  return argument.slice(prefix.length);
}

async function main() {
  const args = process.argv.slice(2);
  const current = await loadProfile(
    resolve(argumentValue(args, '--current-artifact')),
    resolve(argumentValue(args, '--current-metadata')),
  );
  const baseline = await loadProfile(
    resolve(argumentValue(args, '--baseline-artifact')),
    resolve(argumentValue(args, '--baseline-metadata')),
  );
  const comparison = compareProfiles({ current, baseline });
  const outputPath = args.find((value) => value.startsWith('--output='));
  const output = `${JSON.stringify(comparison, null, 2)}\n`;
  if (outputPath) {
    await writeFile(resolve(outputPath.slice('--output='.length)), output);
  }
  process.stdout.write(output);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
