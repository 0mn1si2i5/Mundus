import { z } from 'zod';
import naturalEarthManifest from './manifests/natural-earth-110m.json';
import populatedPlacesManifest from './manifests/natural-earth-populated-places-50m.json';
import undpDevelopmentManifest from './manifests/undp-hdr-2025-development.json';

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
});

export type DataManifest = z.infer<typeof dataManifestSchema>;

export const DATA_MANIFESTS: readonly DataManifest[] = [
  dataManifestSchema.parse(naturalEarthManifest),
  dataManifestSchema.parse(populatedPlacesManifest),
  dataManifestSchema.parse(undpDevelopmentManifest),
];
