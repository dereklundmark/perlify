import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { ensureDefaultCollection, ensurePresetCollections, listCollections, listPatterns } from '../db/db';
import { appReducer, initialState, type Action, type AppState } from './appReducer';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    (async () => {
      await Promise.all([ensureDefaultCollection(), ensurePresetCollections()]); // seeds "My Colors" + Hama/Perler presets on a brand-new install
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
