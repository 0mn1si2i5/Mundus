import { MeshoptDecoder } from 'meshoptimizer/decoder';
import type { DecodedVectorGlobe, VectorStreamDescriptor } from './vectorGlobe';

const assetUrls = {
  '110m': new URL(
    '../../data/generated/natural-earth-vector-globe-110m.mvg',
    import.meta.url,
  ).href,
  '50m': new URL(
    '../../data/generated/natural-earth-vector-globe-50m.mvg',
    import.meta.url,
  ).href,
} as const;

const cache = new Map<string, Promise<DecodedVectorGlobe>>();
export const MAX_VECTOR_DECODE_BYTES = 32 * 1024 * 1024;
const MAX_VECTOR_FILE_BYTES = 4 * 1024 * 1024;
const MAX_METADATA_BYTES = 128 * 1024;
const MAX_COUNTRY_INDEX = 904;
const EXPECTED_STREAMS = new Map<
  string,
  { mode: VectorStreamDescriptor['mode']; strides: readonly number[] }
>([
  ['surfaceVertex', { mode: 'ATTRIBUTES', strides: [8] }],
  ['surfaceIndex', { mode: 'TRIANGLES', strides: [2, 4] }],
  ['coastVertex', { mode: 'ATTRIBUTES', strides: [8] }],
  ['coastIndex', { mode: 'INDICES', strides: [2, 4] }],
  ['borderVertex', { mode: 'ATTRIBUTES', strides: [8] }],
  ['borderIndex', { mode: 'INDICES', strides: [2, 4] }],
]);

export function loadVectorGlobe(detail: '110m' | '50m') {
  let promise = cache.get(detail);
  if (!promise) {
    promise = fetch(assetUrls[detail])
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Vector globe request failed: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(decodeVectorGlobe)
      .catch((error: unknown) => {
        cache.delete(detail);
        throw error;
      });
    cache.set(detail, promise);
  }
  return promise;
}

export async function decodeVectorGlobe(
  buffer: ArrayBuffer,
): Promise<DecodedVectorGlobe> {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > MAX_VECTOR_FILE_BYTES) {
    throw new Error('Invalid vector globe file size');
  }
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== 'MVG2') {
    throw new Error(`Unsupported vector globe asset: ${magic}`);
  }
  if (bytes.byteLength < 8) throw new Error('Invalid vector globe file size');
  const view = new DataView(buffer);
  const metadataLength = view.getUint32(4, true);
  if (
    metadataLength === 0 ||
    metadataLength > MAX_METADATA_BYTES ||
    8 + metadataLength > bytes.byteLength
  ) {
    throw new Error('Invalid vector globe metadata length');
  }
  let metadata: unknown;
  try {
    metadata = JSON.parse(
      new TextDecoder().decode(bytes.subarray(8, 8 + metadataLength)),
    );
  } catch {
    throw new Error('Invalid vector globe metadata JSON');
  }
  const validated = validateMetadata(
    metadata,
    bytes.byteLength - 8 - metadataLength,
  );
  await MeshoptDecoder.ready;
  let offset = 8 + metadataLength;
  const streams: Record<string, Uint8Array> = {};
  for (const descriptor of validated.streams) {
    if (
      !Number.isInteger(descriptor.count) ||
      descriptor.count < 0 ||
      !Number.isInteger(descriptor.stride) ||
      descriptor.stride <= 0 ||
      !Number.isInteger(descriptor.byteLength) ||
      descriptor.byteLength <= 0 ||
      offset + descriptor.byteLength > bytes.byteLength
    ) {
      throw new Error(`Invalid vector globe stream ${descriptor.name}`);
    }
    const target = new Uint8Array(descriptor.count * descriptor.stride);
    const source = bytes.subarray(offset, offset + descriptor.byteLength);
    if (descriptor.mode === 'ATTRIBUTES') {
      MeshoptDecoder.decodeVertexBuffer(
        target,
        descriptor.count,
        descriptor.stride,
        source,
      );
    } else if (descriptor.mode === 'TRIANGLES') {
      MeshoptDecoder.decodeIndexBuffer(
        target,
        descriptor.count,
        descriptor.stride,
        source,
      );
    } else {
      MeshoptDecoder.decodeIndexSequence(
        target,
        descriptor.count,
        descriptor.stride,
        source,
      );
    }
    streams[descriptor.name] = target;
    offset += descriptor.byteLength;
  }
  if (offset !== bytes.byteLength) {
    throw new Error('Unexpected trailing vector globe bytes');
  }
  return {
    countries: validated.countries,
    descriptors: validated.streams,
    streams,
  };
}

function validateMetadata(
  input: unknown,
  payloadBytes: number,
): {
  countries: DecodedVectorGlobe['countries'];
  streams: VectorStreamDescriptor[];
} {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid vector globe metadata schema');
  }
  const metadata = input as Record<string, unknown>;
  if (!hasExactKeys(metadata, ['version', 'countries', 'streams'])) {
    throw new Error('Invalid vector globe metadata schema');
  }
  if (metadata.version !== 2) throw new Error('Invalid vector globe version');
  if (
    !Array.isArray(metadata.countries) ||
    metadata.countries.length === 0 ||
    metadata.countries.length > 905
  ) {
    throw new Error('Invalid vector globe country records');
  }
  const countryIds = new Set<string>();
  const countryIndices = new Set<number>();
  const countries = metadata.countries.map((value) => {
    if (!value || typeof value !== 'object') {
      throw new Error('Invalid vector globe country record');
    }
    const country = value as Record<string, unknown>;
    if (!hasExactKeys(country, ['countryId', 'name', 'countryIndex'])) {
      throw new Error('Invalid vector globe country record');
    }
    if (
      typeof country.countryId !== 'string' ||
      !/^ne-(?:\d{3}|x-[a-z-]+)$/.test(country.countryId) ||
      typeof country.name !== 'string' ||
      country.name.length === 0 ||
      country.name.length > 128 ||
      !Number.isInteger(country.countryIndex) ||
      (country.countryIndex as number) < 0 ||
      (country.countryIndex as number) > MAX_COUNTRY_INDEX ||
      countryIds.has(country.countryId) ||
      countryIndices.has(country.countryIndex as number)
    ) {
      throw new Error('Invalid vector globe country record');
    }
    countryIds.add(country.countryId);
    countryIndices.add(country.countryIndex as number);
    return country as unknown as DecodedVectorGlobe['countries'][number];
  });
  if (
    !Array.isArray(metadata.streams) ||
    metadata.streams.length !== EXPECTED_STREAMS.size
  ) {
    throw new Error('Invalid vector globe stream set');
  }
  const names = new Set<string>();
  let encodedBytes = 0;
  let decodedBytes = 0;
  const streams = metadata.streams.map((value) => {
    if (!value || typeof value !== 'object') {
      throw new Error('Invalid vector globe stream schema');
    }
    const stream = value as Record<string, unknown>;
    if (
      !hasExactKeys(stream, ['name', 'mode', 'count', 'stride', 'byteLength'])
    ) {
      throw new Error('Invalid vector globe stream schema');
    }
    if (typeof stream.name !== 'string' || names.has(stream.name)) {
      throw new Error('Invalid vector globe stream set');
    }
    names.add(stream.name);
    const expected = EXPECTED_STREAMS.get(stream.name);
    if (!expected) throw new Error('Invalid vector globe stream set');
    if (stream.mode !== expected.mode) {
      throw new Error(`Invalid vector globe stream mode: ${stream.name}`);
    }
    if (
      !Number.isSafeInteger(stream.count) ||
      (stream.count as number) <= 0 ||
      !Number.isSafeInteger(stream.stride) ||
      !expected.strides.includes(stream.stride as number) ||
      !Number.isSafeInteger(stream.byteLength) ||
      (stream.byteLength as number) <= 0
    ) {
      throw new Error(`Invalid vector globe stream bounds: ${stream.name}`);
    }
    const streamDecodedBytes =
      (stream.count as number) * (stream.stride as number);
    if (!Number.isSafeInteger(streamDecodedBytes)) {
      throw new Error('Vector globe decoded byte budget exceeded');
    }
    decodedBytes += streamDecodedBytes;
    encodedBytes += stream.byteLength as number;
    if (
      !Number.isSafeInteger(decodedBytes) ||
      decodedBytes > MAX_VECTOR_DECODE_BYTES
    ) {
      throw new Error('Vector globe decoded byte budget exceeded');
    }
    return stream as unknown as VectorStreamDescriptor;
  });
  if (encodedBytes !== payloadBytes) {
    throw new Error('Invalid vector globe encoded stream lengths');
  }
  if (
    streams.find((stream) => stream.name === 'surfaceIndex')!.count % 3 !==
    0
  ) {
    throw new Error('Invalid vector globe triangle count');
  }
  return { countries, streams };
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    [...expected].sort().every((key, index) => keys[index] === key)
  );
}
