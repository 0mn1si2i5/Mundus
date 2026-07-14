import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { GeoPoint } from '../globe/geo';
import { surfaceDistanceKm } from './distance';

const placeRowSchema = z.tuple([
  z.number().int().positive(),
  z.string().min(1),
  z.string().min(1),
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
  z.number().nonnegative().nullable(),
]);

const populatedPlacesSchema = z.object({
  formatVersion: z.literal(1),
  places: z.array(placeRowSchema).min(1),
});

export interface PopulatedPlace {
  id: number;
  name: string;
  country: string;
  point: GeoPoint;
  population: number | null;
}

export interface NearestPopulatedPlace {
  place: PopulatedPlace;
  distanceKm: number;
}

type LoadState =
  | { status: 'idle'; result: null }
  | { status: 'loading'; result: null }
  | { status: 'ready'; result: NearestPopulatedPlace }
  | { status: 'error'; result: null };

let placesPromise: Promise<readonly PopulatedPlace[]> | undefined;

export function decodePopulatedPlaces(input: unknown): PopulatedPlace[] {
  const dataset = populatedPlacesSchema.parse(input);
  return dataset.places.map(
    ([id, name, country, latitude, longitude, population]) => ({
      id,
      name,
      country,
      point: { latitude, longitude },
      population,
    }),
  );
}

export function findNearestPopulatedPlace(
  point: GeoPoint,
  places: readonly PopulatedPlace[],
): NearestPopulatedPlace {
  const first = places[0];
  if (!first) {
    throw new Error('Cannot search an empty populated places index.');
  }

  let nearest = first;
  let nearestDistance = surfaceDistanceKm(point, nearest.point);

  for (let index = 1; index < places.length; index += 1) {
    const candidate = places[index]!;
    const distance = surfaceDistanceKm(point, candidate.point);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return { place: nearest, distanceKm: nearestDistance };
}

export function useNearestPopulatedPlace(
  point: GeoPoint,
  enabled = true,
): LoadState {
  const { latitude, longitude } = point;
  const key = `${latitude},${longitude}`;
  const [state, setState] = useState<LoadState & { key: string }>({
    key,
    status: 'loading',
    result: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const requestKey = `${latitude},${longitude}`;

    void loadPopulatedPlaces()
      .then((places) => {
        if (!active) return;
        setState({
          key: requestKey,
          status: 'ready',
          result: findNearestPopulatedPlace({ latitude, longitude }, places),
        });
      })
      .catch(() => {
        if (active) {
          setState({ key: requestKey, status: 'error', result: null });
        }
      });

    return () => {
      active = false;
    };
  }, [enabled, latitude, longitude]);

  if (!enabled) return { status: 'idle', result: null };
  return state.key === key ? state : { status: 'loading', result: null };
}

function loadPopulatedPlaces(): Promise<readonly PopulatedPlace[]> {
  placesPromise ??=
    import('../../data/generated/natural-earth-populated-places-50m.json')
      .then((module) => decodePopulatedPlaces(module.default))
      .catch((error: unknown) => {
        placesPromise = undefined;
        throw error;
      });
  return placesPromise;
}
