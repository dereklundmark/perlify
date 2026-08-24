import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { listPatterns, deletePattern, duplicatePattern, savePattern } from '../../db/db';
import { exportBackup, importBackup } from '../../lib/backup';
import { gridStats } from '../../lib/grid';
import { PillButton } from '../ui/PillButton';
import { MenuDots } from '../ui/MenuDots';
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
    dispatch({ type: 'library/loaded', patterns, collections: state.collections });
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
    <div className="screen screen--yellow">
      <div className="screen__body library__body">
        <div className="library__header">
          <h1 className="type-headline">
            MY
            <br />
            PATTERNS
          </h1>
          <div className="library__count-badge">{state.patterns.length}</div>
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
      <rect x="1.25" y="1.25" width="229.5" height="229.5" rx="12" fill="#efece4" stroke="#12100c" strokeWidth="2.5" />
      <g fill="none" stroke="rgba(18,16,12,0.17)" strokeWidth="1.4">
        {dots}
      </g>
    </svg>
  );
}
