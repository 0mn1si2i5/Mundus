import { describe, expect, it } from 'vitest';
import {
  decodeVectorGlobe,
  MAX_VECTOR_DECODE_BYTES,
} from './vectorGlobeLoader';

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
