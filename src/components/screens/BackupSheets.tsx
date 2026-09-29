import { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Toggle } from '../ui/Toggle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { BackupContents, BackupFile } from '../../lib/backup';
import type { RestoreMode } from '../../db/db';
import './BackupSheets.css';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

interface ContentsTogglesProps {
  value: BackupContents;
  onChange: (value: BackupContents) => void;
  collectionCount: number;
  patternCount: number;
}

function ContentsToggles({ value, onChange, collectionCount, patternCount }: ContentsTogglesProps) {
  return (
    <div className="backup-sheet__rows">
      <div className="backup-sheet__row">
        <div>
          <div className="type-row-label">BEAD COLLECTIONS</div>
          <div className="type-meta">{plural(collectionCount, 'collection')}</div>
        </div>
        <Toggle
          label="Include bead collections"
          checked={value.collections && collectionCount > 0}
          onChange={(v) => onChange({ ...value, collections: v })}
        />
      </div>
      <div className="backup-sheet__row">
        <div>
          <div className="type-row-label">DESIGNS</div>
          <div className="type-meta">{plural(patternCount, 'design')}</div>
        </div>
        <Toggle
          label="Include designs"
          checked={value.patterns && patternCount > 0}
          onChange={(v) => onChange({ ...value, patterns: v })}
        />
      </div>
    </div>
  );
}

interface BackupSheetProps {
  collectionCount: number;
  patternCount: number;
  onBackup: (contents: BackupContents) => void;
  onClose: () => void;
}

export function BackupSheet({ collectionCount, patternCount, onBackup, onClose }: BackupSheetProps) {
  const [contents, setContents] = useState<BackupContents>({ collections: true, patterns: true });
  const effective = {
    collections: contents.collections && collectionCount > 0,
    patterns: contents.patterns && patternCount > 0,
  };
  const nothing = !effective.collections && !effective.patterns;

  return (
    <BottomSheet variant="white" modal onBackdropClick={onClose}>
      <div className="backup-sheet">
        <div className="backup-sheet__head">
          <h2 className="backup-sheet__title">BACK UP</h2>
          <button type="button" className="backup-sheet__cancel" onClick={onClose}>
            CANCEL
          </button>
        </div>
        <p className="type-body backup-sheet__note">Choose what goes in the backup file.</p>
        <ContentsToggles
          value={contents}
          onChange={setContents}
          collectionCount={collectionCount}
          patternCount={patternCount}
        />
        <button type="button" className="backup-sheet__primary" disabled={nothing} onClick={() => onBackup(effective)}>
          SAVE BACKUP
        </button>
      </div>
    </BottomSheet>
  );
}

interface RestoreSheetProps {
  backup: BackupFile;
  /** What's on this device now — shown in the replace warning. */
  deviceCollectionCount: number;
  devicePatternCount: number;
  onRestore: (contents: BackupContents, mode: RestoreMode) => void;
  onClose: () => void;
}

export function RestoreSheet({ backup, deviceCollectionCount, devicePatternCount, onRestore, onClose }: RestoreSheetProps) {
  const [contents, setContents] = useState<BackupContents>({ collections: true, patterns: true });
  const [mode, setMode] = useState<RestoreMode>('add');
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const effective = {
    collections: contents.collections && backup.collections.length > 0,
    patterns: contents.patterns && backup.patterns.length > 0,
  };
  const nothing = !effective.collections && !effective.patterns;
  const madeOn = new Date(backup.exportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const wiped: string[] = [];
  if (effective.collections) wiped.push(plural(deviceCollectionCount, 'bead collection'));
  if (effective.patterns) wiped.push(plural(devicePatternCount, 'design'));

  if (confirmingReplace) {
    return (
      <ConfirmDialog
        title="Replace on this device?"
        confirmLabel="REPLACE"
        tone="danger"
        onConfirm={() => onRestore(effective, 'replace')}
        onCancel={() => setConfirmingReplace(false)}
      >
        <p>
          This permanently deletes the {wiped.join(' and ')} on this device and puts the backup's in their place. It
          can't be undone.
        </p>
        <p>To keep what's here and just bring in what's missing, go back and pick ADD TO EXISTING.</p>
      </ConfirmDialog>
    );
  }

  return (
    <BottomSheet variant="white" modal onBackdropClick={onClose}>
      <div className="backup-sheet">
        <div className="backup-sheet__head">
          <h2 className="backup-sheet__title">RESTORE</h2>
          <button type="button" className="backup-sheet__cancel" onClick={onClose}>
            CANCEL
          </button>
        </div>
        <p className="type-body backup-sheet__note">Backup from {madeOn}. Choose what to bring in:</p>
        <ContentsToggles
          value={contents}
          onChange={setContents}
          collectionCount={backup.collections.length}
          patternCount={backup.patterns.length}
        />
        <SegmentedControl
          size="compact"
          options={[
            { value: 'add', label: 'ADD TO EXISTING' },
            { value: 'replace', label: 'REPLACE' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <p className="type-meta backup-sheet__mode-note">
          {mode === 'add'
            ? "Keeps everything already on this device. Anything new is added; if the backup has a different version of something you already have, it comes in as a \"(restored)\" copy."
            : 'Deletes what is on this device for the chosen items, then restores the backup in its place.'}
        </p>
        <button
          type="button"
          className={`backup-sheet__primary${mode === 'replace' ? ' backup-sheet__primary--danger' : ''}`}
          disabled={nothing}
          onClick={() => (mode === 'replace' ? setConfirmingReplace(true) : onRestore(effective, 'add'))}
        >
          {mode === 'replace' ? 'REPLACE…' : 'ADD TO THIS DEVICE'}
        </button>
      </div>
    </BottomSheet>
  );
}
