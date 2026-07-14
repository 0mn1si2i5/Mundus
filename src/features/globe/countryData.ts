import { geoBounds, geoContains, geoEquirectangular, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json';
import type { GeoPoint } from './geo';

interface AtlasProperties {
  name: string;
}

type AtlasTopology = Topology<{
  countries: GeometryCollection<AtlasProperties>;
}>;

export interface CountryFeatureProperties {
  countryId: string;
  name: string;
}

export type CountryFeature = Feature<Geometry, CountryFeatureProperties>;

export interface CountryRef {
  countryId: string;
  name: string;
}

interface IndexedCountry {
  feature: CountryFeature;
  south: number;
  north: number;
}

export interface CountryDataset {
  countries: FeatureCollection<Geometry, CountryFeatureProperties>;
  findCountry: (point: GeoPoint) => CountryRef | null;
}

let cachedDataset: CountryDataset | undefined;

const EXCEPTION_COUNTRY_IDS: Readonly<Record<string, string>> = {
  'N. Cyprus': 'ne-x-northern-cyprus',
  Somaliland: 'ne-x-somaliland',
  Kosovo: 'ne-x-kosovo',
};

export function getCountryDataset(): CountryDataset {
  if (cachedDataset) return cachedDataset;

  const topology = atlas as unknown as AtlasTopology;
  const raw = feature(
    topology,
    topology.objects.countries,
  ) as unknown as FeatureCollection<Geometry, AtlasProperties>;
  const countries: FeatureCollection<Geometry, CountryFeatureProperties> = {
    type: 'FeatureCollection',
    features: raw.features.map((country) => ({
      ...country,
      properties: {
        countryId: countryIdFor(country.id, country.properties.name),
        name: country.properties.name,
      },
    })),
  };
  const index: IndexedCountry[] = countries.features.map((country) => {
    const [[, south], [, north]] = geoBounds(country);
    return { feature: country, south, north };
  });

  cachedDataset = {
    countries,
    findCountry: ({ latitude, longitude }) => {
      const match = index.find(
        ({ feature: candidate, south, north }) =>
          latitude >= south &&
          latitude <= north &&
          geoContains(candidate, [longitude, latitude]),
      );
      return match
        ? {
            countryId: match.feature.properties.countryId,
            name: match.feature.properties.name,
          }
        : null;
    },
  };

  return cachedDataset;
}

function countryIdFor(
  sourceId: string | number | undefined,
  sourceName: string,
): string {
  if (sourceId !== undefined) return `ne-${String(sourceId).padStart(3, '0')}`;
  const exception = EXCEPTION_COUNTRY_IDS[sourceName];
  if (!exception)
    throw new Error(`Missing explicit countryId mapping for ${sourceName}`);
  return exception;
}

export function createCountryTexture(
  dataset: CountryDataset,
  textureWidth: number,
  hoveredCountryId: string | null,
  selectedCountryId: string | null,
  countryFills: ReadonlyMap<string, string> | null = null,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = textureWidth;
  canvas.height = textureWidth / 2;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('Canvas 2D is required to render country texture');

  context.fillStyle = '#102126';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const projection = geoEquirectangular()
    .fitSize([canvas.width, canvas.height], { type: 'Sphere' })
    .precision(0.2);
  const path = geoPath(projection, context);

  context.beginPath();
  path(dataset.countries);
  context.fillStyle = '#263b39';
  context.fill();

  if (countryFills) {
    for (const country of dataset.countries.features) {
      const color = countryFills.get(country.properties.countryId);
      if (!color) continue;
      context.beginPath();
      path(country);
      context.fillStyle = color;
      context.fill();
    }
  }

  context.beginPath();
  path(dataset.countries);
  context.strokeStyle = 'rgba(181, 205, 190, 0.34)';
  context.lineWidth = Math.max(0.55, textureWidth / 2048);
  context.stroke();

  drawCountry(context, path, dataset, selectedCountryId, '#d6cfae', 0.78);
  drawCountry(context, path, dataset, hoveredCountryId, '#9bc9bb', 0.58);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.offset.x = 0.25;
  texture.needsUpdate = true;
  return texture;
}

function drawCountry(
  context: CanvasRenderingContext2D,
  path: ReturnType<typeof geoPath>,
  dataset: CountryDataset,
  countryId: string | null,
  color: string,
  alpha: number,
) {
  if (!countryId) return;
  const country = dataset.countries.features.find(
    (feature) => feature.properties.countryId === countryId,
  );
  if (!country) return;

  context.save();
  context.globalAlpha = alpha;
  context.beginPath();
  path(country);
  context.fillStyle = color;
  context.fill();
  context.restore();
}
