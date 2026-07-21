import { MeshoptDecoder } from 'meshoptimizer/decoder';
import { MeshoptEncoder } from 'meshoptimizer/encoder';

const streamsFor = (result) => [
  vertexStream(
    'surfaceVertex',
    result.surface.positions,
    result.surface.countryIndices,
  ),
  indexStream('surfaceIndex', result.surface.indices, true),
  vertexStream('coastVertex', result.coastline.positions),
  indexStream('coastIndex', result.coastline.indices, false),
  vertexStream('borderVertex', result.borders.positions),
  indexStream('borderIndex', result.borders.indices, false),
];

export async function encodeCompressedAsset(result) {
  await MeshoptEncoder.ready;
  const streams = streamsFor(result).map((stream) => ({
    ...stream,
    encoded:
      stream.mode === 'ATTRIBUTES'
        ? MeshoptEncoder.encodeVertexBuffer(
            stream.bytes,
            stream.count,
            stream.stride,
          )
        : stream.mode === 'TRIANGLES'
          ? MeshoptEncoder.encodeIndexBuffer(
              stream.bytes,
              stream.count,
              stream.stride,
            )
          : MeshoptEncoder.encodeIndexSequence(
              stream.bytes,
              stream.count,
              stream.stride,
            ),
  }));
  const metadata = Buffer.from(
    JSON.stringify({
      version: 2,
      countries: result.countries,
      streams: streams.map(({ name, mode, count, stride, encoded }) => ({
        name,
        mode,
        count,
        stride,
        byteLength: encoded.byteLength,
      })),
    }),
  );
  const header = Buffer.alloc(8);
  header.write('MVG2');
  header.writeUInt32LE(metadata.byteLength, 4);
  return Buffer.concat([
    header,
    metadata,
    ...streams.map(({ encoded }) => encoded),
  ]);
}

export async function decodeCompressedAsset(buffer) {
  await MeshoptDecoder.ready;
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== 'MVG2') throw new Error(`Unsupported vector asset ${magic}`);
  const metadataLength = view.getUint32(4, true);
  const metadata = JSON.parse(
    new TextDecoder().decode(bytes.subarray(8, 8 + metadataLength)),
  );
  let offset = 8 + metadataLength;
  const streams = {};
  for (const descriptor of metadata.streams) {
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
  return {
    countries: metadata.countries,
    descriptors: metadata.streams,
    streams,
  };
}

function vertexStream(name, positions, countryIndices = null) {
  const count = positions.length / 3;
  const stride = 8;
  const bytes = new Uint8Array(count * stride);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < count; index += 1) {
    const offset = index * stride;
    view.setInt16(offset, quantizeSnorm(positions[index * 3]), true);
    view.setInt16(offset + 2, quantizeSnorm(positions[index * 3 + 1]), true);
    view.setInt16(offset + 4, quantizeSnorm(positions[index * 3 + 2]), true);
    view.setUint16(offset + 6, countryIndices?.[index] ?? 0, true);
  }
  return { name, mode: 'ATTRIBUTES', count, stride, bytes };
}

function indexStream(name, indices, triangles) {
  return {
    name,
    mode: triangles ? 'TRIANGLES' : 'INDICES',
    count: indices.length,
    stride: indices.BYTES_PER_ELEMENT,
    bytes: new Uint8Array(
      indices.buffer,
      indices.byteOffset,
      indices.byteLength,
    ),
  };
}

function quantizeSnorm(value) {
  return Math.round(Math.max(-1, Math.min(1, value)) * 32767);
}

export function unpackVertexStream(bytes) {
  const count = bytes.byteLength / 8;
  const positions = new Float32Array(count * 3);
  const countryIndices = new Uint16Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 8;
    positions[index * 3] = view.getInt16(offset, true) / 32767;
    positions[index * 3 + 1] = view.getInt16(offset + 2, true) / 32767;
    positions[index * 3 + 2] = view.getInt16(offset + 4, true) / 32767;
    countryIndices[index] = view.getUint16(offset + 6, true);
  }
  return { positions, countryIndices };
}
