import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { matchImageToGrid } from '../lib/match';
import { embedPhotoGrid, photoArea } from '../lib/boardPadding';
import type { BeadCollection, Pattern } from '../db/schema';

const DEBOUNCE_MS = 80;

/** Per pattern id: the match inputs its gridData was last produced from (or last accepted as-is). */
const lastMatchSignature = new Map<string, string>();

function collectionBeadsFor(pattern: Pattern, collections: BeadCollection[]) {
  return pattern.paletteMode === 'collection' ? (collections.find((c) => c.id === pattern.collectionId)?.beads ?? []) : [];
}

/** Everything the photo match depends on — when this changes, the grid is stale. */
function matchSignature(pattern: Pattern, collections: BeadCollection[]): string {
  return JSON.stringify([
    pattern.cropRect,
    pattern.boardConfig.widthPegs,
    pattern.boardConfig.heightPegs,
    pattern.boardPadding ?? null,
    pattern.preprocessSettings,
    pattern.paletteMode,
    pattern.colorCount,
    pattern.ditherMode,
    pattern.samplingMode,
    pattern.colorSwaps,
    collectionBeadsFor(pattern, collections).map((b) => `${b.id}:${b.hex}`),
  ]);
}

/**
 * Declares a pattern's current grid up to date, so the next Adjust/Board
 * visit doesn't re-match over it. The editor calls this on DONE: its
 * changes (a board extended or rotated, beads painted) alter the board but
 * must not trigger a fresh photo match that would wipe them.
 */
export function markGridCurrent(pattern: Pattern, collections: BeadCollection[]): void {
  lastMatchSignature.set(pattern.id, matchSignature(pattern, collections));
}

/**
 * Loads the draft's source image and keeps gridData live-matched against
 * whatever fields currently drive the match (crop, board size, palette,
 * contrast, dither). Shared by the Colors and Board Setup screens so
 * either one can change board size / color settings and see the grid
 * update, regardless of which is currently mounted.
 */
export function useLiveMatch(): HTMLImageElement | null {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const didInitialMatch = useRef(false);

  useEffect(() => {
    if (!draft?.sourceImage) return;
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = draft.sourceImage;
  }, [draft?.sourceImage]);

  useEffect(() => {
    if (!draft || !imgEl) return;
    const collectionBeads = collectionBeadsFor(draft, state.collections);
    const signature = matchSignature(draft, state.collections);
    // The photo fills only the area inside any board extension.
    const area = photoArea(draft);
    // Don't clobber a hand-edited grid just because this hook remounted —
    // unless the inputs changed while it was unmounted (e.g. a collection
    // was picked or edited on the Collections screens), which it would
    // otherwise never notice.
    if (!didInitialMatch.current) {
      didInitialMatch.current = true;
      const previous = lastMatchSignature.get(draft.id);
      if (draft.gridData.length > 0 && (previous === undefined || previous === signature)) {
        lastMatchSignature.set(draft.id, signature);
        return;
      }
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      lastMatchSignature.set(draft.id, signature);
      const result = matchImageToGrid({
        image: imgEl,
        cropRect: draft.cropRect,
        widthPegs: area.width,
        heightPegs: area.height,
        preprocess: draft.preprocessSettings,
        paletteMode: draft.paletteMode,
        colorCount: draft.colorCount,
        collectionBeads,
        ditherMode: draft.ditherMode,
        samplingMode: draft.samplingMode,
        colorSwaps: draft.colorSwaps ?? [],
      });
      // Painted padding cells survive: only the photo area is redrawn.
      const gridData = embedPhotoGrid(result.gridData, area.padding, draft.gridData);
      dispatch({ type: 'draft/update', patch: { gridData } });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(debounceRef.current);
    // Re-run whenever anything the algorithm depends on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    imgEl,
    draft?.cropRect,
    draft?.boardConfig.widthPegs,
    draft?.boardConfig.heightPegs,
    draft?.boardPadding,
    draft?.preprocessSettings,
    draft?.paletteMode,
    draft?.colorCount,
    draft?.ditherMode,
    draft?.samplingMode,
    draft?.collectionId,
    draft?.colorSwaps,
    state.collections,
  ]);

  return imgEl;
}
