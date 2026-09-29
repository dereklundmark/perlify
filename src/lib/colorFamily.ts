import { hexToRgb } from './color';
import { rgbToHsl } from './hsl';

export type ColorFamily =
  | 'reds'
  | 'pinks'
  | 'oranges'
  | 'browns'
  | 'yellows'
  | 'greens'
  | 'teals'
  | 'blues'
  | 'purples'
  | 'neutrals';

/** Display order — roughly around the color wheel, neutrals last. */
export const COLOR_FAMILIES: { id: ColorFamily; label: string }[] = [
  { id: 'reds', label: 'REDS' },
  { id: 'pinks', label: 'PINKS' },
  { id: 'oranges', label: 'ORANGES' },
  { id: 'browns', label: 'BROWNS' },
  { id: 'yellows', label: 'YELLOWS' },
  { id: 'greens', label: 'GREENS' },
  { id: 'teals', label: 'TEALS' },
  { id: 'blues', label: 'BLUES' },
  { id: 'purples', label: 'PURPLES' },
  { id: 'neutrals', label: 'WHITES · GREYS · BLACKS' },
];

/** Buckets a color into the family a person would call it, by HSL hue plus a few lightness/saturation rules. */
export function colorFamily(hex: string): ColorFamily {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  if (s < 0.15 || l < 0.1 || l > 0.95) return 'neutrals';
  // Dark or muted oranges/yellows read as brown (tan, rust, chocolate).
  if (h >= 10 && h < 45 && (l < 0.4 || s < 0.5)) return 'browns';
  if (h < 15 || h >= 345) return l > 0.7 ? 'pinks' : 'reds';
  if (h < 40) return 'oranges';
  if (h < 62) return 'yellows';
  if (h < 165) return 'greens';
  if (h < 190) return 'teals';
  if (h < 255) return 'blues';
  if (h < 290) return 'purples';
  return 'pinks';
}

/** Groups items by color family (in COLOR_FAMILIES order), lightest first within each group. Empty groups are dropped. */
export function groupByColorFamily<T extends { hex: string }>(items: T[]): { family: ColorFamily; label: string; items: T[] }[] {
  const lightness = (hex: string) => rgbToHsl(hexToRgb(hex)).l;
  return COLOR_FAMILIES.map(({ id, label }) => ({
    family: id,
    label,
    items: items.filter((i) => colorFamily(i.hex) === id).sort((a, b) => lightness(b.hex) - lightness(a.hex)),
  })).filter((g) => g.items.length > 0);
}
