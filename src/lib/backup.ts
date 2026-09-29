import { getAllForBackup, restoreBackupData, type RestoreMode, type RestoreResult } from '../db/db';
import type { BeadCollection, Pattern } from '../db/schema';
import { shareOrDownloadBlob } from './save';

const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'perlify.lastBackupAt';

/** When a backup including designs was last saved from this device, or null if never. */
export function getLastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function setLastBackupAt(when: number): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(when));
  } catch {
    // Storage unavailable (private mode etc.) — the date just won't be remembered.
  }
}

export interface BackupFile {
  version: number;
  exportedAt: number;
  collections: BeadCollection[];
  patterns: Pattern[];
}

/** Which categories a backup or restore covers. */
export interface BackupContents {
  collections: boolean;
  patterns: boolean;
}

/**
 * Saves a backup of the chosen categories. Returns the time it was saved, or
 * null if the user cancelled. Only a backup that includes designs counts
 * toward "last backed up" — that status is about not losing designs.
 */
export async function exportBackup(contents: BackupContents): Promise<number | null> {
  const all = await getAllForBackup();
  const payload: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    collections: contents.collections ? all.collections : [],
    patterns: contents.patterns ? all.patterns : [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  const kind = contents.collections && contents.patterns ? 'backup' : contents.patterns ? 'designs' : 'bead-colors';
  const saved = await shareOrDownloadBlob(blob, `perlify-${kind}-${date}.json`);
  if (!saved) return null;
  const when = Date.now();
  if (contents.patterns) setLastBackupAt(when);
  return when;
}

export async function exportPatternJson(pattern: Pattern): Promise<void> {
  const blob = new Blob([JSON.stringify(pattern, null, 2)], { type: 'application/json' });
  const safeName = pattern.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pattern';
  await shareOrDownloadBlob(blob, `${safeName}.json`);
}

export class BackupImportError extends Error {}

/** Reads and validates a backup file without changing anything, so the user can choose what to restore. */
export async function readBackupFile(file: File): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new BackupImportError('That file is not valid JSON.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !Array.isArray((parsed as BackupFile).collections) ||
    !Array.isArray((parsed as BackupFile).patterns)
  ) {
    throw new BackupImportError('That file does not look like a Perlify backup.');
  }

  const data = parsed as BackupFile;
  if (data.version > BACKUP_VERSION) {
    throw new BackupImportError('This backup was made with a newer version of Perlify.');
  }
  return data;
}

export async function restoreBackup(data: BackupFile, contents: BackupContents, mode: RestoreMode): Promise<RestoreResult> {
  return restoreBackupData(
    {
      collections: contents.collections ? data.collections : undefined,
      patterns: contents.patterns ? data.patterns : undefined,
    },
    mode,
  );
}
