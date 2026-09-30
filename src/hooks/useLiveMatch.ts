import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { matchImageToGrid, usesAllCollectionColors } from '../lib/match';

const DEBOUNCE_MS = 80;

/** Per pattern id: the match inputs its gridData was last produced from (or last accepted as-is). */
const lastMatchSignature = new Map<string, string>();

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
    const collectionBeads =
      draft.paletteMode === 'collection' ? (state.collections.find((c) => c.id === draft.collectionId)?.beads ?? []) : [];
    const useAllCollectionColors = usesAllCollectionColors(draft);
    const signature = JSON.stringify([
      draft.cropRect,
      draft.boardConfig.widthPegs,
      draft.boardConfig.heightPegs,
      draft.preprocessSettings,
      draft.paletteMode,
      draft.colorCount,
      useAllCollectionColors,
      draft.ditherMode,
      draft.samplingMode,
      draft.colorSwaps,
      collectionBeads.map((b) => `${b.id}:${b.hex}`),
    ]);
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
        widthPegs: draft.boardConfig.widthPegs,
        heightPegs: draft.boardConfig.heightPegs,
        preprocess: draft.preprocessSettings,
        paletteMode: draft.paletteMode,
        colorCount: draft.colorCount,
        collectionBeads,
        useAllCollectionColors,
        ditherMode: draft.ditherMode,
        samplingMode: draft.samplingMode,
        colorSwaps: draft.colorSwaps ?? [],
      });
      dispatch({ type: 'draft/update', patch: { gridData: result.gridData } });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(debounceRef.current);
    // Re-run whenever anything the algorithm depends on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    imgEl,
    draft?.cropRect,
    draft?.boardConfig.widthPegs,
    draft?.boardConfig.heightPegs,
    draft?.preprocessSettings,
    draft?.paletteMode,
    draft?.colorCount,
    draft?.useAllCollectionColors,
    draft?.ditherMode,
    draft?.samplingMode,
    draft?.collectionId,
    draft?.colorSwaps,
    state.collections,
  ]);

  return imgEl;
}
