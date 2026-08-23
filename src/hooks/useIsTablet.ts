import { useEffect, useState } from 'react';

const QUERY = '(min-width: 900px)';

/** iPad's 2a breakpoint per the handoff — "one breakpoint, not a second app." */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsTablet(mql.matches);
    // Some embedding/automation environments resize the viewport without
    // firing MediaQueryList's 'change' event — a plain resize listener is a
    // cheap, reliable fallback on top of the (normally sufficient) mql event.
    mql.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  return isTablet;
}
