import { useEffect } from 'react';
import { useAppStore } from '../state/appStore';
import { parseUrlState, serializeUrlState } from '../state/urlState';

export function useUrlState() {
  useEffect(() => {
    let applyingHistory = false;
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (
        applyingHistory ||
        (state.activeMode === previous.activeMode &&
          state.point === previous.point)
      ) {
        return;
      }
      const query = serializeUrlState(state);
      window.history.pushState(
        null,
        '',
        `${window.location.pathname}${query}${window.location.hash}`,
      );
    });

    const restore = () => {
      applyingHistory = true;
      useAppStore.setState(parseUrlState(window.location.search));
      applyingHistory = false;
    };
    window.addEventListener('popstate', restore);

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', restore);
    };
  }, []);
}
