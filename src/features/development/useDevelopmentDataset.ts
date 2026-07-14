import { useCallback, useEffect, useState } from 'react';
import {
  loadDevelopmentDataset,
  type DevelopmentDataset,
} from './developmentData';

export type DevelopmentLoadState =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: DevelopmentDataset }
  | { status: 'error'; data: null; retry: () => void };

export function useDevelopmentDataset(enabled: boolean): DevelopmentLoadState {
  const [state, setState] = useState<DevelopmentLoadState>({
    status: 'loading',
    data: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: 'loading', data: null });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadDevelopmentDataset()
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

  return enabled ? state : { status: 'idle', data: null };
}
