import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type BeadCollection, type Pattern } from './schema';
import { DEFAULT_OWNED_BEADS, HAMA_PRESET_BEADS, PERLER_PRESET_BEADS } from '../lib/catalog';

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

async function ensureCollection(id: string, name: string, beads: BeadCollection['beads']): Promise<BeadCollection> {
  const db = await getDb();
  const existing = await db.get('collections', id);
  if (existing) return existing;
  const seeded: BeadCollection = { id, name, beads, createdAt: Date.now() };
  await db.put('collections', seeded);
  return seeded;
}

export async function ensureDefaultCollection(): Promise<BeadCollection> {
  return ensureCollection(
    DEFAULT_COLLECTION_ID,
    'My Colors',
    DEFAULT_OWNED_BEADS.map(({ id, name, hex }) => ({ id, name, hex })),
  );
}

/** Two preset starting palettes for trying design variations fast — see catalog.ts. */
export async function ensurePresetCollections(): Promise<void> {
  await Promise.all([
    ensureCollection(HAMA_PRESET_COLLECTION_ID, 'Hama', HAMA_PRESET_BEADS.map(({ id, name, hex }) => ({ id, name, hex }))),
    ensureCollection(
      PERLER_PRESET_COLLECTION_ID,
      'Perler',
      PERLER_PRESET_BEADS.map(({ id, name, hex }) => ({ id, name, hex })),
    ),
  ]);
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

export async function deleteCollection(id: string): Promise<void> {
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

export async function savePattern(pattern: Pattern): Promise<void> {
  const db = await getDb();
  await db.put('patterns', pattern);
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

export async function importBackupData(data: { collections: BeadCollection[]; patterns: Pattern[] }): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['collections', 'patterns'], 'readwrite');
  await Promise.all([
    ...data.collections.map((c) => tx.objectStore('collections').put(c)),
    ...data.patterns.map((p) => tx.objectStore('patterns').put(p)),
  ]);
  await tx.done;
}
