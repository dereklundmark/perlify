import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { PillButton } from '../ui/PillButton';
import { GroupedList, GroupedListRow } from '../ui/GroupedList';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, gridStats } from '../../lib/grid';
import { exportPatternPdf } from '../../lib/pdf';
import { exportPatternJson } from '../../lib/backup';
import './Export.css';

const GRID_DISPLAY_SIZE = 174;

export function Export() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState<'pdf' | 'json' | null>(null);

  useEffect(() => {
    if (!draft || !canvasRef.current || draft.gridData.length === 0) return;
    const cols = draft.boardConfig.widthPegs;
    const rows = draft.boardConfig.heightPegs;
    const cellSize = GRID_DISPLAY_SIZE / Math.max(cols, rows);
    const canvas = canvasRef.current;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderGrid(ctx, {
      grid: draft.gridData,
      cellSize,
      getBead: catalogBeadById,
      gridlines: draft.gridlines,
      symbolOverlay: draft.symbolOverlay,
      surface: 'dark',
      background: '#000000',
      boardsWide: draft.boardConfig.boardsWide,
      boardsHigh: draft.boardConfig.boardsHigh,
      seamLines: draft.seamLines,
    });
  }, [draft]);

  if (!draft) return null;

  const stats = gridStats(draft.gridData);
  const usage = beadUsage(draft.gridData);
  const maxCount = usage[0]?.count ?? 1;

  async function handleSavePdf() {
    if (!draft) return;
    setBusy('pdf');
    try {
      await exportPatternPdf(draft);
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveJson() {
    if (!draft) return;
    setBusy('json');
    try {
      await exportPatternJson(draft);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="screen screen--dark export__screen">
      <WizardBar
        variant="dark"
        step={5}
        left={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'preview' })}>
            Back
          </button>
        }
        right={<button type="button" onClick={() => dispatch({ type: 'draft/discard' })}>Done</button>}
      />

      <div className="export__grid-backdrop">
        <canvas ref={canvasRef} className="export__canvas" />
      </div>

      <div className="export__sheet">
        <div className="bottom-sheet__handle" />
        <h2 className="type-card-title">Export blueprint</h2>
        <div className="type-mono export__meta">
          {draft.boardConfig.boardsWide * draft.boardConfig.boardsHigh > 1
            ? `${1 + draft.boardConfig.boardsWide * draft.boardConfig.boardsHigh} PAGES`
            : '1 PAGE'}{' '}
          · A4 · 1:1 SCALE
        </div>

        <GroupedList>
          <GroupedListRow label="Include symbol overlay" value={draft.symbolOverlay ? 'ON' : 'OFF'} />
          <GroupedListRow label="Gridlines" value="EVERY CELL" />
          <GroupedListRow label="Heavier line every 10 pegs" value="ON" />
          <GroupedListRow
            label="Split across pages"
            value={draft.boardConfig.boardsWide * draft.boardConfig.boardsHigh > 1 ? 'PER BOARD' : 'AUTO'}
          />
        </GroupedList>

        <div className="export__legend-header">
          <span className="type-eyebrow">BEAD LEGEND</span>
          <span className="type-mono export__legend-total">
            {stats.beadCount} TOTAL{stats.emptyCount ? ` · ${stats.emptyCount} EMPTY` : ''}
          </span>
        </div>

        <div className="export__legend">
          {usage.map(({ beadId, count }) => {
            const bead = catalogBeadById(beadId);
            return (
              <div key={beadId} className="export__legend-row">
                <span className="export__legend-swatch" style={{ background: bead?.hex }} />
                <span className="type-mono export__legend-symbol">{bead?.symbol ?? '?'}</span>
                <span className="export__legend-name">{bead?.name ?? beadId}</span>
                <span className="export__legend-bar">
                  <span className="export__legend-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                </span>
                <span className="type-mono export__legend-count">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="export__actions">
          <PillButton onClick={handleSavePdf} disabled={busy !== null} style={{ flex: 1 }}>
            {busy === 'pdf' ? 'Saving…' : 'Save PDF'}
          </PillButton>
          <PillButton
            variant="secondary"
            onClick={handleSaveJson}
            disabled={busy !== null}
            className="export__json-button"
            aria-label="Export JSON"
          >
            JSON
          </PillButton>
        </div>
      </div>
    </div>
  );
}
