import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { listPatterns, deletePattern, duplicatePattern, savePattern } from '../../db/db';
import { exportBackup, importBackup } from '../../lib/backup';
import { gridStats } from '../../lib/grid';
import { PillButton } from '../ui/PillButton';
import { PatternThumbnail } from '../PatternThumbnail';
import type { Pattern } from '../../db/schema';
import './Library.css';

export function Library() {
  const { state, dispatch } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function refresh() {
    const patterns = await listPatterns();
    if (state.collection) dispatch({ type: 'library/loaded', patterns, collection: state.collection });
  }

  async function handleBackup() {
    await exportBackup();
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
    return <div className="screen screen--light" />;
  }

  if (state.patterns.length === 0) {
    return (
      <div className="screen screen--light library-first-run">
        <div className="screen__body library-first-run__body">
          <h1 className="type-screen-title">Nothing yet</h1>
          <div className="library-first-run__pegboard" aria-hidden>
            <PegboardIcon />
          </div>
          <p className="type-body library-first-run__pitch">
            Turn any photo into a bead blueprint sized to your own pegboard. Everything happens on this phone — no
            account, no upload.
          </p>
          <ol className="library-first-run__steps">
            <li>
              <span className="type-mono library-first-run__index">01</span>
              <span className="type-body">Set your board size and bead type</span>
            </li>
            <li>
              <span className="type-mono library-first-run__index">02</span>
              <span className="type-body">Pick a photo and perlify it</span>
            </li>
            <li>
              <span className="type-mono library-first-run__index">03</span>
              <span className="type-body">Print the blueprint and start beading</span>
            </li>
          </ol>
        </div>
        <div className="library__cta">
          <PillButton onClick={startNew} style={{ width: '100%' }}>
            Start new pattern
          </PillButton>
          <div className="library-first-run__secondary">
            <button type="button" className="library__link" onClick={() => fileInputRef.current?.click()}>
              Restore from backup
            </button>
            <span className="library-first-run__divider" />
            <span className="type-mono library-first-run__hint">ADD TO HOME SCREEN</span>
          </div>
          {importMessage && <p className="type-caption library__import-message">{importMessage}</p>}
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

  return (
    <div className="screen screen--light">
      <div className="screen__body library__body">
        <div className="library__header">
          <div>
            <div className="type-eyebrow">MY PATTERNS</div>
            <h1 className="type-screen-title">{state.patterns.length} saved</h1>
          </div>
          <PillButton size="sm" variant="secondary" onClick={handleBackup}>
            Back up
          </PillButton>
        </div>

        <div className="library__grid">
          {state.patterns.map((pattern) => {
            const stats = gridStats(pattern.gridData);
            return (
              <div key={pattern.id} className="pattern-card">
                <button type="button" className="pattern-card__thumb-wrap" onClick={() => openPattern(pattern)}>
                  <PatternThumbnail grid={pattern.gridData} size={160} />
                </button>
                <div className="pattern-card__meta-row">
                  <div>
                    <div className="pattern-card__name">{pattern.name}</div>
                    <div className="type-mono pattern-card__meta">
                      {pattern.boardConfig.widthPegs}×{pattern.boardConfig.heightPegs} ·{' '}
                      {pattern.boardConfig.beadType === 'regular' ? 'midi' : 'mini'} · {stats.colorCount} col
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pattern-card__menu-btn"
                    onClick={() => setOpenMenuId(openMenuId === pattern.id ? null : pattern.id)}
                    aria-label="Pattern options"
                  >
                    ⋯
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
          <div className="pattern-card pattern-card--hint">
            <span className="type-caption">Long-press a pattern to duplicate, rename or delete.</span>
          </div>
        </div>
      </div>

      <div className="library__cta">
        <PillButton onClick={startNew} style={{ width: '100%' }}>
          Start new pattern
        </PillButton>
        <button type="button" className="library__link library__restore-link" onClick={() => fileInputRef.current?.click()}>
          Restore from backup
        </button>
        {importMessage && <p className="type-caption library__import-message">{importMessage}</p>}
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

function PegboardIcon() {
  const dots = [];
  const n = 12;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      dots.push(<circle key={`${row}-${col}`} cx={10 + col * 19} cy={10 + row * 19} r={3.2} />);
    }
  }
  return (
    <svg viewBox="0 0 232 232" width="100%" height="100%">
      <rect x="0.5" y="0.5" width="231" height="231" rx="10" fill="#efece4" stroke="var(--hairline)" />
      <g fill="none" stroke="rgba(25,23,19,0.17)" strokeWidth="1.4">
        {dots}
      </g>
    </svg>
  );
}
