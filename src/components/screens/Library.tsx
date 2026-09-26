import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { listPatterns, deletePattern, duplicatePattern, savePattern } from '../../db/db';
import { exportBackup, getLastBackupAt, importBackup } from '../../lib/backup';
import { gridStats, patternGrid } from '../../lib/grid';
import { PillButton } from '../ui/PillButton';
import { MenuDots } from '../ui/MenuDots';
import { PatternThumbnail } from '../PatternThumbnail';
import type { Pattern } from '../../db/schema';
import './Library.css';

const APP_VERSION_LABEL = `v${__APP_VERSION__} · ${__APP_BUILD__} · ${__APP_BUILT_ON__}`;

export function Library() {
  const { state, dispatch } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(() => getLastBackupAt());

  async function refresh() {
    const patterns = await listPatterns();
    dispatch({ type: 'library/loaded', patterns, collections: state.collections });
  }

  async function handleBackup() {
    const savedAt = await exportBackup();
    if (savedAt !== null) setLastBackupAt(savedAt);
  }

  async function handleImportFile(file: File) {
    try {
      const result = await importBackup(file);
      setImportMessage(`Restored ${result.patterns} pattern(s) and ${result.collections} collection(s).`);
      await refresh();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Import failed.');
    }
  }

  async function handleDuplicate(pattern: Pattern) {
    await duplicatePattern(pattern.id);
    setOpenMenuId(null);
    await refresh();
  }

  async function handleRename(pattern: Pattern) {
    const name = window.prompt('Rename pattern', pattern.name);
    setOpenMenuId(null);
    if (!name || !name.trim()) return;
    await savePattern({ ...pattern, name: name.trim(), updatedAt: Date.now() });
    await refresh();
  }

  async function handleDelete(pattern: Pattern) {
    setOpenMenuId(null);
    if (!window.confirm(`Delete "${pattern.name}"? This can't be undone.`)) return;
    await deletePattern(pattern.id);
    await refresh();
  }

  function openPattern(pattern: Pattern) {
    dispatch({ type: 'draft/open', pattern });
  }

  function startNew() {
    dispatch({ type: 'draft/start' });
  }

  if (state.libraryLoading) {
    return <div className="screen screen--yellow" />;
  }

  if (state.patterns.length === 0) {
    return (
      <div className="screen screen--yellow library-first-run">
        <div className="screen__body library-first-run__body">
          <h1 className="type-headline type-headline--shelf">PERLIFY</h1>
          <div className="library-first-run__pegboard" aria-hidden>
            <PegboardIcon />
          </div>
          <p className="type-body">Turn any photo into a bead blueprint sized to your own pegboard.</p>
          <ol className="library-first-run__steps">
            <li>
              <span className="library-first-run__index">1</span>
              <span className="type-body">Pick a photo and perlify it</span>
            </li>
            <li>
              <span className="library-first-run__index">2</span>
              <span className="type-body">Set your board size and bead type</span>
            </li>
            <li>
              <span className="library-first-run__index">3</span>
              <span className="type-body">Print it and start beading</span>
            </li>
          </ol>
        </div>
        <div className="library__cta">
          <PillButton onClick={startNew} style={{ width: '100%' }}>
            START NEW PATTERN
          </PillButton>
          <div className="library__secondary-links">
            <button type="button" className="library__link" onClick={() => dispatch({ type: 'nav', screen: 'collections' })}>
              MY BEAD COLORS
            </button>
            <button type="button" className="library__link" onClick={() => fileInputRef.current?.click()}>
              RESTORE FROM BACKUP
            </button>
          </div>
          {importMessage && <p className="type-meta library__import-message">{importMessage}</p>}
          <p className="type-meta library__version">{APP_VERSION_LABEL}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  // Flag a backup as out of date when any design was saved after it, so the
  // reminder is about actual unprotected work rather than just elapsed time.
  const newestEdit = state.patterns.reduce((max, p) => Math.max(max, p.updatedAt), 0);
  const backupStale = lastBackupAt === null || newestEdit > lastBackupAt;
  const backupStatus =
    lastBackupAt === null
      ? 'Never backed up'
      : `Last backed up ${new Date(lastBackupAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${
          backupStale ? ' · newer changes not included' : ''
        }`;

  return (
    <div className="screen screen--yellow">
      <div className="screen__body library__body">
        <div className="library__header">
          <div className="library__brand-row">
            <div className="library__brand-icon" aria-hidden>
              <PegboardIcon />
            </div>
            <span className="library__brand-word">PERLIFY</span>
          </div>
          <h1 className="type-headline">
            MY
            <br />
            PATTERNS
          </h1>
        </div>

        <div className="library__grid">
          {state.patterns.map((pattern) => {
            const flat = patternGrid(pattern);
            const stats = gridStats(flat);
            return (
              <div key={pattern.id} className="pattern-card">
                <button type="button" className="pattern-card__thumb-wrap" onClick={() => openPattern(pattern)}>
                  <PatternThumbnail grid={flat} size={160} />
                </button>
                <div className="pattern-card__meta-row">
                  <div>
                    <div className="pattern-card__name">{pattern.name}</div>
                    <div className="pattern-card__meta">
                      {pattern.boardConfig.widthPegs}×{pattern.boardConfig.heightPegs} · {stats.colorCount} COLORS
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pattern-card__menu-btn"
                    onClick={() => setOpenMenuId(openMenuId === pattern.id ? null : pattern.id)}
                    aria-label="Pattern options"
                  >
                    <MenuDots />
                  </button>
                </div>
                {openMenuId === pattern.id && (
                  <div className="pattern-card__menu">
                    <button type="button" onClick={() => handleDuplicate(pattern)}>
                      Duplicate
                    </button>
                    <button type="button" onClick={() => handleRename(pattern)}>
                      Rename
                    </button>
                    <button type="button" className="pattern-card__menu-danger" onClick={() => handleDelete(pattern)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="pattern-card pattern-card--new" onClick={startNew}>
            <span className="pattern-card__new-circle">+</span>
            <span className="pattern-card__new-label">NEW</span>
          </button>
        </div>
      </div>

      <div className="library__cta">
        <PillButton onClick={startNew} style={{ width: '100%' }}>
          START NEW PATTERN
        </PillButton>
        <div className="library__secondary-links">
          <button type="button" className="library__link" onClick={() => dispatch({ type: 'nav', screen: 'collections' })}>
            MY BEAD COLORS
          </button>
          <button type="button" className="library__link" onClick={handleBackup}>
            BACK UP
          </button>
          <button type="button" className="library__link" onClick={() => fileInputRef.current?.click()}>
            RESTORE
          </button>
        </div>
        {importMessage && <p className="type-meta library__import-message">{importMessage}</p>}
        <p className={`type-meta library__backup-status${backupStale ? ' library__backup-status--stale' : ''}`}>
          {backupStatus}
        </p>
        <p className="type-meta library__version">{APP_VERSION_LABEL}</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// The white tile with the same 3x3 grid of big black dots as the app's
// home-screen icon (public/icons).
function PegboardIcon() {
  const centers = [63.5, 116, 168.5];
  return (
    <svg viewBox="0 0 232 232" width="100%" height="100%">
      <rect x="1.25" y="1.25" width="229.5" height="229.5" rx="12" fill="#efece4" stroke="#12100c" strokeWidth="2.5" />
      <g fill="#12100c">
        {centers.flatMap((cy) => centers.map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={18} />))}
      </g>
    </svg>
  );
}
