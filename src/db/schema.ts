// Data model. Per perler-app-readme.md §4 plus the handoff's additions
// (paletteMode, colorCount, dither, display prefs) — see the plan's
// "Data Model" section for the reasoning behind cropRect's shape.

export interface Bead {
  id: string;
  name: string;
  hex: string;
  source?: string; // e.g. "PERLER P07" — populated once a real catalog (1h) exists
}

export interface BeadCollection {
  id: string;
  name: string;
  beads: Bead[];
  createdAt: number;
}

export type BeadType = 'regular' | 'mini';

export interface BoardConfig {
  beadType: BeadType;
  widthPegs: number;
  heightPegs: number;
  pegsPerInchOverride?: number;
  /** Interlocked physical boards this pattern spans (default 1x1 — a single board). */
  boardsWide: number;
  boardsHigh: number;
}

export interface PreprocessSettings {
  contrast: number;
  saturation: number;
  brightness: number;
}

export type PaletteMode = 'auto' | 'collection';

/** Normalized (0-1) crop rect against the original sourceImage. Reflowed (see lib/crop.ts) whenever the board's peg aspect ratio changes. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Pattern {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  sourceImage: string; // data URL, downsized to a sane max (e.g. 1600px)
  cropRect: CropRect;

  boardConfig: BoardConfig;
  collectionId: string | null; // null when paletteMode is 'auto'
  paletteMode: PaletteMode;
  colorCount: number; // 2-60, auto mode only
  dither: boolean;
  preprocessSettings: PreprocessSettings;

  gridData: (string | null)[][]; // beadId | null, [row][col]

  gridlines: boolean;
  symbolOverlay: boolean;
  previewBackground: 'white' | 'black';
  seamLines: boolean;
  /** Apple Pencil / mouse hover preview in the iPad panel (2a). */
  pencilHover: boolean;
}

export const DB_VERSION = 1;
export const DB_NAME = 'perlify';
