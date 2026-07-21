import { useCallback, useEffect, useState } from 'react';
import {
  configureGeoNamesCityImporter,
  loadGeoNamesCityIndex,
  type GeoNamesCity,
} from './geonamesCities';

configureGeoNamesCityImporter(async () => {
  const response = await fetch(
    new URL('../../data/generated/geonames-major-cities.json', import.meta.url),
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

export function useGeoNamesCityIndex(enabled: boolean): GeoNamesCityLoadState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GeoNamesCityLoadState>({
    status: 'loading',
    data: null,
  });
  const retry = useCallback(() => {
    setState({ status: 'loading', data: null });
    setAttempt((current) => current + 1);
  }, []);
  const load = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!enabled && attempt === 0) return;
    let active = true;
    void loadGeoNamesCityIndex()
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ status: 'error', data: null, retry });
      });
    return () => {
      active = false;
    };
  }, [attempt, enabled, retry]);

  return enabled || attempt > 0 ? state : { status: 'idle', data: null, load };
}
