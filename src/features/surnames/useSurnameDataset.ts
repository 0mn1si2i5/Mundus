import { useEffect, useSyncExternalStore } from 'react';
import { createResourceStore } from '../../state/resourceStore';
import { loadSurnameDataset, type SurnameDataset } from './surnameData';

export type SurnameLoadState =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: SurnameDataset }
  | { status: 'error'; data: null; retry: () => void };

const store = createResourceStore<SurnameDataset>(() => loadSurnameDataset());

export function resetSurnameDatasetStore(): void {
  store.reset();
}

export function useSurnameDataset(enabled: boolean): SurnameLoadState {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    store.register();
    return () => store.unregister();
  }, [enabled]);

  if (!enabled) return { status: 'idle', data: null };
  return snapshot;
}
