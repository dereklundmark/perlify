import type { Bead, CropRect, DitherMode, PreprocessSettings, SamplingMode } from '../db/schema';
import type { GridData } from './grid';
import { CATALOG } from './catalog';
import { abstractGrid, denoiseGrid, sharpenGrid } from './imageProcess';
import { swapColor } from './gridTransform';
import {
  applyPreprocess,
  atkinsonMatch,
  floydSteinbergMatch,
  hexToRgb,
  nearestIndex,
  orderedDitherMatch,
  pickAutoPaletteIndices,
  rgbToLab,
  type PaletteEntry,
  type RGB,
} from './color';

const MAX_INTERMEDIATE = 1200;

/**
 * Samples the cropped region down to widthPegs x heightPegs. 'box' draws
 * the region at (near-)native resolution first, then manually averages
 * every source pixel inside each destination cell's exact rectangle —
 * deterministic and correct regardless of downscale ratio, unlike relying
 * on the browser's own resize quality for one huge single-step resize.
 * 'nearest' instead samples one representative pixel per cell (its
 * center) — useful for source art that's already flat-colored/pixelated
 * (cartoons, sprites), where averaging would blur crisp edges.
 */
export function sampleGridRgb(
  image: HTMLImageElement | HTMLCanvasElement,
  cropRect: CropRect,
  widthPegs: number,
  heightPegs: number,
  samplingMode: SamplingMode = 'box',
): RGB[][] {
  const sw = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const sh = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const sx = cropRect.x * sw;
  const sy = cropRect.y * sh;
  const sWidth = cropRect.width * sw;
  const sHeight = cropRect.height * sh;

  const fitScale = Math.min(1, MAX_INTERMEDIATE / Math.max(sWidth, sHeight));
  const capW = Math.max(widthPegs, Math.round(sWidth * fitScale));
  const capH = Math.max(heightPegs, Math.round(sHeight * fitScale));

  const canvas = document.createElement('canvas');
  canvas.width = capW;
  canvas.height = capH;
  const ctx = canvas.getContext('2d')!;
  // The crop window can extend past the source image's own bounds (the
  // user zoomed out to pad a narrower photo) — pre-fill white so drawImage's
  // spec-mandated clipping to the actual image leaves white in the gaps.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, capW, capH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, capW, capH);
  const { data } = ctx.getImageData(0, 0, capW, capH);

  const pixelAt = (x: number, y: number): RGB => {
    const i = (y * capW + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };

  const grid: RGB[][] = [];
  for (let row = 0; row < heightPegs; row++) {
    const y0 = Math.floor((row / heightPegs) * capH);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) / heightPegs) * capH));
    const rowArr: RGB[] = [];
    for (let col = 0; col < widthPegs; col++) {
      const x0 = Math.floor((col / widthPegs) * capW);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) / widthPegs) * capW));
      if (samplingMode === 'nearest') {
        const cx = Math.min(capW - 1, Math.floor((x0 + x1) / 2));
        const cy = Math.min(capH - 1, Math.floor((y0 + y1) / 2));
        rowArr.push(pixelAt(cx, cy));
      } else {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let y = y0; y < Math.min(y1, capH); y++) {
          for (let x = x0; x < Math.min(x1, capW); x++) {
            const p = pixelAt(x, y);
            r += p.r;
            g += p.g;
            b += p.b;
            count++;
          }
        }
        rowArr.push(count > 0 ? { r: r / count, g: g / count, b: b / count } : { r: 255, g: 255, b: 255 });
      }
    }
    grid.push(rowArr);
  }
  return grid;
}

export interface MatchParams {
  image: HTMLImageElement | HTMLCanvasElement;
  cropRect: CropRect;
  widthPegs: number;
  heightPegs: number;
  preprocess: PreprocessSettings;
  paletteMode: 'auto' | 'collection';
  colorCount: number;
  collectionBeads: Bead[];
  ditherMode: DitherMode;
  samplingMode: SamplingMode;
  /** Manual editor swaps, re-applied after matching so they survive a later slider/palette change. */
  colorSwaps: { from: string; to: string }[];
}

export interface MatchResult {
  gridData: GridData;
  /** The candidate palette actually available for this match (all of it may not appear in the grid). */
  candidatePalette: Bead[];
}

export function matchImageToGrid(params: MatchParams): MatchResult {
  const rawGrid = sampleGridRgb(
    params.image,
    params.cropRect,
    params.widthPegs,
    params.heightPegs,
    params.samplingMode,
  );
  // Denoise/abstract first (clean up the sampled colors before tonal
  // adjustments, like a normal photo pipeline), sharpen last (acts on the
  // final adjusted image, right before matching).
  const denoised = denoiseGrid(rawGrid, params.preprocess.denoise);
  const abstracted = abstractGrid(denoised, params.preprocess.abstraction);
  const adjustedGrid = abstracted.map((row) => row.map((c) => applyPreprocess(c, params.preprocess)));
  const sharpened = sharpenGrid(adjustedGrid, params.preprocess.sharpen);

  let candidatePalette: Bead[];
  if (params.paletteMode === 'collection') {
    // colorCount caps a collection's palette the same way it caps Auto —
    // below the collection's own size, keep only the N most-used beads
    // rather than always matching against every bead the collection has.
    if (params.colorCount < params.collectionBeads.length) {
      const flatLabs = sharpened.flat().map(rgbToLab);
      const collectionEntries: PaletteEntry[] = params.collectionBeads.map((b) => ({
        id: b.id,
        lab: rgbToLab(hexToRgb(b.hex)),
      }));
      const indices = pickAutoPaletteIndices(flatLabs, collectionEntries, params.colorCount);
      candidatePalette = indices.map((i) => params.collectionBeads[i]);
    } else {
      candidatePalette = params.collectionBeads;
    }
  } else {
    const flatLabs = sharpened.flat().map(rgbToLab);
    const catalogEntries: PaletteEntry[] = CATALOG.map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
    const indices = pickAutoPaletteIndices(flatLabs, catalogEntries, params.colorCount);
    candidatePalette = indices.map((i) => CATALOG[i]);
  }

  if (candidatePalette.length === 0) {
    const empty: GridData = sharpened.map((row) => row.map(() => null));
    return { gridData: applySwaps(empty, params.colorSwaps), candidatePalette };
  }

  const paletteEntries: PaletteEntry[] = candidatePalette.map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
  const paletteRgb = candidatePalette.map((b) => hexToRgb(b.hex));

  let indicesGrid: number[][];
  switch (params.ditherMode) {
    case 'floyd-steinberg':
      indicesGrid = floydSteinbergMatch(sharpened, paletteEntries, paletteRgb);
      break;
    case 'atkinson':
      indicesGrid = atkinsonMatch(sharpened, paletteEntries, paletteRgb);
      break;
    case 'ordered':
      indicesGrid = orderedDitherMatch(sharpened, paletteEntries);
      break;
    default:
      indicesGrid = sharpened.map((row) => row.map((c) => nearestIndex(rgbToLab(c), paletteEntries)));
  }

  const matched: GridData = indicesGrid.map((row) => row.map((idx) => candidatePalette[idx].id));

  return { gridData: applySwaps(matched, params.colorSwaps), candidatePalette };
}

function applySwaps(grid: GridData, swaps: { from: string; to: string }[]): GridData {
  return swaps.reduce((g, { from, to }) => swapColor(g, from, to), grid);
}
