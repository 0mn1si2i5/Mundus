import { useEffect, useState } from 'react';
import {
  loadDevelopmentDataset,
  type DevelopmentDataset,
} from './developmentData';

export type DevelopmentLoadState =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: DevelopmentDataset }
  | { status: 'error'; data: null };

export function useDevelopmentDataset(enabled: boolean): DevelopmentLoadState {
  const [state, setState] = useState<DevelopmentLoadState>({
    status: 'loading',
    data: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadDevelopmentDataset()
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ status: 'error', data: null });
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return enabled ? state : { status: 'idle', data: null };
}
