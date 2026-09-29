import { describe, expect, it } from 'vitest';
import { hslToRgb, rgbToHsl } from './hsl';

describe('hslToRgb', () => {
  it('matches known colors', () => {
    expect(hslToRgb({ h: 0, s: 1, l: 0.5 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb({ h: 120, s: 1, l: 0.5 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hslToRgb({ h: 240, s: 1, l: 0.5 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('runs black → white along lightness regardless of hue', () => {
    expect(hslToRgb({ h: 200, s: 1, l: 0 })).toEqual({ r: 0, g: 0, b: 0 });
    expect(hslToRgb({ h: 200, s: 1, l: 1 })).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('rgbToHsl / hslToRgb round-trip', () => {
  it('round-trips arbitrary colors', () => {
    for (const rgb of [
      { r: 22, g: 22, b: 26 },
      { r: 232, g: 83, b: 63 },
      { r: 43, g: 143, b: 138 },
      { r: 247, g: 230, b: 161 },
    ]) {
      expect(hslToRgb(rgbToHsl(rgb))).toEqual(rgb);
    }
  });
});
