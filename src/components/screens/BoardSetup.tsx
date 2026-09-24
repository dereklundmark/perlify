import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { NumberField } from '../ui/NumberField';
import { UnitChip } from '../ui/UnitChip';
import { CalibrateSheet } from './CalibrateSheet';
import { PegboardCropSheet } from './PegboardCropSheet';
import { useLiveMatch } from '../../hooks/useLiveMatch';
import { computeCoverCrop } from '../../lib/crop';
import { pegsToUnit, pitchMm, unitToPegs, type BoardUnit } from '../../lib/board';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { gridStats } from '../../lib/grid';
import { savePattern } from '../../db/db';
import type { BeadType, BoardConfig, CropRect } from '../../db/schema';
import './BoardSetup.css';

const UNIT_CYCLE: BoardUnit[] = ['pegs', 'in', 'cm'];
const GRID_DISPLAY_SIZE = 336; // matches the Adjust screen's live preview

/**
 * Board size / bead type / pattern name — comes right after Photo, before
 * Colors, so the board's real physical shape is locked in first and color
 * tuning never gets disturbed by a later board-size change. Keeps its own
 * live preview (not just the form) because changing board size here
 * re-matches the grid — without a visible result, you'd have to jump to
 * Colors every time just to see what changed.
 */
export function BoardSetup() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [unit, setUnit] = useState<BoardUnit>('pegs');
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [pegboardCropOpen, setPegboardCropOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgEl = useLiveMatch();

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
      symbolOverlay: false,
      surface: 'light',
      background: '#ffffff',
      boardsWide: draft.boardConfig.boardsWide,
      boardsHigh: draft.boardConfig.boardsHigh,
      seamLines: draft.seamLines,
    });
  }, [draft]);

  // Sample-then-stretch would otherwise distort the pattern whenever the
  // board's aspect ratio doesn't match the crop's — re-fit to a centered,
  // non-distorting crop matching the current board shape any time the two
  // stop matching, not just the first time. Board width/height can be
  // edited independently (there's no coupling between the two fields), so
  // a later single-dimension edit needs this to re-fire too, or the old
  // crop gets sampled into the new, differently-shaped grid and stretches.
  // This does mean a manual Pegboard Crop framing gets replaced by a fresh
  // centered fit if the board's aspect changes again afterward — reopen
  // Pegboard Crop to reframe.
  useEffect(() => {
    if (!draft || !imgEl) return;
    const imageAspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const boardAspect = draft.boardConfig.widthPegs / draft.boardConfig.heightPegs;
    const { width, height } = draft.cropRect;
    const currentVisualAspect = (width / height) * imageAspect;
    // Skip once the crop already matches — computeCoverCrop's own result
    // satisfies this exactly, so this is what stops the effect from
    // re-dispatching on its own write forever.
    if (Math.abs(currentVisualAspect - boardAspect) < 1e-4) return;
    const next = computeCoverCrop(imageAspect, boardAspect);
    dispatch({ type: 'draft/update', patch: { cropRect: next } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.boardConfig.widthPegs, draft?.boardConfig.heightPegs, imgEl, draft?.cropRect]);

  if (!draft) return null;

  const { boardConfig } = draft;
  const override = boardConfig.pegsPerInchOverride;
  const stats = gridStats(draft.gridData);

  function applyPegboardCrop(newCropRect: CropRect) {
    dispatch({ type: 'draft/update', patch: { cropRect: newCropRect } });
    setPegboardCropOpen(false);
  }

  function updateBoard(patch: Partial<BoardConfig>) {
    if (!draft) return;
    dispatch({ type: 'draft/update', patch: { boardConfig: { ...draft.boardConfig, ...patch } } });
  }

  function cycleUnit() {
    setUnit(UNIT_CYCLE[(UNIT_CYCLE.indexOf(unit) + 1) % UNIT_CYCLE.length]);
  }

  function handleWidth(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    updateBoard({ widthPegs: unitToPegs(n, unit, boardConfig.beadType, override) });
  }

  function handleHeight(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    updateBoard({ heightPegs: unitToPegs(n, unit, boardConfig.beadType, override) });
  }

  function handleBeadType(type: BeadType) {
    updateBoard({ beadType: type, pegsPerInchOverride: undefined });
  }

  function goToAdjust() {
    dispatch({ type: 'nav', screen: 'adjust' });
  }

  async function goToLibrary() {
    if (!draft) return;
    await savePattern(draft);
    dispatch({ type: 'library/upsert', pattern: draft });
    dispatch({ type: 'nav', screen: 'library' });
  }

  const widthDisplay = pegsToUnit(boardConfig.widthPegs, unit, boardConfig.beadType, override);
  const heightDisplay = pegsToUnit(boardConfig.heightPegs, unit, boardConfig.beadType, override);
  const widthIn = pegsToUnit(boardConfig.widthPegs, 'in', boardConfig.beadType, override);
  const heightIn = pegsToUnit(boardConfig.heightPegs, 'in', boardConfig.beadType, override);
  const conversionLabel =
    boardConfig.widthPegs === boardConfig.heightPegs
      ? `${widthIn.toFixed(1)} × ${widthIn.toFixed(1)} in`
      : `${widthIn.toFixed(1)} × ${heightIn.toFixed(1)} in`;

  return (
    <div className="screen screen--cream">
      <WizardBar
        left={
          <>
            <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'photo' })}>
              BACK
            </button>
            <button type="button" className="adjust__home-btn" aria-label="Go to library" onClick={goToLibrary}>
              ⌂
            </button>
          </>
        }
        center={<span className="adjust__title-center type-numeric">BOARD SETUP</span>}
        right={
          <button type="button" className="adjust__next-btn" onClick={goToAdjust}>
            NEXT
          </button>
        }
      />

      <div className="screen__body">
        <div className="adjust__grid-block">
          <canvas ref={canvasRef} className="adjust__canvas" />
          <div className="adjust__chips">
            <span className="adjust__chip adjust__chip--ink">{stats.beadCount} BEADS</span>
            <span className="adjust__chip adjust__chip--outline">{stats.colorCount} COLORS</span>
          </div>
        </div>

        <div className="board-setup__body">
        <div className="adjust-card">
          <div className="type-eyebrow">PATTERN NAME</div>
          <input
            className="adjust__name-input"
            value={draft.name}
            onChange={(e) => dispatch({ type: 'draft/update', patch: { name: e.target.value } })}
            placeholder="Untitled pattern"
          />
        </div>

        <div className="adjust-card">
          <div className="type-eyebrow" style={{ marginBottom: 10 }}>
            BEAD SIZE
          </div>
          <SegmentedControl
            options={[
              { value: 'regular', label: 'REGULAR' },
              { value: 'mini', label: 'MINI' },
            ]}
            value={boardConfig.beadType}
            onChange={handleBeadType}
          />
          <div className="adjust__pitch-row">
            <span className="type-meta">{pitchMm(boardConfig.beadType, override).toFixed(1)} mm pitch</span>
            <button type="button" className="adjust__link" onClick={() => setCalibrateOpen(true)}>
              CALIBRATE
            </button>
          </div>
        </div>

        <div className="adjust-card">
          <div className="adjust__board-header">
            <span className="type-eyebrow">BOARD SIZE</span>
            <span className="type-meta">{conversionLabel}</span>
          </div>
          <div className="adjust__board-fields">
            <NumberField label="WIDTH" value={round1(widthDisplay)} onChange={handleWidth} commitOnEnter />
            <span className="adjust__times type-numeric">×</span>
            <NumberField label="HEIGHT" value={round1(heightDisplay)} onChange={handleHeight} commitOnEnter />
            <UnitChip value={unit.toUpperCase()} onClick={cycleUnit} />
          </div>
          <div className="adjust__divider" />
          <div className="adjust__stepper-row">
            <span className="type-row-label">BOARDS</span>
            <div className="adjust__stepper">
              <button
                type="button"
                onClick={() => updateBoard({ boardsWide: Math.max(1, boardConfig.boardsWide - 1) })}
              >
                −
              </button>
              <span className="type-numeric">
                {boardConfig.boardsWide}×{boardConfig.boardsHigh}
              </span>
              <button
                type="button"
                onClick={() => updateBoard({ boardsWide: Math.min(4, boardConfig.boardsWide + 1) })}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="adjust-card">
          <div className="adjust__stepper-row">
            <span className="type-row-label">PEGBOARD CROP</span>
            <button type="button" className="adjust__link" onClick={() => setPegboardCropOpen(true)}>
              FIT TO BOARD ›
            </button>
          </div>
        </div>
        </div>
      </div>

      {calibrateOpen && (
        <CalibrateSheet
          beadType={boardConfig.beadType}
          onApply={(ppin) => updateBoard({ pegsPerInchOverride: ppin })}
          onClose={() => setCalibrateOpen(false)}
        />
      )}

      {pegboardCropOpen && draft.sourceImage && (
        <PegboardCropSheet
          sourceImage={draft.sourceImage}
          cropRect={draft.cropRect}
          boardAspect={boardConfig.widthPegs / boardConfig.heightPegs}
          onApply={applyPegboardCrop}
          onClose={() => setPegboardCropOpen(false)}
        />
      )}
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
