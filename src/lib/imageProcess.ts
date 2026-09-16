// Grid-level smoothing/sharpening passes — unlike applyPreprocess's
// per-pixel contrast/saturation/brightness/duotone (color.ts), these need
// neighbor access, so they operate on the whole RGB[][] grid at once.
// Inserted into matchImageToGrid's pipeline (see match.ts) between
// sampling and the per-pixel tonal adjustments.

import { rgbToLab, type RGB } from './color';

function clampChannel(v: number): number {
  return Math.min(255, Math.max(0, v));
}

function boxBlur(grid: RGB[][], radius: number): RGB[][] {
  if (radius <= 0) return grid;
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out: RGB[][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: RGB[] = [];
    for (let col = 0; col < w; col++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const y = row + dy;
        if (y < 0 || y >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const x = col + dx;
          if (x < 0 || x >= w) continue;
          const c = grid[y][x];
          r += c.r;
          g += c.g;
          b += c.b;
          count++;
        }
      }
      rowArr.push({ r: r / count, g: g / count, b: b / count });
    }
    out.push(rowArr);
  }
  return out;
}

/**
 * Box blur before matching — flattens the per-cell color noise a photo's
 * sensor/JPEG artifacts introduce, which otherwise gets amplified into
 * visibly speckled, inconsistent bead choices once matched to a small
 * palette. `strength` 0-10 maps to a 0-3 cell blur radius.
 */
export function denoiseGrid(grid: RGB[][], strength: number): RGB[][] {
  const radius = Math.min(3, Math.round((strength / 10) * 3));
  return boxBlur(grid, radius);
}

const ABSTRACT_MAX_DISTANCE_SQ = 900; // ~deltaE 30 at strength 10

/**
 * Edge-aware smoothing (a cheap bilateral filter): each cell only averages
 * with immediate neighbors whose Lab color is close enough — flat regions
 * and gentle gradients smooth out, while a real edge (a big color jump)
 * stays sharp because its neighbors fall outside the threshold.
 */
export function abstractGrid(grid: RGB[][], strength: number): RGB[][] {
  if (strength <= 0) return grid;
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const threshold = (strength / 10) * ABSTRACT_MAX_DISTANCE_SQ;
  const out: RGB[][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: RGB[] = [];
    for (let col = 0; col < w; col++) {
      const center = grid[row][col];
      const centerLab = rgbToLab(center);
      let r = center.r;
      let g = center.g;
      let b = center.b;
      let count = 1;
      for (let dy = -1; dy <= 1; dy++) {
        const y = row + dy;
        if (y < 0 || y >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const x = col + dx;
          if (x < 0 || x >= w) continue;
          const neighbor = grid[y][x];
          const nLab = rgbToLab(neighbor);
          const dl = centerLab.l - nLab.l;
          const da = centerLab.a - nLab.a;
          const db = centerLab.b - nLab.b;
          if (dl * dl + da * da + db * db <= threshold) {
            r += neighbor.r;
            g += neighbor.g;
            b += neighbor.b;
            count++;
          }
        }
      }
      rowArr.push({ r: r / count, g: g / count, b: b / count });
    }
    out.push(rowArr);
  }
  return out;
}

/**
 * Unsharp mask: push each cell away from a blurred version of itself,
 * boosting local contrast at edges. Small boards lose detail fastest —
 * a touch of this keeps a design legible at low peg counts.
 */
export function sharpenGrid(grid: RGB[][], strength: number): RGB[][] {
  if (strength <= 0) return grid;
  const blurred = boxBlur(grid, 1);
  const amount = strength / 10;
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out: RGB[][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: RGB[] = [];
    for (let col = 0; col < w; col++) {
      const c = grid[row][col];
      const bl = blurred[row][col];
      rowArr.push({
        r: clampChannel(c.r + amount * (c.r - bl.r)),
        g: clampChannel(c.g + amount * (c.g - bl.g)),
        b: clampChannel(c.b + amount * (c.b - bl.b)),
      });
    }
    out.push(rowArr);
  }
  return out;
}
