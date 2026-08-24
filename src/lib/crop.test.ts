import { describe, expect, it } from 'vitest';
import { computeCoverCrop, isSentinelCrop } from './crop';

describe('isSentinelCrop', () => {
  it('recognizes the untouched full-image value', () => {
    expect(isSentinelCrop({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
  });

  it('rejects any real crop', () => {
    expect(isSentinelCrop({ x: 0.1, y: 0, width: 1, height: 1 })).toBe(false);
    expect(isSentinelCrop({ x: 0, y: 0, width: 0.5, height: 1 })).toBe(false);
  });
});

describe('computeCoverCrop', () => {
  it('is a no-op full-image crop when aspects already match', () => {
    expect(computeCoverCrop(1, 1)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(computeCoverCrop(1.5, 1.5)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('crops the sides on a landscape photo fit to a portrait/square board', () => {
    // 2:1 photo onto a square board -> keep full height, half the width, centered
    const crop = computeCoverCrop(2, 1);
    expect(crop.y).toBe(0);
    expect(crop.height).toBe(1);
    expect(crop.width).toBeCloseTo(0.5, 5);
    expect(crop.x).toBeCloseTo(0.25, 5);
  });

  it('crops the top/bottom on a portrait photo fit to a wide board', () => {
    // 1:2 (tall) photo onto a 4:1 wide board -> keep full width, an eighth of the height, centered
    const crop = computeCoverCrop(0.5, 4);
    expect(crop.x).toBe(0);
    expect(crop.width).toBe(1);
    expect(crop.height).toBeCloseTo(0.125, 5);
    expect(crop.y).toBeCloseTo(0.4375, 5);
  });
});
