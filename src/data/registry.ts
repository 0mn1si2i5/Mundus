import { z } from 'zod';
import naturalEarthManifest from './manifests/natural-earth-110m.json';
import undpDevelopmentManifest from './manifests/undp-hdr-2025-development.json';
import geoNamesMajorCitiesManifest from './manifests/geonames-major-cities.json';

const auxiliarySourceSchema = z.object({
  sourceName: z.string().min(1),
  distributionUrl: z.url(),
  version: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  purpose: z.string().min(1),
});

export const dataManifestSchema = z.object({
  id: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.url(),
  distributionUrl: z.url(),
  licenseName: z.string().min(1),
  licenseUrl: z.url(),
  version: z.string().min(1),
  retrievedAt: z.iso.date(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  derivedAssetSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  auxiliarySources: z.array(auxiliarySourceSchema).optional(),
  attribution: z.string().min(1),
  redistribution: z.enum(['allowed', 'restricted', 'unknown']),
  transformations: z.array(z.string().min(1)).min(1),
  missingValuePolicy: z.string().min(1),
  boundaryPolicy: z.string().min(1),
  recordCount: z.number().int().nonnegative().optional(),
  rawBytes: z.number().int().nonnegative().optional(),
  gzipBytes: z.number().int().nonnegative().optional(),
  staticDecodedBytesEstimate: z.number().int().nonnegative().optional(),
  runtimeDecodedBytesEstimate: z.number().int().nonnegative().optional(),
});

export type DataManifest = z.infer<typeof dataManifestSchema>;

export const DATA_MANIFESTS: readonly DataManifest[] = [
  dataManifestSchema.parse(naturalEarthManifest),
  dataManifestSchema.parse(undpDevelopmentManifest),
  dataManifestSchema.parse(geoNamesMajorCitiesManifest),
];
