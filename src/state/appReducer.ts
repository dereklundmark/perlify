import type { BeadCollection, Pattern } from '../db/schema';

export type Screen = 'library' | 'setup' | 'photo' | 'adjust' | 'preview' | 'export';

export const WIZARD_STEPS: Partial<Record<Screen, number>> = {
  setup: 1,
  photo: 2,
  adjust: 3,
  preview: 4,
  export: 5,
};

export interface AppState {
  screen: Screen;
  draft: Pattern | null;
  patterns: Pattern[];
  collection: BeadCollection | null;
  libraryLoading: boolean;
}

export const initialState: AppState = {
  screen: 'library',
  draft: null,
  patterns: [],
  collection: null,
  libraryLoading: true,
};

export function createBlankPattern(collectionId: string | null): Pattern {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: 'Untitled pattern',
    createdAt: now,
    updatedAt: now,
    sourceImage: '',
    cropRect: { x: 0, y: 0, width: 1, height: 1 },
    boardConfig: { beadType: 'regular', widthPegs: 29, heightPegs: 29 },
    collectionId,
    paletteMode: 'auto',
    colorCount: 12,
    dither: false,
    preprocessSettings: { contrast: 0, saturation: 0, brightness: 0 },
    gridData: [],
    gridlines: true,
    symbolOverlay: true,
    previewBackground: 'black',
  };
}

export type Action =
  | { type: 'library/loaded'; patterns: Pattern[]; collection: BeadCollection }
  | { type: 'library/upsert'; pattern: Pattern }
  | { type: 'library/remove'; id: string }
  | { type: 'draft/start' }
  | { type: 'draft/open'; pattern: Pattern }
  | { type: 'draft/update'; patch: Partial<Pattern> }
  | { type: 'draft/discard' }
  | { type: 'nav'; screen: Screen };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'library/loaded':
      return {
        ...state,
        patterns: action.patterns,
        collection: action.collection,
        libraryLoading: false,
      };

    case 'library/upsert': {
      const withoutOld = state.patterns.filter((p) => p.id !== action.pattern.id);
      return { ...state, patterns: [action.pattern, ...withoutOld] };
    }

    case 'library/remove':
      return { ...state, patterns: state.patterns.filter((p) => p.id !== action.id) };

    case 'draft/start':
      return {
        ...state,
        draft: createBlankPattern(state.collection?.id ?? null),
        screen: 'setup',
      };

    case 'draft/open':
      return { ...state, draft: action.pattern, screen: 'adjust' };

    case 'draft/update':
      if (!state.draft) return state;
      return {
        ...state,
        draft: { ...state.draft, ...action.patch, updatedAt: Date.now() },
      };

    case 'draft/discard':
      return { ...state, draft: null, screen: 'library' };

    case 'nav':
      return { ...state, screen: action.screen };

    default:
      return state;
  }
}
