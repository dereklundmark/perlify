// Grid data helpers. `null` is a first-class cell value (an intentionally
// empty peg) — see README "Interactions & Behavior". Matching in M1 never
// produces nulls itself (that only happens via the Clear tool in the manual
// editor, deferred to a later round), but stats must handle it correctly
// from day one since it's part of the persisted data model.

export type GridData = (string | null)[][];

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
