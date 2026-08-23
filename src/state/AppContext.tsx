import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { ensureDefaultCollection, listPatterns } from '../db/db';
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
      const [patterns, collection] = await Promise.all([listPatterns(), ensureDefaultCollection()]);
      dispatch({ type: 'library/loaded', patterns, collection });
    })();
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
