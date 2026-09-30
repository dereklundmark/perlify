// Color matching engine.
//
// Algorithm per perlify-design-handoff/README.md ("Color Matching") and
// perler-app-readme.md §D: average each cell to one RGB value, apply the
// user's contrast/saturation/brightness adjustments, convert to CIE Lab,
// and pick the nearest palette color by squared Delta E (CIE76) — never by
// raw RGB distance. An earlier RGB-distance version of the prototype this
// spec is based on mismatched a sunset's orange glow to browns; Lab is what
// fixes that, because it approximates perceived color difference.

import type { PreprocessSettings } from '../db/schema';
import { hsbToRgb } from './hsb';

export type { PreprocessSettings };

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// sRGB -> linear -> XYZ (D65) -> Lab
export function rgbToLab(rgb: RGB): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // sRGB D65 matrix
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  // D65 reference white
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const fx = labF(x / xn);
  const fy = labF(y / yn);
  const fz = labF(z / zn);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;
}

/** Squared Delta E (CIE76). Avoids a sqrt in the hot per-cell matching loop. */
export function deltaE76Sq(a: Lab, b: Lab): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dl * dl + da * da + db * db;
}

/** Relative luminance (0-1), used to pick a light/dark symbol glyph against a bead's fill. */
export function relativeLuminance(rgb: RGB): number {
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

/**
 * Brightness, then contrast, then a luminance-blend saturation adjustment.
 * All three sliders are -100..100, 0 = no change.
 */
export function applyPreprocess(rgb: RGB, settings: PreprocessSettings): RGB {
  const brightnessOffset = settings.brightness * 1.28; // -100..100 -> ~-128..128
  const contrast255 = settings.contrast * 2.55; // -100..100 -> -255..255
  const contrastFactor = (259 * (contrast255 + 255)) / (255 * (259 - contrast255));
  const satFactor = 1 + settings.saturation / 100;

  let r = rgb.r + brightnessOffset;
  let g = rgb.g + brightnessOffset;
  let b = rgb.b + brightnessOffset;

  r = contrastFactor * (r - 128) + 128;
  g = contrastFactor * (g - 128) + 128;
  b = contrastFactor * (b - 128) + 128;

  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = gray + satFactor * (r - gray);
  g = gray + satFactor * (g - gray);
  b = gray + satFactor * (b - gray);

  let result: RGB = { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
  if (settings.duotone) result = applyDuotone(result, settings.duotoneHue);
  return result;
}

/**
 * Classic two-tone effect: remap each pixel's own luminance onto a
 * gradient between a dark and a light shade of one hue, replacing its
 * original color entirely.
 */
function applyDuotone(rgb: RGB, hue: number): RGB {
  const luminance = relativeLuminance(rgb);
  const dark = hsbToRgb({ h: hue, s: 0.65, v: 0.22 });
  const light = hsbToRgb({ h: hue, s: 0.3, v: 0.96 });
  return {
    r: dark.r + (light.r - dark.r) * luminance,
    g: dark.g + (light.g - dark.g) * luminance,
    b: dark.b + (light.b - dark.b) * luminance,
  };
}

export interface PaletteEntry {
  id: string;
  lab: Lab;
}

/** Index of the nearest palette entry to `lab`, by squared Delta E. */
export function nearestIndex(lab: Lab, palette: PaletteEntry[]): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = deltaE76Sq(lab, palette[i].lab);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Auto-palette selection: match every cell against the full catalog, count
 * usage per catalog color, keep the N most-used, then the caller re-matches
 * restricted to those N (see matchImageToGrid).
 */
export function pickAutoPaletteIndices(
  cellLabs: Lab[],
  catalog: PaletteEntry[],
  n: number,
): number[] {
  const usage = new Array(catalog.length).fill(0);
  for (const lab of cellLabs) {
    usage[nearestIndex(lab, catalog)]++;
  }
  return usage
    .map((count, idx) => ({ count, idx }))
    .sort((a, b) => b.count - a.count || a.idx - b.idx)
    .slice(0, Math.min(n, catalog.length))
    .map((e) => e.idx)
    .sort((a, b) => a - b);
}

interface DiffusionStep {
  dr: number;
  dc: number;
  factor: number;
}

// 100% of the match error is pushed onto unprocessed neighbors — the
// classic, most "organic-noise" looking diffusion pattern.
const FLOYD_STEINBERG_PATTERN: DiffusionStep[] = [
  { dr: 0, dc: 1, factor: 7 / 16 },
  { dr: 1, dc: -1, factor: 3 / 16 },
  { dr: 1, dc: 0, factor: 5 / 16 },
  { dr: 1, dc: 1, factor: 1 / 16 },
];

// Only 75% of the error is diffused (6 of 8 shares) — the rest is simply
// dropped, giving a lighter, higher-contrast result than Floyd-Steinberg
// (this is the dithering Apple used on the original Mac).
const ATKINSON_PATTERN: DiffusionStep[] = [
  { dr: 0, dc: 1, factor: 1 / 8 },
  { dr: 0, dc: 2, factor: 1 / 8 },
  { dr: 1, dc: -1, factor: 1 / 8 },
  { dr: 1, dc: 0, factor: 1 / 8 },
  { dr: 1, dc: 1, factor: 1 / 8 },
  { dr: 2, dc: 0, factor: 1 / 8 },
];

/**
 * Error-diffusion dithering over a raster of adjusted RGB cells, matching
 * each pixel against `palette` in Lab space and diffusing the RGB match
 * error to unprocessed neighbors per `pattern`.
 */
function errorDiffusionMatch(
  cells: RGB[][], // [row][col], already preprocessed
  palette: PaletteEntry[],
  paletteRgb: RGB[],
  pattern: DiffusionStep[],
): number[][] {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  // Work on a mutable copy so error diffusion doesn't corrupt the caller's data.
  const work: RGB[][] = cells.map((row) => row.map((c) => ({ ...c })));
  const result: number[][] = Array.from({ length: h }, () => new Array(w).fill(0));

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const cell = work[row][col];
      const lab = rgbToLab(cell);
      const idx = nearestIndex(lab, palette);
      result[row][col] = idx;

      const matched = paletteRgb[idx];
      const er = cell.r - matched.r;
      const eg = cell.g - matched.g;
      const eb = cell.b - matched.b;

      for (const { dr, dc, factor } of pattern) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= h || c < 0 || c >= w) continue;
        const target = work[r][c];
        target.r = clamp(target.r + er * factor, 0, 255);
        target.g = clamp(target.g + eg * factor, 0, 255);
        target.b = clamp(target.b + eb * factor, 0, 255);
      }
    }
  }

  return result;
}

export function floydSteinbergMatch(cells: RGB[][], palette: PaletteEntry[], paletteRgb: RGB[]): number[][] {
  return errorDiffusionMatch(cells, palette, paletteRgb, FLOYD_STEINBERG_PATTERN);
}

export function atkinsonMatch(cells: RGB[][], palette: PaletteEntry[], paletteRgb: RGB[]): number[][] {
  return errorDiffusionMatch(cells, palette, paletteRgb, ATKINSON_PATTERN);
}

// Values 0-15 arranged so that thresholding against them (scaled) spreads
// evenly across a 4x4 tile — the standard Bayer matrix.
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const ORDERED_STRENGTH = 24; // RGB offset amplitude at the matrix's extremes

/**
 * Ordered (Bayer) dithering: nudges each cell's color by a fixed,
 * position-dependent offset before matching — no error accumulation, so
 * every cell is independent, giving a regular crosshatch texture instead
 * of Floyd-Steinberg/Atkinson's organic noise.
 */
export function orderedDitherMatch(cells: RGB[][], palette: PaletteEntry[]): number[][] {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  const result: number[][] = Array.from({ length: h }, () => new Array(w).fill(0));

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const offset = (BAYER_4X4[row % 4][col % 4] / 16 - 0.5) * ORDERED_STRENGTH;
      const cell = cells[row][col];
      const adjusted: RGB = {
        r: clamp(cell.r + offset, 0, 255),
        g: clamp(cell.g + offset, 0, 255),
        b: clamp(cell.b + offset, 0, 255),
      };
      result[row][col] = nearestIndex(rgbToLab(adjusted), palette);
    }
  }

  return result;
}
