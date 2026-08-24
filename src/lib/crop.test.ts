import { describe, expect, it } from 'vitest';
import { reflowCropRect } from './crop';

describe('reflowCropRect', () => {
  it('keeps the same center point when widening', () => {
    const square = { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };
    const cx = square.x + square.width / 2;
    const cy = square.y + square.height / 2;
    const wide = reflowCropRect(square, 2); // 2:1
    expect(wide.x + wide.width / 2).toBeCloseTo(cx, 5);
    expect(wide.y + wide.height / 2).toBeCloseTo(cy, 5);
    expect(wide.width / wide.height).toBeCloseTo(2, 5);
  });

  it('keeps the shorter dimension fixed when narrowing (tall aspect)', () => {
    const square = { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };
    const tall = reflowCropRect(square, 0.5); // 1:2
    expect(tall.width).toBeCloseTo(0.4, 5);
    expect(tall.width / tall.height).toBeCloseTo(0.5, 5);
  });

  it('clamps to the image bounds instead of going negative or over 1', () => {
    const nearEdge = { x: 0.02, y: 0.02, width: 0.2, height: 0.2 };
    const wide = reflowCropRect(nearEdge, 4);
    expect(wide.x).toBeGreaterThanOrEqual(0);
    expect(wide.y).toBeGreaterThanOrEqual(0);
    expect(wide.x + wide.width).toBeLessThanOrEqual(1 + 1e-9);
    expect(wide.y + wide.height).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('never produces a dimension greater than 1', () => {
    const big = reflowCropRect({ x: 0, y: 0, width: 1, height: 1 }, 5);
    expect(big.width).toBeLessThanOrEqual(1);
    expect(big.height).toBeLessThanOrEqual(1);
  });

  it('is a no-op when the aspect matches the current crop', () => {
    const square = { x: 0.1, y: 0.2, width: 0.4, height: 0.4 };
    const same = reflowCropRect(square, 1);
    expect(same.width).toBeCloseTo(0.4, 5);
    expect(same.height).toBeCloseTo(0.4, 5);
  });
});
