import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { DATA_MANIFESTS, dataManifestSchema } from './registry';

describe('data registry', () => {
  it('contains valid manifests with unique ids', () => {
    const ids = DATA_MANIFESTS.map((manifest) => manifest.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'natural-earth-countries-110m',
      'undp-hdr-2025-development',
      'geonames-major-cities',
    ]);
    expect(
      DATA_MANIFESTS.every(
        (manifest) => dataManifestSchema.safeParse(manifest).success,
      ),
    ).toBe(true);
  });

  it('contains no retired populated-place pipeline', () => {
    for (const path of [
      'src/features/antipodes/populatedPlaces.ts',
      'src/data/generated/natural-earth-populated-places-50m.json',
      'src/data/manifests/natural-earth-populated-places-50m.json',
      'scripts/build-populated-places.mjs',
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
  });

  it('pins the licensed GeoNames major-city snapshot and derived budgets', () => {
    const manifest = DATA_MANIFESTS.find(
      (candidate) => candidate.id === 'geonames-major-cities',
    );

    expect(manifest).toMatchObject({
      sourceName: 'GeoNames geographical database',
      distributionUrl:
        'https://download.geonames.org/export/dump/cities15000.zip',
      licenseName: 'CC BY 4.0',
      retrievedAt: '2026-07-21',
      sha256:
        '6c84524d26553d8657d4fda1853ac2c4fafbd5d45885a862c04e16c8604c1ec7',
      attribution: 'Contains GeoNames data, licensed under CC BY 4.0',
      recordCount: expect.any(Number),
      rawBytes: expect.any(Number),
      gzipBytes: expect.any(Number),
      staticDecodedBytesEstimate: expect.any(Number),
      runtimeDecodedBytesEstimate: expect.any(Number),
    });
    expect(manifest?.auxiliarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          distributionUrl:
            'https://download.geonames.org/export/dump/alternateNamesV2.zip',
          sha256:
            '77c5dbcdf73799beaf416813a6b062eb8b0ff0a21b80a3338dcee95592b64c6b',
        }),
        expect.objectContaining({
          distributionUrl:
            'https://download.geonames.org/export/dump/countryInfo.txt',
          sha256:
            '93bafc525813f22e4711ff9ed6d626343094ce48c26388dc7c49189b3d7d5512',
        }),
        expect.objectContaining({
          distributionUrl:
            'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
          sha256:
            '34784457b76b988a669dff7c3e4b104e4902c0875643cff019281ac79dfa2992',
        }),
        expect.objectContaining({
          distributionUrl:
            'https://download.geonames.org/export/dump/readme.txt',
          sha256:
            'b1957379b6c1242c700c98ac9a8aa0a09f56c3c0a50ee72175527005f48ef2c5',
        }),
      ]),
    );
    expect(manifest?.recordCount).toBeLessThanOrEqual(10_000);
    expect(manifest?.rawBytes).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    expect(manifest?.gzipBytes).toBeLessThanOrEqual(450 * 1024);
    expect(manifest?.runtimeDecodedBytesEstimate).toBeLessThanOrEqual(
      8 * 1024 * 1024,
    );
  });
});
