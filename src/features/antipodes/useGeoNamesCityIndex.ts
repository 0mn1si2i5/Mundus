import { useEffect, useSyncExternalStore } from 'react';
import {
  configureGeoNamesCityImporter,
  loadGeoNamesCityIndex,
  type GeoNamesCity,
} from './geonamesCities';
import { createResourceStore } from '../../state/resourceStore';

configureGeoNamesCityImporter(async (signal) => {
  const response = await fetch(
    new URL('../../data/generated/geonames-major-cities.json', import.meta.url),
    { signal },
  );
  if (!response.ok)
    throw new Error(`GeoNames city index failed: ${response.status}`);
  return { default: await response.json() };
});

export type GeoNamesCityLoadState =
  | { status: 'idle'; data: null; load: () => void }
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: readonly GeoNamesCity[] }
  | { status: 'error'; data: null; retry: () => void };

/**
 * One shared GeoNames city-index load. The globe presentation and the mode
 * experience both subscribe to the same store, so a retry from either surface
 * restores both, and the underlying fetch is really aborted only when the last
 * enabled consumer leaves while the request is still pending.
 */
const store = createResourceStore<readonly GeoNamesCity[]>((signal) =>
  loadGeoNamesCityIndex(signal),
);

export function resetGeoNamesCityIndexStore() {
  store.reset();
}

export function useGeoNamesCityIndex(enabled: boolean): GeoNamesCityLoadState {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    store.register();
    return () => store.unregister();
  }, [enabled]);

  if (!enabled || snapshot.status === 'idle') {
    return { status: 'idle', data: null, load: store.load };
  }
  return snapshot;
}
