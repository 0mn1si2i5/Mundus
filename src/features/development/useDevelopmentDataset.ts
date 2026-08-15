import { useEffect, useSyncExternalStore } from 'react';
import {
  loadDevelopmentDataset,
  type DevelopmentDataset,
} from './developmentData';
import { createResourceStore } from '../../state/resourceStore';

export type DevelopmentLoadState =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: DevelopmentDataset }
  | { status: 'error'; data: null; retry: () => void };

/**
 * One shared Development dataset load, so a retry from the controls restores
 * both the result surface and the globe fills. The asset is a dynamic import
 * chunk that cannot be genuinely cancelled; the store still provides provably
 * equivalent cleanup: a result resolving after the last consumer left is
 * discarded instead of cached, the module promise is reset on failure for a
 * clean retry, and an abort is never surfaced as a data failure.
 */
const store = createResourceStore<DevelopmentDataset>(() =>
  loadDevelopmentDataset(),
);

export function resetDevelopmentDatasetStore() {
  store.reset();
}

export function useDevelopmentDataset(enabled: boolean): DevelopmentLoadState {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    store.register();
    return () => store.unregister();
  }, [enabled]);

  if (!enabled) return { status: 'idle', data: null };
  return snapshot;
}
