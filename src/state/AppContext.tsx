import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { listCollections, listPatterns, seedStarterCollections } from '../db/db';
import { registerCustomBeads } from '../lib/catalog';
import { appReducer, initialState, type Action, type AppState } from './appReducer';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Registered during render, not in an effect: screens draw their canvases
  // in their own effects, which run before this provider's would.
  registerCustomBeads(state.collections.flatMap((c) => c.beads));
  registerCustomBeads(state.patterns.flatMap((p) => p.customBeads ?? []));
  if (state.draft?.customBeads) registerCustomBeads(state.draft.customBeads);

  useEffect(() => {
    (async () => {
      await seedStarterCollections(); // "My Colors" + Hama/Perler presets, brand-new installs only
      const [patterns, collections] = await Promise.all([listPatterns(), listCollections()]);
      dispatch({ type: 'library/loaded', patterns, collections });
    })();
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
