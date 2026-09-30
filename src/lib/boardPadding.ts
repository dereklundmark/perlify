// Extra board space around the photo. The user can extend the board in the
// editor (e.g. "two more rows on top, to paint a hat") without re-matching:
// the photo keeps its exact cells, and a later re-match only redraws the
// inner photo area — the padding is theirs to paint and is never overwritten.

import type { BoardPadding, Pattern } from '../db/schema';
import type { GridData } from './grid';

export type Side = keyof BoardPadding;

export const NO_PADDING: BoardPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/** The photo-matched area inside the padding. Padding that would leave no photo is ignored. */
export function photoArea(pattern: Pick<Pattern, 'boardConfig' | 'boardPadding'>): {
  width: number;
  height: number;
  padding: BoardPadding;
} {
  const { widthPegs, heightPegs } = pattern.boardConfig;
  const p = pattern.boardPadding ?? NO_PADDING;
  const horizontalFits = widthPegs - p.left - p.right >= 1;
  const verticalFits = heightPegs - p.top - p.bottom >= 1;
  const padding = {
    top: verticalFits ? p.top : 0,
    bottom: verticalFits ? p.bottom : 0,
    left: horizontalFits ? p.left : 0,
    right: horizontalFits ? p.right : 0,
  };
  return {
    width: widthPegs - padding.left - padding.right,
    height: heightPegs - padding.top - padding.bottom,
    padding,
  };
}

/**
 * Adds (positive) or removes (negative) whole rows/columns on one side of a
 * grid. Added cells are empty pegs. Every layer and the base grid get the
 * same treatment so they stay aligned.
 */
export function resizeSide(grid: GridData, side: Side, delta: number): GridData {
  if (delta === 0) return grid;
  const cols = grid[0]?.length ?? 0;
  if (side === 'top' || side === 'bottom') {
    if (delta > 0) {
      const added = Array.from({ length: delta }, () => new Array<string | null>(cols).fill(null));
      return side === 'top' ? [...added, ...grid] : [...grid, ...added];
    }
    const n = Math.min(-delta, grid.length - 1);
    return side === 'top' ? grid.slice(n) : grid.slice(0, grid.length - n);
  }
  if (delta > 0) {
    const empty = new Array<string | null>(delta).fill(null);
    return grid.map((row) => (side === 'left' ? [...empty, ...row] : [...row, ...empty]));
  }
  const n = Math.min(-delta, cols - 1);
  return grid.map((row) => (side === 'left' ? row.slice(n) : row.slice(0, row.length - n)));
}

/**
 * Places a freshly matched photo-area grid into the full board: padding
 * cells are carried over from `previous` (the board as it was) when it has
 * the same full size, and are empty otherwise.
 */
export function embedPhotoGrid(photo: GridData, padding: BoardPadding, previous: GridData): GridData {
  const width = (photo[0]?.length ?? 0) + padding.left + padding.right;
  const height = photo.length + padding.top + padding.bottom;
  const keepPrevious = previous.length === height && (previous[0]?.length ?? 0) === width;
  const out: GridData = [];
  for (let r = 0; r < height; r++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < width; c++) {
      const pr = r - padding.top;
      const pc = c - padding.left;
      const inPhoto = pr >= 0 && pr < photo.length && pc >= 0 && pc < (photo[0]?.length ?? 0);
      row.push(inPhoto ? photo[pr][pc] : keepPrevious ? previous[r][c] : null);
    }
    out.push(row);
  }
  return out;
}

/** Padding after the grid is rotated 90° clockwise (see rotate90). */
export function rotatePadding(p: BoardPadding): BoardPadding {
  return { top: p.left, right: p.top, bottom: p.right, left: p.bottom };
}

/** Padding after the grid is mirrored left-right (see flipHorizontal). */
export function flipPadding(p: BoardPadding): BoardPadding {
  return { ...p, left: p.right, right: p.left };
}
