import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type BeadCollection, type Pattern } from './schema';
import { beadById, DEFAULT_OWNED_BEADS, HAMA_PRESET_BEADS, isCatalogBead, PERLER_PRESET_BEADS } from '../lib/catalog';

interface PerlifyDBSchema extends DBSchema {
  collections: {
    key: string;
    value: BeadCollection;
  };
  patterns: {
    key: string;
    value: Pattern;
    indexes: { 'by-updatedAt': number };
  };
}

let dbPromise: Promise<IDBPDatabase<PerlifyDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<PerlifyDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PerlifyDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('patterns')) {
          const store = db.createObjectStore('patterns', { keyPath: 'id' });
          store.createIndex('by-updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

export const DEFAULT_COLLECTION_ID = 'my-colors';
export const HAMA_PRESET_COLLECTION_ID = 'preset-hama';
export const PERLER_PRESET_COLLECTION_ID = 'preset-perler';

// Set once the starter collections exist, so deleting one (e.g. "My
// Colors") sticks instead of it being re-created on the next launch.
const SEEDED_KEY = 'perlify.collectionsSeeded';

function readSeededFlag(): boolean {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSeededFlag(): void {
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    // Storage blocked — the non-empty check in seedStarterCollections still protects deletions.
  }
}

/**
 * Seeds "My Colors" + the Hama/Perler presets (quick starting palettes —
 * see catalog.ts) on a brand-new install only. An install that already has
 * any collection is never re-seeded.
 */
export async function seedStarterCollections(): Promise<void> {
  if (readSeededFlag()) return;
  const db = await getDb();
  if ((await db.count('collections')) > 0) {
    writeSeededFlag();
    return;
  }
  const now = Date.now();
  const toBeads = (beads: typeof DEFAULT_OWNED_BEADS) => beads.map(({ id, name, hex }) => ({ id, name, hex }));
  const seeds: BeadCollection[] = [
    { id: DEFAULT_COLLECTION_ID, name: 'My Colors', beads: toBeads(DEFAULT_OWNED_BEADS), createdAt: now },
    { id: HAMA_PRESET_COLLECTION_ID, name: 'Hama', beads: toBeads(HAMA_PRESET_BEADS), createdAt: now },
    { id: PERLER_PRESET_COLLECTION_ID, name: 'Perler', beads: toBeads(PERLER_PRESET_BEADS), createdAt: now },
  ];
  const tx = db.transaction('collections', 'readwrite');
  await Promise.all([...seeds.map((c) => tx.store.put(c)), tx.done]);
  writeSeededFlag();
}

export async function listCollections(): Promise<BeadCollection[]> {
  const db = await getDb();
  return db.getAll('collections');
}

export async function getCollection(id: string): Promise<BeadCollection | undefined> {
  const db = await getDb();
  return db.get('collections', id);
}

export async function saveCollection(collection: BeadCollection): Promise<void> {
  const db = await getDb();
  await db.put('collections', collection);
}

/** The built-in Hama/Perler palettes can't be deleted (they can still be edited, renamed or duplicated). */
export function isProtectedCollection(id: string): boolean {
  return id === HAMA_PRESET_COLLECTION_ID || id === PERLER_PRESET_COLLECTION_ID;
}

export async function deleteCollection(id: string): Promise<void> {
  if (isProtectedCollection(id)) return;
  const db = await getDb();
  await db.delete('collections', id);
}

export async function duplicateCollection(id: string): Promise<BeadCollection | undefined> {
  const original = await getCollection(id);
  if (!original) return undefined;
  const copy: BeadCollection = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} copy`,
    createdAt: Date.now(),
  };
  await saveCollection(copy);
  return copy;
}

export async function createCollection(name: string): Promise<BeadCollection> {
  const collection: BeadCollection = { id: crypto.randomUUID(), name, beads: [], createdAt: Date.now() };
  await saveCollection(collection);
  return collection;
}

export async function listPatterns(): Promise<Pattern[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('patterns', 'by-updatedAt');
  return all.reverse(); // most recently updated first
}

export async function getPattern(id: string): Promise<Pattern | undefined> {
  const db = await getDb();
  return db.get('patterns', id);
}

/** Snapshots every non-catalog bead the pattern uses (see Pattern.customBeads), hidden layers included. */
function withCustomBeads(pattern: Pattern): Pattern {
  const ids = new Set<string>();
  for (const grid of [pattern.gridData, ...(pattern.layers ?? []).map((l) => l.grid)]) {
    for (const row of grid) for (const id of row) if (id && !isCatalogBead(id)) ids.add(id);
  }
  const customBeads = [...ids].flatMap((id) => {
    const bead = beadById(id);
    return bead ? [{ id, name: bead.name, hex: bead.hex }] : [];
  });
  return { ...pattern, customBeads };
}

export async function savePattern(pattern: Pattern): Promise<void> {
  const db = await getDb();
  await db.put('patterns', withCustomBeads(pattern));
}

export async function deletePattern(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('patterns', id);
}

export async function duplicatePattern(id: string): Promise<Pattern | undefined> {
  const original = await getPattern(id);
  if (!original) return undefined;
  const copy: Pattern = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await savePattern(copy);
  return copy;
}

export async function getAllForBackup(): Promise<{ collections: BeadCollection[]; patterns: Pattern[] }> {
  const [collections, patterns] = await Promise.all([listCollections(), listPatterns()]);
  return { collections, patterns };
}

export type RestoreMode = 'add' | 'replace';

export interface RestoreCounts {
  /** New to this device and stored as-is. */
  added: number;
  /** Same id as something here but different content — stored as a "(restored)" copy, the original untouched. */
  copied: number;
  /** Already here, identical — nothing to do. */
  unchanged: number;
  /** New, but its name was already taken here — added with "(restored)" on the end so the two can be told apart. */
  renamed: number;
}

export interface RestoreResult {
  collections: RestoreCounts;
  patterns: RestoreCounts;
}

/** `name (restored)`, or `name (restored 2)`… if that's taken too. Records the result in `taken`. */
function restoredName(name: string, taken: Set<string>): string {
  let candidate = `${name} (restored)`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${name} (restored ${n})`;
  taken.add(candidate);
  return candidate;
}

function sameCollection(a: BeadCollection, b: BeadCollection): boolean {
  return a.name === b.name && JSON.stringify(a.beads) === JSON.stringify(b.beads);
}

/**
 * Restores backup data. 'add' never changes or removes anything already on
 * this device: new items are added, identical ones skipped, and conflicting
 * ones (same id, different content — e.g. "My Colors" edited on two
 * devices) come in as renamed copies — except the built-in Hama/Perler,
 * where this device's version always wins. Anything added under a name
 * already used here gets "(restored)" appended. 'replace' wipes the chosen
 * categories first, then stores the backup's. Either way only the
 * categories passed in are touched.
 */
export async function restoreBackupData(
  data: { collections?: BeadCollection[]; patterns?: Pattern[] },
  mode: RestoreMode,
): Promise<RestoreResult> {
  const db = await getDb();
  const tx = db.transaction(['collections', 'patterns'], 'readwrite');
  const collectionStore = tx.objectStore('collections');
  const patternStore = tx.objectStore('patterns');
  const result: RestoreResult = {
    collections: { added: 0, copied: 0, unchanged: 0, renamed: 0 },
    patterns: { added: 0, copied: 0, unchanged: 0, renamed: 0 },
  };
  // Names already on this device, so an incoming item never shows up as a
  // second card with an identical name (ids differ; names alone can clash).
  const collectionNames = new Set(mode === 'add' ? (await collectionStore.getAll()).map((c) => c.name) : []);
  const patternNames = new Set(mode === 'add' ? (await patternStore.getAll()).map((p) => p.name) : []);
  // Collections that came in under a new id, so their patterns can follow.
  const collectionIdMap = new Map<string, string>();

  if (mode === 'replace') {
    if (data.collections) await collectionStore.clear();
    if (data.patterns) await patternStore.clear();
  }

  for (const incoming of data.collections ?? []) {
    const existing = mode === 'add' ? await collectionStore.get(incoming.id) : undefined;
    if (!existing) {
      if (collectionNames.has(incoming.name)) {
        await collectionStore.put({ ...incoming, name: restoredName(incoming.name, collectionNames) });
        result.collections.renamed++;
      } else {
        await collectionStore.put(incoming);
      }
      result.collections.added++;
    } else if (sameCollection(existing, incoming) || isProtectedCollection(incoming.id)) {
      // Built-in palettes are never duplicated: this device's version wins.
      result.collections.unchanged++;
    } else {
      const copy = { ...incoming, id: crypto.randomUUID(), name: restoredName(incoming.name, collectionNames) };
      collectionIdMap.set(incoming.id, copy.id);
      await collectionStore.put(copy);
      result.collections.copied++;
    }
  }

  for (const raw of data.patterns ?? []) {
    const mappedCollection = raw.collectionId ? collectionIdMap.get(raw.collectionId) : undefined;
    const incoming = mappedCollection ? { ...raw, collectionId: mappedCollection } : raw;
    const existing = mode === 'add' ? await patternStore.get(incoming.id) : undefined;
    if (!existing) {
      if (patternNames.has(incoming.name)) {
        await patternStore.put({ ...incoming, name: restoredName(incoming.name, patternNames) });
        result.patterns.renamed++;
      } else {
        await patternStore.put(incoming);
      }
      result.patterns.added++;
    } else if (existing.updatedAt === incoming.updatedAt) {
      result.patterns.unchanged++;
    } else {
      await patternStore.put({ ...incoming, id: crypto.randomUUID(), name: restoredName(incoming.name, patternNames) });
      result.patterns.copied++;
    }
  }

  // Replacing collections must not lose the built-in palettes.
  if (mode === 'replace' && data.collections) {
    const now = Date.now();
    const presets: BeadCollection[] = [
      { id: HAMA_PRESET_COLLECTION_ID, name: 'Hama', beads: HAMA_PRESET_BEADS.map(({ id, name, hex }) => ({ id, name, hex })), createdAt: now },
      { id: PERLER_PRESET_COLLECTION_ID, name: 'Perler', beads: PERLER_PRESET_BEADS.map(({ id, name, hex }) => ({ id, name, hex })), createdAt: now },
    ];
    for (const preset of presets) {
      if (!(await collectionStore.get(preset.id))) await collectionStore.put(preset);
    }
  }

  await tx.done;
  return result;
}
