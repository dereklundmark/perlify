import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { PillButton } from '../ui/PillButton';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, gridStats } from '../../lib/grid';
import { exportPatternPdf } from '../../lib/pdf';
import './Export.css';

const GRID_DISPLAY_SIZE = 150;

export function Export() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

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
      surface: 'light',
      background: '#ffffff',
      boardsWide: draft.boardConfig.boardsWide,
      boardsHigh: draft.boardConfig.boardsHigh,
      seamLines: draft.seamLines,
    });
  }, [draft]);

  if (!draft) return null;

  const stats = gridStats(draft.gridData);
  const usage = beadUsage(draft.gridData);
  const maxCount = usage[0]?.count ?? 1;
  const pageCount =
    draft.boardConfig.boardsWide * draft.boardConfig.boardsHigh > 1
      ? 1 + draft.boardConfig.boardsWide * draft.boardConfig.boardsHigh
      : 1;

  async function handlePrint() {
    if (!draft) return;
    setBusy(true);
    try {
      await exportPatternPdf(draft);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen--yellow export__screen">
      <WizardBar
        step={4}
        left={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'preview' })}>
            BACK
          </button>
        }
        right={
          <button type="button" onClick={() => dispatch({ type: 'draft/discard' })}>
            DONE
          </button>
        }
      />

      <div className="export__grid-backdrop">
        <canvas ref={canvasRef} className="export__canvas" />
      </div>

      <div className="export__sheet">
        <div className="bottom-sheet__handle" />
        <div className="export__header">
          <h2 className="type-headline">
            SHOPPING
            <br />
            LIST
          </h2>
          <span className="type-meta">
            {pageCount} PAGE{pageCount === 1 ? '' : 'S'} · A4
          </span>
        </div>

        <div className="export__legend">
          {usage.map(({ beadId, count }) => {
            const bead = catalogBeadById(beadId);
            return (
              <div key={beadId} className="export__legend-row">
                <span className="export__legend-swatch" style={{ background: bead?.hex }} />
                <span className="export__legend-name">{bead?.name ?? beadId}</span>
                <span className="export__legend-bar">
                  <span className="export__legend-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                </span>
                <span className="type-numeric export__legend-count">{count}</span>
              </div>
            );
          })}
        </div>

        <p className="type-body export__note">
          {stats.beadCount} beads{stats.emptyCount ? `, ${stats.emptyCount} empty pegs` : ''}. The printed PDF also
          carries the full legend with symbols.
        </p>

        <PillButton onClick={handlePrint} disabled={busy}>
          {busy ? 'PRINTING…' : 'PRINT BLUEPRINT'}
        </PillButton>
      </div>
    </div>
  );
}
