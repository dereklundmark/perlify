// Grid data helpers. `null` is a first-class cell value (an intentionally
// empty peg) — see README "Interactions & Behavior". Matching in M1 never
// produces nulls itself (that only happens via the Clear tool in the manual
// editor, deferred to a later round), but stats must handle it correctly
// from day one since it's part of the persisted data model.

import type { PatternLayer } from '../db/schema';

export type GridData = (string | null)[][];

export interface LayeredGrids {
  base: GridData;
  layers?: PatternLayer[];
  baseVisible?: boolean;
}

/**
 * Flattens the base grid and every visible layer into the single grid that
 * gets displayed, counted and exported. A layer's `null` cells are
 * transparent, and the result always has the base grid's dimensions — a
 * layer that no longer matches (the board was resized after it was painted)
 * is cropped or left transparent past its edge rather than breaking anything.
 */
export function compositeGrid({ base, layers, baseVisible = true }: LayeredGrids): GridData {
  const visibleLayers = (layers ?? []).filter((l) => l.visible);
  if (baseVisible && visibleLayers.length === 0) return base;
  const out: GridData = base.map((row) => (baseVisible ? row.slice() : row.map(() => null)));
  for (const layer of visibleLayers) {
    for (let r = 0; r < out.length; r++) {
      const layerRow = layer.grid[r];
      if (!layerRow) continue;
      for (let c = 0; c < out[r].length; c++) {
        const cell = layerRow[c];
        if (cell != null) out[r][c] = cell;
      }
    }
  }
  return out;
}

/** compositeGrid for a saved pattern (or draft). */
export function patternGrid(p: { gridData: GridData; layers?: PatternLayer[]; baseVisible?: boolean }): GridData {
  return compositeGrid({ base: p.gridData, layers: p.layers, baseVisible: p.baseVisible });
}

export interface GridStats {
  beadCount: number;
  colorCount: number;
  emptyCount: number;
}

export function gridStats(grid: GridData): GridStats {
  let beadCount = 0;
  let emptyCount = 0;
  const colors = new Set<string>();

  for (const row of grid) {
    for (const cell of row) {
      if (cell === null) {
        emptyCount++;
      } else {
        beadCount++;
        colors.add(cell);
      }
    }
  }

  return { beadCount, colorCount: colors.size, emptyCount };
}

/** Counts of each bead id present in the grid, most-used first. */
export function beadUsage(grid: GridData): Array<{ beadId: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([beadId, count]) => ({ beadId, count }))
    .sort((a, b) => b.count - a.count);
}
