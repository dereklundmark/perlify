// Color matching engine.
//
// Algorithm per perlify-design-handoff/README.md ("Color Matching") and
// perler-app-readme.md §D: average each cell to one RGB value, apply the
// user's contrast/saturation/brightness adjustments, convert to CIE Lab,
// and pick the nearest palette color by squared Delta E (CIE76) — never by
// raw RGB distance. An earlier RGB-distance version of the prototype this
// spec is based on mismatched a sunset's orange glow to browns; Lab is what
// fixes that, because it approximates perceived color difference.

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

export interface PreprocessSettings {
  contrast: number; // -100..100
  saturation: number; // -100..100
  brightness: number; // -100..100
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

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
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

/**
 * Floyd-Steinberg error diffusion over a raster of adjusted RGB cells,
 * matching each pixel against `palette` in Lab space and diffusing the
 * RGB match error to unprocessed neighbors.
 */
export function floydSteinbergMatch(
  cells: RGB[][], // [row][col], already preprocessed
  palette: PaletteEntry[] & { rgb?: RGB[] },
  paletteRgb: RGB[],
): number[][] {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  // Work on a mutable copy so error diffusion doesn't corrupt the caller's data.
  const work: RGB[][] = cells.map((row) => row.map((c) => ({ ...c })));
  const result: number[][] = Array.from({ length: h }, () => new Array(w).fill(0));

  const diffuse = (row: number, col: number, er: number, eg: number, eb: number, factor: number) => {
    if (row < 0 || row >= h || col < 0 || col >= w) return;
    const cell = work[row][col];
    cell.r = clamp(cell.r + er * factor, 0, 255);
    cell.g = clamp(cell.g + eg * factor, 0, 255);
    cell.b = clamp(cell.b + eb * factor, 0, 255);
  };

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

      diffuse(row, col + 1, er, eg, eb, 7 / 16);
      diffuse(row + 1, col - 1, er, eg, eb, 3 / 16);
      diffuse(row + 1, col, er, eg, eb, 5 / 16);
      diffuse(row + 1, col + 1, er, eg, eb, 1 / 16);
    }
  }

  return result;
}
