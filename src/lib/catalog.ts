// Reference bead catalog. Ported verbatim from the design prototype
// (perlify-design-handoff/Perler Studio.dc.html, CAT/COL arrays) — the
// handoff explicitly flags these as "plausible, not authoritative" and asks
// for real published Perler/Hama names, codes and hexes before shipping.
// Fine for personal use in the meantime; swap in real catalog data whenever
// it's convenient (see README "Assets" section).

export interface CatalogBead {
  id: string;
  name: string;
  hex: string;
  symbol: string;
}

const RAW_CATALOG: Array<[string, string]> = [
  ['Black', '#16161a'], ['Charcoal', '#2e3036'], ['Dark Grey', '#4a4c52'], ['Grey', '#8b8d93'],
  ['Silver', '#c3c5c9'], ['Pearl', '#e4e5e7'], ['White', '#f5f4f0'], ['Cream', '#f3e7c8'],
  ['Butter', '#f7e6a1'], ['Cheddar', '#f7cf5a'], ['Marigold', '#f5b731'], ['Butterscotch', '#f0a830'],
  ['Orange', '#f26a1b'], ['Hot Coral', '#e8533f'], ['Peach', '#f9b48f'], ['Blush', '#f4b1ae'],
  ['Salmon', '#ef8a7a'], ['Cherry Red', '#d1232a'], ['Red', '#b71f24'], ['Dark Cherry', '#8f1f2e'],
  ['Maroon', '#6d1a2a'], ['Rust', '#8f4a24'], ['Tan', '#b98a5a'], ['Sand', '#d9b382'],
  ['Toasted Marshmallow', '#e8c9a0'], ['Light Brown', '#a9723f'], ['Brown', '#6f4726'], ['Dark Brown', '#4a2f1c'],
  ['Bubblegum', '#e0709f'], ['Pink', '#ef86b7'], ['Pale Pink', '#f7c3d6'], ['Magenta', '#bf3273'],
  ['Fuchsia', '#d5348f'], ['Berry', '#8e2a5c'], ['Plum', '#4a2a63'], ['Purple', '#6b3f9e'],
  ['Violet', '#8355c4'], ['Lavender', '#a98ed0'], ['Pale Lavender', '#cdbde6'], ['Periwinkle', '#6f7fc4'],
  ['Cobalt', '#2b6cc4'], ['Blue', '#1f4fa0'], ['Dark Blue', '#22356e'], ['Navy', '#172445'],
  ['Sky', '#58a8de'], ['Light Blue', '#7fc4d8'], ['Pale Blue', '#bfe0ea'], ['Turquoise', '#35b6bd'],
  ['Teal', '#2b8f8a'], ['Dark Teal', '#1c5f5e'], ['Mint', '#a8dfc0'], ['Pastel Green', '#b7e08a'],
  ['Kiwi', '#6fbf5a'], ['Green', '#3f9e44'], ['Dark Green', '#2f6b3a'], ['Forest', '#1e4a2b'],
  ['Olive', '#8a9440'], ['Moss', '#5f6f31'], ['Khaki', '#b6b077'], ['Slate Blue', '#55698c'],
];

// A-Z, 0-9, then lowercase a-x — assigned by catalog index (see README's
// "Symbol assignment" open decision; global-by-index is what M1 ships).
const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwx';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const CATALOG: CatalogBead[] = RAW_CATALOG.map(([name, hex], i) => ({
  id: slugify(name),
  name,
  hex,
  symbol: SYMBOLS.charAt(i) || '?',
}));

const CATALOG_BY_ID = new Map(CATALOG.map((b) => [b.id, b]));

export function catalogBeadById(id: string): CatalogBead | undefined {
  return CATALOG_BY_ID.get(id);
}

// Default "owned" indices for the seed collection, ported from the
// prototype's COL array — an arbitrary but visually varied 24-color subset.
const DEFAULT_OWNED_INDICES = [0, 3, 6, 7, 9, 11, 12, 13, 17, 19, 28, 31, 34, 35, 37, 39, 40, 42, 45, 46, 48, 52, 53, 54];

export const DEFAULT_OWNED_BEADS: CatalogBead[] = DEFAULT_OWNED_INDICES.map((i) => CATALOG[i]);
