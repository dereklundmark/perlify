import { describe, expect, it } from 'vitest';
import { hsbToRgb, rgbToHsb } from './hsb';

describe('hsbToRgb', () => {
  it('matches known primary/secondary colors', () => {
    expect(hsbToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsbToRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsbToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('produces white at s=0, v=1 regardless of hue', () => {
    expect(hsbToRgb({ h: 200, s: 0, v: 1 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('produces black at v=0 regardless of hue/saturation', () => {
    expect(hsbToRgb({ h: 50, s: 0.8, v: 0 })).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgbToHsb / hsbToRgb round-trip', () => {
  it('round-trips a set of hues at fixed s/v within rounding tolerance', () => {
    for (const h of [0, 30, 90, 180, 210, 270, 330]) {
      const rgb = hsbToRgb({ h, s: 0.7, v: 0.9 });
      const back = rgbToHsb(rgb);
      const rgbAgain = hsbToRgb(back);
      expect(rgbAgain.r).toBeCloseTo(rgb.r, 0);
      expect(rgbAgain.g).toBeCloseTo(rgb.g, 0);
      expect(rgbAgain.b).toBeCloseTo(rgb.b, 0);
    }
  });
});
