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
          state.point === previous.point &&
          state.developmentIndicator === previous.developmentIndicator &&
          state.developmentYear === previous.developmentYear)
      ) {
        return;
      }
      const query = serializeUrlState(state);
      const onlyDevelopmentYearChanged =
        state.activeMode === previous.activeMode &&
        state.point === previous.point &&
        state.developmentIndicator === previous.developmentIndicator &&
        state.developmentYear !== previous.developmentYear;
      const updateHistory = onlyDevelopmentYearChanged
        ? window.history.replaceState
        : window.history.pushState;
      updateHistory.call(
        window.history,
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
