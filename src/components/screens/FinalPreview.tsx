import { useEffect, useRef } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Toggle } from '../ui/Toggle';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { savePattern } from '../../db/db';
import type { Pattern } from '../../db/schema';
import './FinalPreview.css';

const GRID_DISPLAY_SIZE = 300;

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
      surface: draft.previewBackground === 'white' ? 'light' : 'dark',
      background: draft.previewBackground === 'white' ? '#ffffff' : '#000000',
    });
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
    <div className="screen screen--dark preview__screen">
      <WizardBar
        variant="dark"
        step={4}
        left={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'adjust' })}>
            Back
          </button>
        }
        right={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'export' })}>
            Export
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
            <SegmentedControl
              variant="dark"
              options={[
                { value: 'white', label: 'White' },
                { value: 'black', label: 'Black' },
              ]}
              value={draft.previewBackground}
              onChange={(v) => persist({ previewBackground: v })}
            />
          </div>

          <div className="preview__row">
            <div>
              <div className="type-row-label">Symbol overlay</div>
              <div className="type-caption preview__caption">Letter per color — for B&W printing</div>
            </div>
            <Toggle variant="dark" checked={draft.symbolOverlay} onChange={(v) => persist({ symbolOverlay: v })} />
          </div>

          <div className="preview__row">
            <div>
              <div className="type-row-label">Gridlines</div>
              <div className="type-caption preview__caption">Off shows the finished piece as beaded</div>
            </div>
            <Toggle variant="dark" checked={draft.gridlines} onChange={(v) => persist({ gridlines: v })} />
          </div>

          <p className="type-caption preview__footnote">Display only — toggling these never changes a bead.</p>
        </div>
      </div>
    </div>
  );
}
