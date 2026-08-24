import { useEffect, useRef } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { Toggle } from '../ui/Toggle';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { savePattern } from '../../db/db';
import type { Pattern } from '../../db/schema';
import './FinalPreview.css';

const GRID_DISPLAY_SIZE = 320;
const CANVAS_PADDING = 20;

export function FinalPreview() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!draft || !canvasRef.current || draft.gridData.length === 0) return;
    const cols = draft.boardConfig.widthPegs;
    const rows = draft.boardConfig.heightPegs;
    const cellSize = GRID_DISPLAY_SIZE / Math.max(cols, rows);
    const canvas = canvasRef.current;
    canvas.width = cols * cellSize + CANVAS_PADDING * 2;
    canvas.height = rows * cellSize + CANVAS_PADDING * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const backgroundFill = draft.previewBackground === 'white' ? '#ffffff' : '#000000';
    // The grid itself is always fully opaque cell-to-cell, so the toggle
    // only reads as a visible change via the margin around it.
    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(CANVAS_PADDING, CANVAS_PADDING);
    renderGrid(ctx, {
      grid: draft.gridData,
      cellSize,
      getBead: catalogBeadById,
      gridlines: draft.gridlines,
      symbolOverlay: draft.symbolOverlay,
      surface: draft.previewBackground === 'white' ? 'light' : 'dark',
      background: backgroundFill,
      boardsWide: draft.boardConfig.boardsWide,
      boardsHigh: draft.boardConfig.boardsHigh,
      seamLines: draft.seamLines,
    });
    ctx.restore();
  }, [draft]);

  if (!draft) return null;

  async function persist(patch: Partial<Pattern>) {
    if (!draft) return;
    const updated: Pattern = { ...draft, ...patch, updatedAt: Date.now() };
    dispatch({ type: 'draft/update', patch });
    await savePattern(updated);
    dispatch({ type: 'library/upsert', pattern: updated });
  }

  return (
    <div className="screen screen--cream">
      <WizardBar
        step={4}
        left={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'board' })}>
            BACK
          </button>
        }
        right={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'export' })}>
            EXPORT
          </button>
        }
      />

      <div className="screen__body preview__body">
        <div className="preview__stage">
          <canvas ref={canvasRef} className="preview__canvas" />
        </div>

        <div className="preview__controls">
          <div>
            <div className="type-eyebrow preview__eyebrow">BACKGROUND BEHIND PATTERN</div>
            <div className="preview__bg-row">
              <button
                type="button"
                className={`preview__bg-pill${draft.previewBackground === 'white' ? ' preview__bg-pill--active' : ''}`}
                onClick={() => persist({ previewBackground: 'white' })}
              >
                <span className="preview__bg-chip" style={{ background: '#fff' }} />
                WHITE
              </button>
              <button
                type="button"
                className={`preview__bg-pill${draft.previewBackground === 'black' ? ' preview__bg-pill--active' : ''}`}
                onClick={() => persist({ previewBackground: 'black' })}
              >
                <span className="preview__bg-chip" style={{ background: '#000' }} />
                BLACK
              </button>
            </div>
          </div>

          <div className="preview__row">
            <div>
              <div className="type-row-label">SYMBOL OVERLAY</div>
              <div className="type-meta">For B&W printing</div>
            </div>
            <Toggle checked={draft.symbolOverlay} onChange={(v) => persist({ symbolOverlay: v })} />
          </div>

          <div className="preview__row">
            <div>
              <div className="type-row-label">GRIDLINES</div>
              <div className="type-meta">Off = as beaded</div>
            </div>
            <Toggle checked={draft.gridlines} onChange={(v) => persist({ gridlines: v })} />
          </div>

          {draft.boardConfig.boardsWide * draft.boardConfig.boardsHigh > 1 && (
            <div className="preview__row">
              <div>
                <div className="type-row-label">SEAM LINES</div>
                <div className="type-meta">Marks where boards meet</div>
              </div>
              <Toggle checked={draft.seamLines} onChange={(v) => persist({ seamLines: v })} />
            </div>
          )}

          <p className="type-body preview__footnote">Display only — toggling these never changes a bead.</p>
        </div>
      </div>
    </div>
  );
}
