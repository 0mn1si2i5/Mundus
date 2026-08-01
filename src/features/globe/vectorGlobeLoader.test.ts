import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decodeVectorGlobe,
  loadVectorGlobe,
  MAX_VECTOR_DECODE_BYTES,
} from './vectorGlobeLoader';

const generatedAssetPaths = {
  '110m': resolve('src/data/generated/natural-earth-vector-globe-110m.mvg'),
  '50m': resolve('src/data/generated/natural-earth-vector-globe-50m.mvg'),
} as const;

async function generatedAsset(detail: keyof typeof generatedAssetPaths) {
  return new Uint8Array(await readFile(generatedAssetPaths[detail]));
}

function respondWith(bytes: Uint8Array) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(bytes.slice().buffer, {
        status: 200,
      }),
    ),
  );
}

function asset(metadata: unknown, payload = new Uint8Array()) {
  const json = new TextEncoder().encode(JSON.stringify(metadata));
  const bytes = new Uint8Array(8 + json.length + payload.length);
  bytes.set(new TextEncoder().encode('MVG2'));
  new DataView(bytes.buffer).setUint32(4, json.length, true);
  bytes.set(json, 8);
  bytes.set(payload, 8 + json.length);
  return bytes.buffer;
}

describe('vector globe loader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects a valid vector asset swapped into the requested resolution', async () => {
    respondWith(await generatedAsset('50m'));
    await expect(loadVectorGlobe('110m')).rejects.toThrow(
      'Vector globe asset identity mismatch',
    );
  });

  it('rejects a truncated requested vector asset by manifest identity', async () => {
    const bytes = await generatedAsset('110m');
    respondWith(bytes.subarray(0, bytes.byteLength - 1));
    await expect(loadVectorGlobe('110m')).rejects.toThrow(
      'Vector globe asset identity mismatch',
    );
  });

  it('rejects post-build byte alteration by manifest digest', async () => {
    const bytes = await generatedAsset('50m');
    bytes[bytes.byteLength - 1]! ^= 1;
    respondWith(bytes);
    await expect(loadVectorGlobe('50m')).rejects.toThrow(
      'Vector globe asset identity mismatch',
    );
  });

  it('rejects malformed or unsupported assets without constructing geometry', async () => {
    await expect(
      decodeVectorGlobe(new TextEncoder().encode('bad!').buffer),
    ).rejects.toThrow('Unsupported vector globe asset');
  });

  it('rejects truncated metadata before invoking meshopt', async () => {
    const bytes = new Uint8Array(12);
    bytes.set(new TextEncoder().encode('MVG2'));
    new DataView(bytes.buffer).setUint32(4, 100, true);
    await expect(decodeVectorGlobe(bytes.buffer)).rejects.toThrow(
      'Invalid vector globe metadata length',
    );
  });

  const validCountries = [
    { countryId: 'ne-156', name: 'China', countryIndex: 156 },
  ];
  const validStreams = [
    ['surfaceVertex', 'ATTRIBUTES', 1, 8],
    ['surfaceIndex', 'TRIANGLES', 3, 2],
    ['coastVertex', 'ATTRIBUTES', 1, 8],
    ['coastIndex', 'INDICES', 2, 2],
    ['borderVertex', 'ATTRIBUTES', 1, 8],
    ['borderIndex', 'INDICES', 2, 2],
  ].map(([name, mode, count, stride]) => ({
    name,
    mode,
    count,
    stride,
    byteLength: 1,
  }));

  it.each([
    [
      { version: 3, countries: validCountries, streams: validStreams },
      'version',
    ],
    [
      {
        version: 2,
        countries: validCountries,
        streams: validStreams.slice(0, 5),
      },
      'stream set',
    ],
    [
      {
        version: 2,
        countries: validCountries,
        streams: [...validStreams, validStreams[0]],
      },
      'stream set',
    ],
    [
      {
        version: 2,
        countries: validCountries,
        streams: validStreams.map((item, index) =>
          index === 0 ? { ...item, mode: 'UNKNOWN' } : item,
        ),
      },
      'mode',
    ],
    [
      {
        version: 2,
        countries: [{ countryId: 'bad', name: '', countryIndex: 1000 }],
        streams: validStreams,
      },
      'country',
    ],
    [
      {
        version: 2,
        countries: validCountries,
        streams: validStreams,
        extra: true,
      },
      'schema',
    ],
    [
      {
        version: 2,
        countries: [{ ...validCountries[0], extra: true }],
        streams: validStreams,
      },
      'country',
    ],
    [
      {
        version: 2,
        countries: validCountries,
        streams: validStreams.map((item, index) =>
          index === 0 ? { ...item, extra: true } : item,
        ),
      },
      'stream schema',
    ],
  ])(
    'rejects invalid schema before allocation: %s',
    async (metadata, message) => {
      await expect(
        decodeVectorGlobe(asset(metadata, new Uint8Array(6))),
      ).rejects.toThrow(message);
    },
  );

  it('rejects malformed metadata fuzz without allocation errors', async () => {
    for (let index = 0; index < 64; index += 1) {
      const metadata = {
        version: index % 4,
        countries:
          index % 3 === 0
            ? null
            : [
                {
                  countryId: `bad-${index}`,
                  name: '',
                  countryIndex: index * 100,
                },
              ],
        streams: index % 5 === 0 ? {} : validStreams.slice(0, index % 7),
      };
      await expect(
        decodeVectorGlobe(asset(metadata, new Uint8Array(8))),
      ).rejects.toThrow(/vector globe/i);
    }
  });

  it('rejects huge decoded sizes before allocating target buffers', async () => {
    const streams = validStreams.map((item, index) =>
      index === 0 ? { ...item, count: Number.MAX_SAFE_INTEGER } : item,
    );
    await expect(
      decodeVectorGlobe(
        asset(
          { version: 2, countries: validCountries, streams },
          new Uint8Array(6),
        ),
      ),
    ).rejects.toThrow('decoded byte budget');
    expect(MAX_VECTOR_DECODE_BYTES).toBeLessThanOrEqual(32 * 1024 * 1024);
  });
});
