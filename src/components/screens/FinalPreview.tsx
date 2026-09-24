import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { Toggle } from '../ui/Toggle';
import { PillButton } from '../ui/PillButton';
import { RulerStage, useRulerLayout } from '../ui/RulerStage';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { savePattern, duplicatePattern } from '../../db/db';
import type { Pattern } from '../../db/schema';
import './FinalPreview.css';

export function FinalPreview() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copySaved, setCopySaved] = useState(false);
  // Same sizing + rulers as the Adjust screen, so the pattern doesn't
  // change scale between the two.
  const rulerLayout = useRulerLayout(draft?.boardConfig.widthPegs ?? 1, draft?.boardConfig.heightPegs ?? 1);
  const { cellSize, canvasW, canvasH } = rulerLayout;

  useEffect(() => {
    if (!draft || !canvasRef.current || draft.gridData.length === 0) return;
    const canvas = canvasRef.current;
    canvas.width = canvasW;
    canvas.height = canvasH;
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
  }, [draft, cellSize, canvasW, canvasH]);

  if (!draft) return null;

  async function persist(patch: Partial<Pattern>) {
    if (!draft) return;
    const updated: Pattern = { ...draft, ...patch, updatedAt: Date.now() };
    dispatch({ type: 'draft/update', patch });
    await savePattern(updated);
    dispatch({ type: 'library/upsert', pattern: updated });
  }

  // Snapshots the design as-is under a new id, so going back to make
  // different edits can never lose this version — it stays in the
  // library as its own pattern regardless of what happens to the draft.
  async function saveCopy() {
    if (!draft) return;
    await savePattern(draft);
    const copy = await duplicatePattern(draft.id);
    if (!copy) return;
    dispatch({ type: 'library/upsert', pattern: copy });
    setCopySaved(true);
    window.setTimeout(() => setCopySaved(false), 1800);
  }

  async function goToLibrary() {
    if (!draft) return;
    await savePattern(draft);
    dispatch({ type: 'library/upsert', pattern: draft });
    dispatch({ type: 'nav', screen: 'library' });
  }

  return (
    <div className="screen screen--cream preview__screen">
      <WizardBar
        step={4}
        left={
          <>
            <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'adjust' })}>
              BACK
            </button>
            <button type="button" className="preview__home-btn" aria-label="Go to library" onClick={goToLibrary}>
              ⌂
            </button>
          </>
        }
        right={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'export' })}>
            EXPORT
          </button>
        }
      />

      <div className="preview__stage">
        <RulerStage layout={rulerLayout} canvasRef={canvasRef} />
      </div>

      <div className="preview__body">
        <div className="preview__controls">
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

          <PillButton variant="secondary" onClick={saveCopy}>
            {copySaved ? 'COPY SAVED ✓' : 'SAVE A COPY'}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
