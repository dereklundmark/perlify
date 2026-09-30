// Color-family editing for the editor's COLOR FAMILIES panel: group a
// design's colors into families (blues, reds…), nudge a color or a whole
// family lighter/darker/more saturated/more contrasty, and add or remove a
// color within a family. Every distance here is the same CIE76 metric the
// photo matcher uses, so "closest" means what it means everywhere else.

import type { Bead } from '../db/schema';
import { deltaE76Sq, hexToRgb, rgbToHex, rgbToLab, type Lab, type RGB } from './color';
import { groupByColorFamily, type ColorFamily } from './colorFamily';
import type { GridData } from './grid';
import { hslToRgb, rgbToHsl } from './hsl';

export interface FamilyColor extends Bead {
  count: number;
}

export interface FamilyGroup {
  family: ColorFamily;
  label: string;
  /** Lightest first. */
  colors: FamilyColor[];
}

/** The design's colors grouped into families, each lightest-first. */
export function familiesInUsage(
  usage: { beadId: string; count: number }[],
  getBead: (id: string) => Bead | undefined,
): FamilyGroup[] {
  const colors = usage.flatMap(({ beadId, count }) => {
    const bead = getBead(beadId);
    return bead ? [{ id: bead.id, name: bead.name, hex: bead.hex, count }] : [];
  });
  return groupByColorFamily(colors).map((g) => ({ family: g.family, label: g.label, colors: g.items }));
}

/** -100..100 each; 0 leaves that property alone. */
export interface ColorAdjust {
  brightness: number;
  saturation: number;
}

/**
 * Lighter/darker and more/less saturated, in HSL. Positive values move
 * toward white / full saturation, negative toward black / grey, by that
 * percentage of the remaining distance — so ±100 always reaches the end.
 */
export function adjustHex(hex: string, { brightness, saturation }: ColorAdjust): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  const toward = (v: number, amount: number) => (amount >= 0 ? v + (1 - v) * (amount / 100) : v * (1 + amount / 100));
  return rgbToHex(hslToRgb({ h: hsl.h, s: toward(hsl.s, saturation), l: toward(hsl.l, brightness) }));
}

/**
 * Family contrast (-100..100): pushes each color's lightness away from
 * (positive) or toward (negative) the family's average, so lights get
 * lighter and darks darker. Returns the new hex for each input, in order.
 */
export function contrastHexes(hexes: string[], amount: number): string[] {
  const hsls = hexes.map((h) => rgbToHsl(hexToRgb(h)));
  const mean = hsls.reduce((sum, c) => sum + c.l, 0) / Math.max(1, hsls.length);
  const factor = 1 + amount / 100;
  return hsls.map((c) => {
    const l = Math.min(1, Math.max(0, mean + (c.l - mean) * factor));
    return rgbToHex(hslToRgb({ h: c.h, s: c.s, l }));
  });
}

const labOf = (hex: string): Lab => rgbToLab(hexToRgb(hex));

/** The pool bead closest to `hex`. Undefined only for an empty pool. */
export function nearestBead(hex: string, pool: Bead[]): Bead | undefined {
  const target = labOf(hex);
  let best: Bead | undefined;
  let bestD = Infinity;
  for (const bead of pool) {
    const d = deltaE76Sq(target, labOf(bead.hex));
    if (d < bestD) [best, bestD] = [bead, d];
  }
  return best;
}

/** Replaces every id in `map` at once (so A→B, B→C never chains A into C). */
export function remapGrid(grid: GridData, map: Map<string, string>): GridData {
  if (map.size === 0) return grid;
  return grid.map((row) => row.map((id) => (id != null && map.has(id) ? map.get(id)! : id)));
}

/**
 * "−": the family's least-used color, merged into whichever other family
 * color is closest to it. Null when the family has fewer than two colors.
 */
export function pickMerge(colors: FamilyColor[]): { from: FamilyColor; to: FamilyColor } | null {
  if (colors.length < 2) return null;
  const from = [...colors].sort((a, b) => a.count - b.count)[0];
  const others = colors.filter((c) => c.id !== from.id);
  const to = nearestBead(from.hex, others) as FamilyColor;
  return { from, to };
}

export interface FamilyCell {
  row: number;
  col: number;
  /** The photo's color at this cell (see sampleAdjustedGrid). */
  rgb: RGB;
}

/**
 * "+": picks the candidate that most improves how well the family's cells
 * match the photo when added to the family's current colors, then re-splits
 * those cells between the enlarged set (each to its closest). Returns null
 * if there's no candidate or no cell would actually use the new color.
 */
export function pickAddition(
  cells: FamilyCell[],
  current: Bead[],
  candidates: Bead[],
): { added: Bead; assignment: Map<string, string> } | null {
  if (cells.length === 0 || candidates.length === 0) return null;
  const labs = cells.map((c) => rgbToLab(c.rgb));
  const currentLabs = current.map((b) => labOf(b.hex));
  const bestCurrent = labs.map((lab) => Math.min(...currentLabs.map((l) => deltaE76Sq(lab, l)), Infinity));

  let added: Bead | undefined;
  let bestTotal = Infinity;
  for (const cand of candidates) {
    const cl = labOf(cand.hex);
    let total = 0;
    for (let i = 0; i < labs.length; i++) total += Math.min(bestCurrent[i], deltaE76Sq(labs[i], cl));
    if (total < bestTotal) [added, bestTotal] = [cand, total];
  }
  if (!added) return null;

  const pool = [...current, added];
  const poolLabs = pool.map((b) => labOf(b.hex));
  const assignment = new Map<string, string>();
  let usesNew = false;
  cells.forEach((cell, i) => {
    let bestIdx = 0;
    let bestD = Infinity;
    poolLabs.forEach((pl, j) => {
      const d = deltaE76Sq(labs[i], pl);
      if (d < bestD) [bestIdx, bestD] = [j, d];
    });
    const id = pool[bestIdx].id;
    assignment.set(`${cell.row},${cell.col}`, id);
    if (id === added.id) usesNew = true;
  });
  return usesNew ? { added, assignment } : null;
}
