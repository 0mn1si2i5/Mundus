import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { DATA_MANIFESTS, dataManifestSchema } from './registry';

describe('data registry', () => {
  it('contains valid manifests with unique ids', () => {
    const ids = DATA_MANIFESTS.map((manifest) => manifest.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'natural-earth-countries-110m',
      'natural-earth-vector-globe',
      'undp-hdr-2025-development',
      'geonames-major-cities',
    ]);
    expect(
      DATA_MANIFESTS.every(
        (manifest) => dataManifestSchema.safeParse(manifest).success,
      ),
    ).toBe(true);
  });

  it('pins both vector resolutions and their transfer and GPU budgets', () => {
    const manifest = DATA_MANIFESTS.find(
      (candidate) => candidate.id === 'natural-earth-vector-globe',
    );
    expect(manifest?.sourceAssets).toMatchObject({
      '110m': {
        sha256:
          '2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8',
      },
      '50m': {
        sha256:
          '04342cdc1e3016bcd7db1630de95684d67b79fe3c8c460321e87aef469502394',
      },
    });
    expect(manifest?.derivedAssets?.['110m']?.gpuBytes).toBeLessThanOrEqual(
      8 * 1024 * 1024,
    );
    expect(manifest?.derivedAssets?.['50m']?.gpuBytes).toBeLessThanOrEqual(
      24 * 1024 * 1024,
    );
    expect(manifest?.derivedAssets?.['50m']?.gzipBytes).toBeLessThanOrEqual(
      1.5 * 1024 * 1024,
    );
    expect(
      manifest?.derivedAssets?.['110m']?.droppedOutsideAreaFraction,
    ).toBeLessThan(0.0001);
    expect(
      manifest?.derivedAssets?.['50m']?.droppedOutsideAreaFraction,
    ).toBeLessThan(0.0001);
    expect(manifest?.derivedAssets?.['50m']?.runtimeGpuBytes).toBe(
      manifest?.derivedAssets?.['50m']?.gpuBytes,
    );
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
      licenseName: 'CC BY 4.0',
      upstreamCapture: {
        retrievedAt: expect.stringMatching(/^2026-08-01T/),
        sources: expect.arrayContaining([
          expect.objectContaining({
            distributionUrl:
              'https://download.geonames.org/export/dump/cities15000.zip',
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        ]),
      },
      immutableBuildInput: {
        path: 'src/data/generated/geonames-major-cities-input.json',
        schemaVersion: 2,
        sha256:
          '49b3f2114d1e71277572b2773cb1e5b8242f3eb22a9e89598eb95b79408c5621',
        rawBytes: 2814375,
      },
      derivedAsset: {
        path: 'src/data/generated/geonames-major-cities.json',
        sha256:
          'b48d0d5c34229b2337a979f8362bef3c7075bf67644819fe32ebe691a5d440f4',
        rawBytes: 780004,
      },
      attribution: 'Contains GeoNames data, licensed under CC BY 4.0',
      recordCount: 6953,
      rawBytes: 780004,
      gzipBytes: 275263,
      staticDecodedBytesEstimate: 3120016,
      runtimeDecodedBytesEstimate: 4764314,
    });
    expect(manifest).not.toHaveProperty('distributionUrl');
    expect(manifest).not.toHaveProperty('sha256');
    expect(
      manifest?.upstreamCapture?.sources.map((source) => source.sha256),
    ).toEqual([
      '9ba4c24f8b514081139a813be393f2f01e98a7a059e5f3ac8c96c786bf532481',
      'd46fc26c590c29e663792dd9bc5dc07322ee99567681ee45ee0df9f935c04204',
      '93bafc525813f22e4711ff9ed6d626343094ce48c26388dc7c49189b3d7d5512',
      '34784457b76b988a669dff7c3e4b104e4902c0875643cff019281ac79dfa2992',
      'b1957379b6c1242c700c98ac9a8aa0a09f56c3c0a50ee72175527005f48ef2c5',
    ]);
    expect(manifest?.recordCount).toBeLessThanOrEqual(10_000);
    expect(manifest?.rawBytes).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    expect(manifest?.gzipBytes).toBeLessThanOrEqual(450 * 1024);
    expect(manifest?.runtimeDecodedBytesEstimate).toBeLessThanOrEqual(
      8 * 1024 * 1024,
    );
  });
});
