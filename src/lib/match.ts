import type { Bead, CropRect, PreprocessSettings } from '../db/schema';
import type { GridData } from './grid';
import { CATALOG } from './catalog';
import {
  applyPreprocess,
  floydSteinbergMatch,
  hexToRgb,
  nearestIndex,
  pickAutoPaletteIndices,
  rgbToLab,
  type PaletteEntry,
  type RGB,
} from './color';

/**
 * Downscales the cropped region straight to widthPegs x heightPegs with
 * high-quality image smoothing — the browser's bilinear/bicubic filtering
 * is a good stand-in for "average each cell's source-image region to one
 * RGB value" and is dramatically simpler/faster than a manual box average.
 */
export function sampleGridRgb(
  image: HTMLImageElement | HTMLCanvasElement,
  cropRect: CropRect,
  widthPegs: number,
  heightPegs: number,
): RGB[][] {
  const sw = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const sh = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const sx = cropRect.x * sw;
  const sy = cropRect.y * sh;
  const sWidth = cropRect.width * sw;
  const sHeight = cropRect.height * sh;

  const canvas = document.createElement('canvas');
  canvas.width = widthPegs;
  canvas.height = heightPegs;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, widthPegs, heightPegs);
  const { data } = ctx.getImageData(0, 0, widthPegs, heightPegs);

  const grid: RGB[][] = [];
  for (let row = 0; row < heightPegs; row++) {
    const rowArr: RGB[] = [];
    for (let col = 0; col < widthPegs; col++) {
      const i = (row * widthPegs + col) * 4;
      rowArr.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
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
  dither: boolean;
}

export interface MatchResult {
  gridData: GridData;
  /** The candidate palette actually available for this match (all of it may not appear in the grid). */
  candidatePalette: Bead[];
}

export function matchImageToGrid(params: MatchParams): MatchResult {
  const rawGrid = sampleGridRgb(params.image, params.cropRect, params.widthPegs, params.heightPegs);
  const adjustedGrid = rawGrid.map((row) => row.map((c) => applyPreprocess(c, params.preprocess)));

  let candidatePalette: Bead[];
  if (params.paletteMode === 'collection') {
    candidatePalette = params.collectionBeads;
  } else {
    const flatLabs = adjustedGrid.flat().map(rgbToLab);
    const catalogEntries: PaletteEntry[] = CATALOG.map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
    const indices = pickAutoPaletteIndices(flatLabs, catalogEntries, params.colorCount);
    candidatePalette = indices.map((i) => CATALOG[i]);
  }

  if (candidatePalette.length === 0) {
    const empty: GridData = adjustedGrid.map((row) => row.map(() => null));
    return { gridData: empty, candidatePalette };
  }

  const paletteEntries: PaletteEntry[] = candidatePalette.map((b) => ({ id: b.id, lab: rgbToLab(hexToRgb(b.hex)) }));
  const paletteRgb = candidatePalette.map((b) => hexToRgb(b.hex));

  const indicesGrid: number[][] = params.dither
    ? floydSteinbergMatch(adjustedGrid, paletteEntries, paletteRgb)
    : adjustedGrid.map((row) => row.map((c) => nearestIndex(rgbToLab(c), paletteEntries)));

  const gridData: GridData = indicesGrid.map((row) => row.map((idx) => candidatePalette[idx].id));

  return { gridData, candidatePalette };
}
