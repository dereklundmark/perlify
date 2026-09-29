import { describe, expect, it } from 'vitest';
import { colorFamily, groupByColorFamily } from './colorFamily';
import { CATALOG } from './catalog';

const familyOf = (name: string) => colorFamily(CATALOG.find((b) => b.name === name)!.hex);

describe('colorFamily', () => {
  it('buckets catalog colors the way a person would name them', () => {
    expect(familyOf('Black')).toBe('neutrals');
    expect(familyOf('Grey')).toBe('neutrals');
    expect(familyOf('White')).toBe('neutrals');
    expect(familyOf('Red')).toBe('reds');
    expect(familyOf('Cherry Red')).toBe('reds');
    expect(familyOf('Orange')).toBe('oranges');
    expect(familyOf('Brown')).toBe('browns');
    expect(familyOf('Tan')).toBe('browns');
    expect(familyOf('Cheddar')).toBe('yellows');
    expect(familyOf('Green')).toBe('greens');
    expect(familyOf('Olive')).toBe('greens');
    expect(familyOf('Turquoise')).toBe('teals');
    expect(familyOf('Cobalt')).toBe('blues');
    expect(familyOf('Navy')).toBe('blues');
    expect(familyOf('Purple')).toBe('purples');
    expect(familyOf('Pink')).toBe('pinks');
    expect(familyOf('Magenta')).toBe('pinks');
  });
});

describe('groupByColorFamily', () => {
  it('drops empty families and sorts lightest first', () => {
    const groups = groupByColorFamily([
      { hex: '#22356e' }, // dark blue
      { hex: '#bfe0ea' }, // pale blue
      { hex: '#16161a' }, // black
    ]);
    expect(groups.map((g) => g.family)).toEqual(['blues', 'neutrals']);
    expect(groups[0].items.map((i) => i.hex)).toEqual(['#bfe0ea', '#22356e']);
  });
});
