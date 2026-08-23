import type { GridData } from './grid';

export function paintCell(grid: GridData, row: number, col: number, beadId: string): GridData {
  if (row < 0 || row >= grid.length || col < 0 || col >= (grid[0]?.length ?? 0)) return grid;
  return grid.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? beadId : c)) : r));
}

export function clearCell(grid: GridData, row: number, col: number): GridData {
  if (row < 0 || row >= grid.length || col < 0 || col >= (grid[0]?.length ?? 0)) return grid;
  return grid.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? null : c)) : r));
}

/** Replaces every occurrence of `fromId` with `toId` across the whole grid. */
export function swapColor(grid: GridData, fromId: string, toId: string): GridData {
  return grid.map((row) => row.map((c) => (c === fromId ? toId : c)));
}

/** Rotates the grid 90 degrees clockwise. Dimensions swap for non-square boards. */
export function rotate90(grid: GridData): GridData {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const out: GridData = Array.from({ length: cols }, () => new Array(rows).fill(null));
  for (let newRow = 0; newRow < cols; newRow++) {
    for (let newCol = 0; newCol < rows; newCol++) {
      out[newRow][newCol] = grid[rows - 1 - newCol][newRow];
    }
  }
  return out;
}

/** Mirrors the grid left-right. */
export function flipHorizontal(grid: GridData): GridData {
  return grid.map((row) => [...row].reverse());
}
