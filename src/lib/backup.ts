import { getAllForBackup, importBackupData } from '../db/db';
import type { BeadCollection, Pattern } from '../db/schema';
import { shareOrDownloadBlob } from './save';

const BACKUP_VERSION = 1;

interface BackupFile {
  version: number;
  exportedAt: number;
  collections: BeadCollection[];
  patterns: Pattern[];
}

export async function exportBackup(): Promise<void> {
  const { collections, patterns } = await getAllForBackup();
  const payload: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    collections,
    patterns,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  await shareOrDownloadBlob(blob, `perlify-backup-${date}.json`);
}

export async function exportPatternJson(pattern: Pattern): Promise<void> {
  const blob = new Blob([JSON.stringify(pattern, null, 2)], { type: 'application/json' });
  const safeName = pattern.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pattern';
  await shareOrDownloadBlob(blob, `${safeName}.json`);
}

export class BackupImportError extends Error {}

export async function importBackup(file: File): Promise<{ collections: number; patterns: number }> {
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

  await importBackupData({ collections: data.collections, patterns: data.patterns });
  return { collections: data.collections.length, patterns: data.patterns.length };
}
