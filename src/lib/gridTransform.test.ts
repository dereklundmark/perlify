import { describe, expect, it } from 'vitest';
import { clearCell, flipHorizontal, paintCell, rotate90, swapColor } from './gridTransform';
import type { GridData } from './grid';

const NON_SQUARE: GridData = [
  ['a', 'b', 'c'],
  ['d', 'e', 'f'],
];

describe('rotate90', () => {
  it('rotates a non-square grid 90deg clockwise, swapping dimensions', () => {
    const rotated = rotate90(NON_SQUARE);
    expect(rotated).toEqual([
      ['d', 'a'],
      ['e', 'b'],
      ['f', 'c'],
    ]);
  });

  it('four rotations return to the original grid', () => {
    let g = NON_SQUARE;
    for (let i = 0; i < 4; i++) g = rotate90(g);
    expect(g).toEqual(NON_SQUARE);
  });
});

describe('flipHorizontal', () => {
  it('mirrors each row left-right without touching row order', () => {
    expect(flipHorizontal(NON_SQUARE)).toEqual([
      ['c', 'b', 'a'],
      ['f', 'e', 'd'],
    ]);
  });

  it('is its own inverse', () => {
    expect(flipHorizontal(flipHorizontal(NON_SQUARE))).toEqual(NON_SQUARE);
  });
});

describe('swapColor', () => {
  it('replaces every occurrence of one bead id with another', () => {
    const grid: GridData = [
      ['red', 'blue', 'red'],
      [null, 'red', 'blue'],
    ];
    expect(swapColor(grid, 'red', 'green')).toEqual([
      ['green', 'blue', 'green'],
      [null, 'green', 'blue'],
    ]);
  });

  it('leaves null cells untouched', () => {
    const grid: GridData = [[null, 'red']];
    expect(swapColor(grid, 'red', 'blue')).toEqual([[null, 'blue']]);
  });
});

describe('paintCell / clearCell', () => {
  it('paints exactly one cell, leaving the rest untouched', () => {
    const painted = paintCell(NON_SQUARE, 0, 1, 'x');
    expect(painted).toEqual([
      ['a', 'x', 'c'],
      ['d', 'e', 'f'],
    ]);
    expect(painted).not.toBe(NON_SQUARE);
  });

  it('clears exactly one cell to null', () => {
    expect(clearCell(NON_SQUARE, 1, 2)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', null],
    ]);
  });

  it('is a no-op out of bounds', () => {
    expect(paintCell(NON_SQUARE, 5, 5, 'x')).toEqual(NON_SQUARE);
    expect(clearCell(NON_SQUARE, -1, 0)).toEqual(NON_SQUARE);
  });
});
