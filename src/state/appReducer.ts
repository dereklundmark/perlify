import type { BeadCollection, Pattern } from '../db/schema';

// Swap's two steps and History are views *within* the edit screen (they
// share its in-progress grid + history state), not separate routes.
export type Screen =
  | 'library'
  | 'photo'
  | 'adjust'
  | 'board'
  | 'preview'
  | 'export'
  | 'edit'
  | 'collections'
  | 'collection';

// Photo -> Adjust (colors/contrast, big live preview) -> Board (size/bead
// type) -> Preview -> Export. Adjust and Board show no step number (center
// shows the pattern name / "BOARD SETUP" instead), matching the old merged
// Adjust screen's treatment.
export const WIZARD_STEPS: Partial<Record<Screen, number>> = {
  photo: 1,
  preview: 4,
  export: 5,
};
export const WIZARD_TOTAL_STEPS = 5;

export interface AppState {
  screen: Screen;
  draft: Pattern | null;
  patterns: Pattern[];
  collections: BeadCollection[];
  /** Which collection `collection` (the editor screen) is currently open on. */
  editingCollectionId: string | null;
  libraryLoading: boolean;
}

export const initialState: AppState = {
  screen: 'library',
  draft: null,
  patterns: [],
  collections: [],
  editingCollectionId: null,
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
    boardConfig: { beadType: 'regular', widthPegs: 29, heightPegs: 29, boardsWide: 1, boardsHigh: 1 },
    collectionId,
    paletteMode: 'auto',
    colorCount: 12,
    ditherMode: 'none',
    preprocessSettings: { contrast: 0, saturation: 0, brightness: 0, duotone: false, duotoneHue: 200 },
    gridData: [],
    gridlines: true,
    symbolOverlay: true,
    previewBackground: 'black',
    seamLines: true,
    pencilHover: true,
  };
}

export type Action =
  | { type: 'library/loaded'; patterns: Pattern[]; collections: BeadCollection[] }
  | { type: 'library/upsert'; pattern: Pattern }
  | { type: 'library/remove'; id: string }
  | { type: 'draft/start' }
  | { type: 'draft/open'; pattern: Pattern }
  | { type: 'draft/update'; patch: Partial<Pattern> }
  | { type: 'draft/discard' }
  | { type: 'collection/upsert'; collection: BeadCollection }
  | { type: 'collection/remove'; id: string }
  | { type: 'collection/edit'; id: string }
  | { type: 'nav'; screen: Screen };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'library/loaded':
      return {
        ...state,
        patterns: action.patterns,
        collections: action.collections,
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
        draft: createBlankPattern(state.collections[0]?.id ?? null),
        screen: 'photo',
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

    case 'collection/upsert': {
      const withoutOld = state.collections.filter((c) => c.id !== action.collection.id);
      return { ...state, collections: [...withoutOld, action.collection] };
    }

    case 'collection/remove':
      return { ...state, collections: state.collections.filter((c) => c.id !== action.id) };

    case 'collection/edit':
      return { ...state, editingCollectionId: action.id, screen: 'collection' };

    case 'nav':
      return { ...state, screen: action.screen };

    default:
      return state;
  }
}
