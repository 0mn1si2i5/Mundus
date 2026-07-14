import { z } from 'zod';
import naturalEarthManifest from './manifests/natural-earth-110m.json';

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
  attribution: z.string().min(1),
  redistribution: z.enum(['allowed', 'restricted', 'unknown']),
  transformations: z.array(z.string().min(1)).min(1),
  missingValuePolicy: z.string().min(1),
  boundaryPolicy: z.string().min(1),
});

export type DataManifest = z.infer<typeof dataManifestSchema>;

export const DATA_MANIFESTS: readonly DataManifest[] = [
  dataManifestSchema.parse(naturalEarthManifest),
];
