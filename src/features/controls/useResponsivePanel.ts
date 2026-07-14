import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 761px)';

function matchesDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function useResponsivePanel() {
  const [desktop, setDesktop] = useState(matchesDesktop);
  const [expanded, setExpanded] = useState(matchesDesktop);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = (event: MediaQueryListEvent) => {
      setDesktop(event.matches);
      setExpanded(event.matches);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return { desktop, expanded, setExpanded };
}
