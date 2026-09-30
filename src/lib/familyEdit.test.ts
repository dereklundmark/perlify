import { describe, expect, it } from 'vitest';
import { adjustHex, contrastHexes, familiesInUsage, nearestBead, pickAddition, pickMerge, remapGrid } from './familyEdit';
import { hexToRgb } from './color';
import { rgbToHsl } from './hsl';

const lightness = (hex: string) => rgbToHsl(hexToRgb(hex)).l;

const beads = {
  navy: { id: 'navy', name: 'Navy', hex: '#172445' },
  cobalt: { id: 'cobalt', name: 'Cobalt', hex: '#2b6cc4' },
  sky: { id: 'sky', name: 'Sky', hex: '#58a8de' },
  pale: { id: 'pale-blue', name: 'Pale Blue', hex: '#bfe0ea' },
  red: { id: 'red', name: 'Red', hex: '#b71f24' },
};
const getBead = (id: string) => Object.values(beads).find((b) => b.id === id);

describe('familiesInUsage', () => {
  it('groups by family, lightest first, keeping counts', () => {
    const groups = familiesInUsage(
      [
        { beadId: 'navy', count: 5 },
        { beadId: 'red', count: 3 },
        { beadId: 'sky', count: 9 },
      ],
      getBead,
    );
    expect(groups.map((g) => g.family)).toEqual(['reds', 'blues']);
    expect(groups[1].colors.map((c) => [c.id, c.count])).toEqual([
      ['sky', 9],
      ['navy', 5],
    ]);
  });
});

describe('adjustHex', () => {
  it('is a no-op at 0/0', () => {
    expect(adjustHex('#2b6cc4', { brightness: 0, saturation: 0 })).toBe('#2b6cc4');
  });
  it('brightness moves lighter or darker, reaching white/black at ±100', () => {
    expect(lightness(adjustHex('#2b6cc4', { brightness: 40, saturation: 0 }))).toBeGreaterThan(lightness('#2b6cc4'));
    expect(lightness(adjustHex('#2b6cc4', { brightness: -40, saturation: 0 }))).toBeLessThan(lightness('#2b6cc4'));
    expect(adjustHex('#2b6cc4', { brightness: 100, saturation: 0 })).toBe('#ffffff');
    expect(adjustHex('#2b6cc4', { brightness: -100, saturation: 0 })).toBe('#000000');
  });
  it('saturation -100 gives a grey', () => {
    const { r, g, b } = hexToRgb(adjustHex('#2b6cc4', { brightness: 0, saturation: -100 }));
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe('contrastHexes', () => {
  it('spreads lights and darks apart (positive) or together (negative)', () => {
    const hexes = [beads.pale.hex, beads.navy.hex];
    const spread = (hs: string[]) => lightness(hs[0]) - lightness(hs[1]);
    expect(spread(contrastHexes(hexes, 50))).toBeGreaterThan(spread(hexes));
    expect(spread(contrastHexes(hexes, -50))).toBeLessThan(spread(hexes));
    expect(contrastHexes(hexes, 0)).toEqual(hexes);
  });
});

describe('nearestBead / remapGrid', () => {
  it('snaps a lightened cobalt to the nearest real bead', () => {
    const lighter = adjustHex(beads.cobalt.hex, { brightness: 35, saturation: 0 });
    expect(nearestBead(lighter, Object.values(beads))?.id).toBe('sky');
  });
  it('remaps all at once, never chaining', () => {
    const map = new Map([
      ['a', 'b'],
      ['b', 'c'],
    ]);
    expect(remapGrid([['a', 'b', null, 'x']], map)).toEqual([['b', 'c', null, 'x']]);
  });
});

describe('pickMerge', () => {
  it('merges the least-used color into its closest family neighbour', () => {
    const colors = [
      { ...beads.pale, count: 20 },
      { ...beads.sky, count: 2 },
      { ...beads.navy, count: 30 },
    ];
    const m = pickMerge(colors)!;
    expect(m.from.id).toBe('sky');
    expect(m.to.id).toBe('pale-blue');
    expect(pickMerge([{ ...beads.sky, count: 1 }])).toBeNull();
  });
});

describe('pickAddition', () => {
  it('adds the candidate that fits the photo best and re-splits the cells', () => {
    // Photo cells: half deep navy, half sky-ish. Family currently only has Cobalt.
    const cells = [
      { row: 0, col: 0, rgb: hexToRgb('#1a2848') },
      { row: 0, col: 1, rgb: hexToRgb('#5aa6dc') },
    ];
    const result = pickAddition(cells, [beads.cobalt], [beads.navy, beads.pale])!;
    expect(result.added.id).toBe('navy');
    expect(result.assignment.get('0,0')).toBe('navy');
    expect(result.assignment.get('0,1')).toBe('cobalt');
  });
  it('returns null when no cell would use any candidate', () => {
    const cells = [{ row: 0, col: 0, rgb: hexToRgb('#2b6cc4') }];
    expect(pickAddition(cells, [beads.cobalt], [beads.pale])).toBeNull();
    expect(pickAddition(cells, [beads.cobalt], [])).toBeNull();
  });
});
