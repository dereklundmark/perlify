import { describe, expect, it } from 'vitest';
import { embedPhotoGrid, flipPadding, photoArea, resizeSide, rotatePadding } from './boardPadding';
import { flipHorizontal, rotate90 } from './gridTransform';
import type { GridData } from './grid';

const g: GridData = [
  ['a', 'b'],
  ['c', 'd'],
];

describe('resizeSide', () => {
  it('adds empty rows/columns on the chosen side, keeping every existing cell', () => {
    expect(resizeSide(g, 'top', 1)).toEqual([[null, null], ['a', 'b'], ['c', 'd']]);
    expect(resizeSide(g, 'bottom', 1)).toEqual([['a', 'b'], ['c', 'd'], [null, null]]);
    expect(resizeSide(g, 'left', 2)).toEqual([[null, null, 'a', 'b'], [null, null, 'c', 'd']]);
    expect(resizeSide(g, 'right', 1)).toEqual([['a', 'b', null], ['c', 'd', null]]);
  });

  it('removes rows/columns from that side, never the last one', () => {
    expect(resizeSide(resizeSide(g, 'top', 2), 'top', -2)).toEqual(g);
    expect(resizeSide(g, 'right', -1)).toEqual([['a'], ['c']]);
    expect(resizeSide(g, 'top', -5)).toEqual([['c', 'd']]);
  });
});

describe('photoArea', () => {
  const board = { beadType: 'mini' as const, widthPegs: 10, heightPegs: 12, boardsWide: 1, boardsHigh: 1 };

  it('is the whole board with no padding', () => {
    expect(photoArea({ boardConfig: board })).toMatchObject({ width: 10, height: 12 });
  });

  it('is what is left inside the padding', () => {
    expect(photoArea({ boardConfig: board, boardPadding: { top: 2, right: 1, bottom: 0, left: 3 } })).toMatchObject({
      width: 6,
      height: 10,
    });
  });

  it('ignores padding that would leave no photo on that axis', () => {
    const r = photoArea({ boardConfig: board, boardPadding: { top: 6, right: 0, bottom: 6, left: 1 } });
    expect(r).toMatchObject({ width: 9, height: 12, padding: { top: 0, bottom: 0, left: 1 } });
  });
});

describe('embedPhotoGrid', () => {
  it('drops the photo into the padded board and keeps painted padding cells', () => {
    const previous: GridData = [
      ['x', null, null],
      ['old', 'old', null],
      ['old', 'old', null],
    ];
    const photo: GridData = [
      ['a', 'b'],
      ['c', 'd'],
    ];
    expect(embedPhotoGrid(photo, { top: 1, right: 1, bottom: 0, left: 0 }, previous)).toEqual([
      ['x', null, null],
      ['a', 'b', null],
      ['c', 'd', null],
    ]);
  });

  it('leaves padding empty when the previous board was a different size', () => {
    expect(embedPhotoGrid([['a']], { top: 1, right: 0, bottom: 0, left: 0 }, [['z']])).toEqual([[null], ['a']]);
  });
});

describe('padding follows rotate/flip', () => {
  it('rotatePadding matches rotate90', () => {
    const padded = resizeSide(resizeSide(g, 'top', 1), 'left', 2); // 3 rows x 4 cols
    const rotated = rotate90(padded);
    const p = rotatePadding({ top: 1, right: 0, bottom: 0, left: 2 });
    // After rotating, the padded rows/cols must still be all-empty on the reported sides.
    expect(rotated.slice(0, p.top).flat().every((c) => c === null)).toBe(true);
    expect(rotated.map((row) => row.slice(row.length - p.right)).flat().every((c) => c === null)).toBe(true);
    expect(p).toEqual({ top: 2, right: 1, bottom: 0, left: 0 });
  });

  it('flipPadding matches flipHorizontal', () => {
    const flipped = flipHorizontal(resizeSide(g, 'left', 1));
    expect(flipped.map((row) => row[row.length - 1])).toEqual([null, null]);
    expect(flipPadding({ top: 0, right: 0, bottom: 0, left: 1 })).toEqual({ top: 0, right: 1, bottom: 0, left: 0 });
  });
});
