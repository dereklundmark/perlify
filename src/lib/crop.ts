import type { CropRect } from '../db/schema';

/** `{x:0,y:0,width:1,height:1}` — the "not framed yet" placeholder value. */
export function isSentinelCrop(c: CropRect): boolean {
  return c.x === 0 && c.y === 0 && c.width === 1 && c.height === 1;
}

/**
 * Centered crop matching `boardAspect`, same math as CSS `object-fit:
 * cover` — used as a silent, non-distorting default so a pattern never
 * renders visibly stretched just because the user hasn't opened the
 * pegboard-fitting tool yet.
 */
export function computeCoverCrop(imageAspect: number, boardAspect: number): CropRect {
  if (imageAspect > boardAspect) {
    const width = boardAspect / imageAspect;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = imageAspect / boardAspect;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}
