import { describe, expect, it } from 'vitest';
import { abstractGrid, denoiseGrid, sharpenGrid } from './imageProcess';
import type { RGB } from './color';

function solid(color: RGB, rows: number, cols: number): RGB[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ...color })));
}

describe('denoiseGrid', () => {
  it('flattens a single outlier cell toward its neighbors', () => {
    const grid = solid({ r: 20, g: 20, b: 20 }, 5, 5);
    grid[2][2] = { r: 250, g: 250, b: 250 }; // one bright speck in a dark field
    const before = grid[2][2].r;
    const out = denoiseGrid(grid, 10);
    expect(out[2][2].r).toBeLessThan(before);
    expect(out[2][2].r).toBeLessThan(before / 2); // pulled substantially toward its neighbors
  });

  it('is a no-op at strength 0', () => {
    const grid = solid({ r: 100, g: 50, b: 25 }, 3, 3);
    grid[1][1] = { r: 200, g: 10, b: 10 };
    const out = denoiseGrid(grid, 0);
    expect(out).toEqual(grid);
  });
});

describe('abstractGrid', () => {
  it('smooths a gentle gradient but leaves a hard edge intact', () => {
    // Asymmetric steps (100, 103, 108) so averaging with neighbors can't
    // coincidentally land back on the original value.
    const grid: RGB[][] = [
      [
        { r: 100, g: 100, b: 100 },
        { r: 103, g: 100, b: 100 }, // gentle step — should blend with neighbors
        { r: 108, g: 100, b: 100 },
        { r: 240, g: 10, b: 10 }, // a real edge — very different color
      ],
    ];
    const out = abstractGrid(grid, 10);
    // the gentle-gradient cell moved toward its close neighbors
    expect(out[0][1].r).not.toBe(grid[0][1].r);
    // the hard edge cell barely moved — its only neighbor is too different to merge
    expect(out[0][3].r).toBeCloseTo(grid[0][3].r, 0);
  });

  it('is a no-op at strength 0', () => {
    const grid = solid({ r: 10, g: 20, b: 30 }, 3, 3);
    expect(abstractGrid(grid, 0)).toEqual(grid);
  });
});

describe('sharpenGrid', () => {
  it('increases contrast across an existing edge', () => {
    // Kept away from 0/255 so clamping can't mask the effect.
    const grid: RGB[][] = [
      [
        { r: 80, g: 80, b: 80 },
        { r: 80, g: 80, b: 80 },
        { r: 180, g: 180, b: 180 },
        { r: 180, g: 180, b: 180 },
      ],
    ];
    const out = sharpenGrid(grid, 10);
    const beforeDelta = Math.abs(grid[0][1].r - grid[0][2].r);
    const afterDelta = Math.abs(out[0][1].r - out[0][2].r);
    expect(afterDelta).toBeGreaterThan(beforeDelta);
  });

  it('leaves a uniform region unchanged', () => {
    const grid = solid({ r: 128, g: 64, b: 32 }, 4, 4);
    const out = sharpenGrid(grid, 10);
    expect(out[1][1]).toEqual(grid[1][1]);
  });

  it('is a no-op at strength 0', () => {
    const grid = solid({ r: 10, g: 20, b: 30 }, 3, 3);
    expect(sharpenGrid(grid, 0)).toEqual(grid);
  });
});
