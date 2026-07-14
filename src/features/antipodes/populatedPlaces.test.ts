import { describe, expect, it } from 'vitest';
import generatedPlaces from '../../data/generated/natural-earth-populated-places-50m.json';
import {
  decodePopulatedPlaces,
  findNearestPopulatedPlace,
  type PopulatedPlace,
} from './populatedPlaces';

const PLACES: readonly PopulatedPlace[] = [
  {
    id: 1,
    name: 'Null Island East',
    country: 'Test',
    point: { latitude: 0, longitude: 1 },
    population: null,
  },
  {
    id: 2,
    name: 'Far North',
    country: 'Test',
    point: { latitude: 70, longitude: 0 },
    population: 100,
  },
];

describe('populated places', () => {
  it('validates the generated Natural Earth index', () => {
    const places = decodePopulatedPlaces(generatedPlaces);
    expect(places).toHaveLength(1251);
    expect(new Set(places.map((place) => place.id)).size).toBe(places.length);
  });

  it('finds the nearest indexed place and preserves missing population', () => {
    const nearest = findNearestPopulatedPlace(
      { latitude: 0, longitude: 0 },
      PLACES,
    );
    expect(nearest.place.name).toBe('Null Island East');
    expect(nearest.place.population).toBeNull();
    expect(nearest.distanceKm).toBeCloseTo(111.2, 0);
  });

  it('rejects an empty index', () => {
    expect(() =>
      findNearestPopulatedPlace({ latitude: 0, longitude: 0 }, []),
    ).toThrow('empty populated places index');
  });
});
