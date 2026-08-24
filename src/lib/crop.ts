import type { CropRect } from '../db/schema';

/**
 * Reflows a crop rect to a new aspect ratio (width/height), keeping it
 * centered on the same point. Since photo comes before board setup now,
 * the initial crop can't be aspect-locked yet — this is what lets the
 * Adjust screen change board dimensions live without asking the user to
 * re-crop by hand every time.
 *
 * Keeps whichever dimension is the *limiting* one (shorter, normalized)
 * fixed and recomputes the other from the new aspect, so a small aspect
 * tweak doesn't suddenly zoom the crop in or out.
 */
export function reflowCropRect(cropRect: CropRect, newAspect: number): CropRect {
  const cx = cropRect.x + cropRect.width / 2;
  const cy = cropRect.y + cropRect.height / 2;

  let width: number;
  let height: number;
  if (newAspect >= 1) {
    height = Math.min(cropRect.height, 1);
    width = Math.min(1, height * newAspect);
    if (width === 1) height = width / newAspect;
  } else {
    width = Math.min(cropRect.width, 1);
    height = Math.min(1, width / newAspect);
    if (height === 1) width = height * newAspect;
  }

  let x = cx - width / 2;
  let y = cy - height / 2;
  x = Math.min(Math.max(0, x), 1 - width);
  y = Math.min(Math.max(0, y), 1 - height);

  return { x, y, width, height };
}
