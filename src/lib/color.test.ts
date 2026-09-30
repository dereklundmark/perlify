import { describe, expect, it } from 'vitest';
import {
  applyPreprocess,
  deltaE2000,
  deltaE76Sq,
  floydSteinbergMatch,
  hexToRgb,
  nearestIndex,
  pickAutoPaletteIndices,
  pickClosestPaletteIndices,
  relativeLuminance,
  rgbToLab,
  type PaletteEntry,
  type RGB,
} from './color';
import { rgbToHsb } from './hsb';
import { CATALOG } from './catalog';

describe('rgbToLab', () => {
  it('maps white to L=100, a=0, b=0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it('maps black to L=0, a=0, b=0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it('keeps neutral grays chromatically neutral (a=0, b=0)', () => {
    for (const v of [32, 64, 128, 192, 224]) {
      const lab = rgbToLab({ r: v, g: v, b: v });
      expect(lab.a).toBeCloseTo(0, 1);
      expect(lab.b).toBeCloseTo(0, 1);
    }
  });
});

describe('nearestIndex keeps blues blue — the blue→purple drift regression guard', () => {
  // A pure dark blue. CIE76 (the earlier metric) ranked Purple closer than
  // Navy — its known blue-region hue error, and the reason users saw blues
  // "turn purple". CIEDE2000 corrects it.
  const source: RGB = { r: 0, g: 0, b: 110 };
  const navy = CATALOG.find((c) => c.name === 'Navy')!;
  const purple = CATALOG.find((c) => c.name === 'Purple')!;
  const palette: PaletteEntry[] = [navy, purple].map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));

  it('CIE76 would have picked Purple for this source', () => {
    const lab = rgbToLab(source);
    expect(deltaE76Sq(lab, palette[1].lab)).toBeLessThan(deltaE76Sq(lab, palette[0].lab));
  });

  it('nearestIndex (CIEDE2000) picks Navy', () => {
    expect(palette[nearestIndex(rgbToLab(source), palette)].id).toBe(navy.id);
  });
});

const NEUTRAL = {
  contrast: 0,
  saturation: 0,
  brightness: 0,
  duotone: false,
  duotoneHue: 0,
  denoise: 0,
  abstraction: 0,
  sharpen: 0,
};

describe('applyPreprocess', () => {
  it('is a no-op at neutral settings', () => {
    const rgb: RGB = { r: 120, g: 80, b: 200 };
    const out = applyPreprocess(rgb, NEUTRAL);
    expect(out.r).toBeCloseTo(rgb.r, 5);
    expect(out.g).toBeCloseTo(rgb.g, 5);
    expect(out.b).toBeCloseTo(rgb.b, 5);
  });

  it('brightness shifts channels up and clamps at 255', () => {
    const out = applyPreprocess({ r: 250, g: 10, b: 10 }, { ...NEUTRAL, brightness: 100 });
    expect(out.r).toBe(255);
    expect(out.g).toBeGreaterThan(10);
  });

  it('saturation -100 desaturates to a gray (a == b == r channel-wise)', () => {
    const out = applyPreprocess({ r: 200, g: 50, b: 50 }, { ...NEUTRAL, saturation: -100 });
    expect(out.r).toBeCloseTo(out.g, 0);
    expect(out.g).toBeCloseTo(out.b, 0);
  });

  it('duotone replaces the color with a shade of the chosen hue', () => {
    const out = applyPreprocess({ r: 200, g: 50, b: 50 }, { ...NEUTRAL, duotone: true, duotoneHue: 200 });
    const { h } = rgbToHsb(out);
    expect(h).toBeCloseTo(200, 0);
  });

  it('a bright and a dark pixel map to different points on the same duotone gradient', () => {
    const settings = { ...NEUTRAL, duotone: true, duotoneHue: 120 };
    const dark = applyPreprocess({ r: 10, g: 10, b: 10 }, settings);
    const bright = applyPreprocess({ r: 240, g: 240, b: 240 }, settings);
    expect(relativeLuminance(bright)).toBeGreaterThan(relativeLuminance(dark));
  });
});

describe('pickAutoPaletteIndices', () => {
  it('quantizing to N=1 returns the single most-used catalog color', () => {
    const targetIdx = 12; // 'Orange'
    const labs = new Array(20).fill(rgbToLab(hexToRgb(CATALOG[targetIdx].hex)));
    const catalogEntries: PaletteEntry[] = CATALOG.map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
    const indices = pickAutoPaletteIndices(labs, catalogEntries, 1);
    expect(indices).toEqual([targetIdx]);
  });

  it('never returns more entries than requested or than the catalog has', () => {
    const catalogEntries: PaletteEntry[] = CATALOG.map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
    const labs = catalogEntries.map((e) => e.lab);
    expect(pickAutoPaletteIndices(labs, catalogEntries, 12)).toHaveLength(12);
    expect(pickAutoPaletteIndices(labs, catalogEntries, 999)).toHaveLength(catalogEntries.length);
  });
});

describe('floydSteinbergMatch', () => {
  it('produces an index grid matching the input shape, all within palette bounds', () => {
    const palette: PaletteEntry[] = CATALOG.slice(0, 4).map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
    const paletteRgb = CATALOG.slice(0, 4).map((b) => hexToRgb(b.hex));
    const cells: RGB[][] = Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) => ({ r: (row * 40) % 255, g: (col * 40) % 255, b: 100 })),
    );
    const result = floydSteinbergMatch(cells, palette, paletteRgb);
    expect(result).toHaveLength(5);
    expect(result[0]).toHaveLength(5);
    for (const row of result) {
      for (const idx of row) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(4);
      }
    }
  });
});

describe('deltaE76Sq', () => {
  it('is zero for identical colors and positive for distinct ones', () => {
    const a = rgbToLab({ r: 100, g: 150, b: 200 });
    const b = rgbToLab({ r: 100, g: 150, b: 200 });
    const c = rgbToLab({ r: 10, g: 20, b: 30 });
    expect(deltaE76Sq(a, b)).toBe(0);
    expect(deltaE76Sq(a, c)).toBeGreaterThan(0);
  });
});

describe('deltaE2000', () => {
  // Reference pairs from Sharma, Wu & Dalal (2005), the standard CIEDE2000 test data.
  it.each([
    [{ l: 50, a: 2.6772, b: -79.7751 }, { l: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ l: 50, a: 2.8361, b: -74.02 }, { l: 50, a: 0, b: -82.7485 }, 3.4412],
    [{ l: 50, a: 2.5, b: 0 }, { l: 73, a: 25, b: -18 }, 27.1492],
    [{ l: 60.2574, a: -34.0099, b: 36.2677 }, { l: 60.4626, a: -34.1751, b: 39.4387 }, 1.2644],
  ])('matches published value %#', (x, y, expected) => {
    expect(deltaE2000(x, y)).toBeCloseTo(expected, 3);
    expect(deltaE2000(y, x)).toBeCloseTo(expected, 3);
  });

  it('keeps muted photo blues in the blue family (CIE76 sent them to Periwinkle / Grey)', () => {
    const palette: PaletteEntry[] = ['Periwinkle', 'Grey', 'Cobalt', 'Sky'].map((name) => {
      const bead = CATALOG.find((b) => b.name === name)!;
      return { id: bead.id, lab: rgbToLab(hexToRgb(bead.hex)) };
    });
    const denim = rgbToLab(hexToRgb('#4a6fa5'));
    expect(palette[nearestIndex(denim, palette)].id).toBe('cobalt');
  });
});

describe('pickClosestPaletteIndices', () => {
  const lab = (hex: string) => rgbToLab(hexToRgb(hex));
  // Two near-identical blues plus a pink. The image is 80% blues (spread
  // evenly between the two) and 20% pink.
  const palette: PaletteEntry[] = [
    { id: 'blue-a', lab: lab('#2b6cc4') },
    { id: 'blue-b', lab: lab('#2f70c8') },
    { id: 'pink', lab: lab('#ef86b7') },
  ];
  const cells = [
    ...new Array(40).fill(lab('#2a6bc3')),
    ...new Array(40).fill(lab('#3071c9')),
    ...new Array(20).fill(lab('#ef86b7')),
  ];

  it('reproduces the bug it replaces: most-voted keeps both twin blues and drops the pink', () => {
    expect(pickAutoPaletteIndices(cells, palette, 2)).toEqual([0, 1]);
  });

  it('keeps one blue and the pink instead', () => {
    const picked = pickClosestPaletteIndices(cells, palette, 2);
    expect(picked).toHaveLength(2);
    expect(picked).toContain(2);
  });

  it('returns everything when N covers the palette, nothing for N=0', () => {
    expect(pickClosestPaletteIndices(cells, palette, 5)).toEqual([0, 1, 2]);
    expect(pickClosestPaletteIndices(cells, palette, 0)).toEqual([]);
  });
});
