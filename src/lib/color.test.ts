import { describe, expect, it } from 'vitest';
import {
  applyPreprocess,
  deltaE76Sq,
  floydSteinbergMatch,
  hexToRgb,
  nearestIndex,
  pickAutoPaletteIndices,
  rgbToLab,
  type PaletteEntry,
  type RGB,
} from './color';
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

describe('nearestIndex vs naive RGB distance — the "not RGB distance" regression guard', () => {
  // sRGB gamma-encoding compresses dark tones, so a blue-only color that
  // reads as numerically "close to black/navy" in raw RGB is, perceptually
  // (and in Lab), much closer to a lighter, more saturated purple. This is
  // a real, verifiable case where naive RGB distance and Lab distance rank
  // the same two palette candidates in opposite order — exactly the class
  // of mismatch the handoff's README warns CIE76/Lab matching is meant to
  // avoid ("do not use RGB distance").
  const source: RGB = { r: 0, g: 0, b: 110 };
  const navy = CATALOG.find((c) => c.name === 'Navy')!;
  const purple = CATALOG.find((c) => c.name === 'Purple')!;

  function rgbDistSq(a: RGB, b: RGB): number {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return dr * dr + dg * dg + db * db;
  }

  it('naive RGB distance would pick Navy over Purple for this source', () => {
    expect(rgbDistSq(source, hexToRgb(navy.hex))).toBeLessThan(rgbDistSq(source, hexToRgb(purple.hex)));
  });

  it('Lab-based nearestIndex picks Purple over Navy for the same source', () => {
    const palette: PaletteEntry[] = [navy, purple].map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
    const idx = nearestIndex(rgbToLab(source), palette);
    expect(palette[idx].id).toBe(purple.id);
  });
});

const NEUTRAL = { contrast: 0, saturation: 0, brightness: 0, duotone: false, duotoneHue: 0 };

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
