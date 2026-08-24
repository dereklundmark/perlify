import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { NumberField } from '../ui/NumberField';
import { UnitChip } from '../ui/UnitChip';
import { EditorLayout } from '../ui/EditorLayout';
import { CalibrateSheet } from './CalibrateSheet';
import { matchImageToGrid } from '../../lib/match';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, gridStats } from '../../lib/grid';
import { reflowCropRect } from '../../lib/crop';
import { pegsToUnit, pitchMm, unitToPegs, type BoardUnit } from '../../lib/board';
import { savePattern } from '../../db/db';
import type { BeadType, BoardConfig, Pattern } from '../../db/schema';
import './ResultAdjust.css';

const PRESETS = [8, 12, 16, 24, 32, 60];
const GRID_DISPLAY_SIZE = 261;
const DEBOUNCE_MS = 80;
const UNIT_CYCLE: BoardUnit[] = ['pegs', 'in', 'cm'];

export function ResultAdjust() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [tab, setTab] = useState<'adjust' | 'colors'>('adjust');
  const [unit, setUnit] = useState<BoardUnit>('pegs');
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const prevAspectRef = useRef<number | null>(null);
  const didInitialMatch = useRef(false);

  useEffect(() => {
    if (!draft?.sourceImage) return;
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = draft.sourceImage;
  }, [draft?.sourceImage]);

  // Reflow the crop whenever the board's peg aspect changes, so the live
  // preview always samples a sensible region of the original photo — see
  // lib/crop.ts. Skipped on first mount (whatever crop already exists —
  // from Photo, or from a previously-saved pattern — is trusted as-is).
  useEffect(() => {
    if (!draft || !imgEl) return;
    const targetAspect = draft.boardConfig.widthPegs / draft.boardConfig.heightPegs;
    if (prevAspectRef.current === null) {
      prevAspectRef.current = targetAspect;
      return;
    }
    if (prevAspectRef.current === targetAspect) return;
    prevAspectRef.current = targetAspect;
    const imageAspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const newCropRect = reflowCropRect(draft.cropRect, targetAspect / imageAspect);
    dispatch({ type: 'draft/update', patch: { cropRect: newCropRect } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgEl, draft?.boardConfig.widthPegs, draft?.boardConfig.heightPegs]);

  useEffect(() => {
    if (!draft || !imgEl) return;
    // Re-entering this screen (from Manual Edit, or reopening a saved
    // pattern) shouldn't silently re-run matching and clobber a grid that
    // already has hand edits on it — only auto-match on a genuinely fresh
    // pattern (empty grid). Any later dependency change still re-matches.
    if (!didInitialMatch.current) {
      didInitialMatch.current = true;
      if (draft.gridData.length > 0) return;
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const collectionBeads = state.collection?.beads ?? [];
      const result = matchImageToGrid({
        image: imgEl,
        cropRect: draft.cropRect,
        widthPegs: draft.boardConfig.widthPegs,
        heightPegs: draft.boardConfig.heightPegs,
        preprocess: draft.preprocessSettings,
        paletteMode: draft.paletteMode,
        colorCount: draft.colorCount,
        collectionBeads,
        dither: draft.dither,
      });
      dispatch({ type: 'draft/update', patch: { gridData: result.gridData } });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(debounceRef.current);
    // Re-run whenever anything the algorithm depends on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    imgEl,
    draft?.cropRect,
    draft?.boardConfig.widthPegs,
    draft?.boardConfig.heightPegs,
    draft?.preprocessSettings,
    draft?.paletteMode,
    draft?.colorCount,
    draft?.dither,
    state.collection,
  ]);

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

  if (!draft) return null;

  const stats = gridStats(draft.gridData);
  const usage = beadUsage(draft.gridData);
  const maxCount = usage[0]?.count ?? 1;
  const { boardConfig } = draft;
  const override = boardConfig.pegsPerInchOverride;
  const collection = state.collection;
  const isCollectionMode = draft.paletteMode === 'collection';

  function updateBoard(patch: Partial<BoardConfig>) {
    dispatch({ type: 'draft/update', patch: { boardConfig: { ...boardConfig, ...patch } } });
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

  function updatePreprocess(patch: Partial<Pattern['preprocessSettings']>) {
    if (!draft) return;
    dispatch({ type: 'draft/update', patch: { preprocessSettings: { ...draft.preprocessSettings, ...patch } } });
  }

  async function goToPreview() {
    if (!draft) return;
    await savePattern(draft);
    dispatch({ type: 'library/upsert', pattern: draft });
    dispatch({ type: 'nav', screen: 'preview' });
  }

  const widthDisplay = pegsToUnit(boardConfig.widthPegs, unit, boardConfig.beadType, override);
  const heightDisplay = pegsToUnit(boardConfig.heightPegs, unit, boardConfig.beadType, override);
  const widthIn = pegsToUnit(boardConfig.widthPegs, 'in', boardConfig.beadType, override);
  const heightIn = pegsToUnit(boardConfig.heightPegs, 'in', boardConfig.beadType, override);
  const conversionLabel =
    boardConfig.widthPegs === boardConfig.heightPegs
      ? `${widthIn.toFixed(1)} × ${widthIn.toFixed(1)} in`
      : `${widthIn.toFixed(1)} × ${heightIn.toFixed(1)} in`;

  const stage = (
    <div className="adjust__grid-block">
      <canvas ref={canvasRef} className="adjust__canvas" />
      <div className="adjust__chips">
        <span className="adjust__chip adjust__chip--ink">{stats.beadCount} BEADS</span>
        <span className="adjust__chip adjust__chip--outline">{stats.colorCount} COLORS</span>
      </div>
    </div>
  );

  const panelContent = (
    <>
      <SegmentedControl
        options={[
          { value: 'adjust', label: 'ADJUST' },
          { value: 'colors', label: 'COLORS' },
          { value: 'edit', label: 'EDIT' },
        ]}
        value={tab}
        onChange={(v) => {
          if (v === 'edit') {
            dispatch({ type: 'nav', screen: 'edit' });
          } else {
            setTab(v);
          }
        }}
      />

      {tab === 'adjust' && (
        <div className="adjust__form">
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
              <NumberField label="WIDTH" value={round1(widthDisplay)} onChange={handleWidth} />
              <span className="adjust__times type-numeric">×</span>
              <NumberField label="HEIGHT" value={round1(heightDisplay)} onChange={handleHeight} />
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

          <div className={`radio-card${!isCollectionMode ? ' radio-card--selected' : ''}`}>
            <button
              type="button"
              className="radio-card__head"
              onClick={() => dispatch({ type: 'draft/update', patch: { paletteMode: 'auto' } })}
            >
              <span className={`radio-dot${!isCollectionMode ? ' radio-dot--selected' : ''}`} />
              <span className="type-row-label">AUTO PALETTE</span>
              <span className="type-numeric adjust__count-value">{draft.colorCount}</span>
            </button>
            {!isCollectionMode && (
              <div className="adjust__auto-body">
                <Slider
                  label=""
                  value={draft.colorCount}
                  min={2}
                  max={60}
                  onChange={(v) => dispatch({ type: 'draft/update', patch: { colorCount: v } })}
                  formatValue={() => ''}
                />
                <div className="adjust__presets">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`preset-chip${draft.colorCount === p ? ' preset-chip--active' : ''}`}
                      onClick={() => dispatch({ type: 'draft/update', patch: { colorCount: p } })}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="type-body">Fewer colors read graphic and cost less; more hold gradients. Any number 2–60.</p>
              </div>
            )}
          </div>

          <div className={`radio-card radio-card--flush${isCollectionMode ? ' radio-card--selected' : ''}`}>
            <div className="radio-card__head radio-card__head--row">
              <button
                type="button"
                className="radio-card__head-select"
                onClick={() =>
                  dispatch({
                    type: 'draft/update',
                    patch: { paletteMode: 'collection', collectionId: collection?.id ?? null },
                  })
                }
              >
                <span className={`radio-dot${isCollectionMode ? ' radio-dot--selected radio-dot--filled' : ''}`} />
                <span className="type-row-label">MY COLLECTION</span>
              </button>
              <button
                type="button"
                className="adjust__link"
                onClick={() => dispatch({ type: 'nav', screen: 'collection' })}
              >
                {collection?.beads.length ?? 0} ›
              </button>
            </div>
            <div className="adjust__collection-swatch-row">
              {collection?.beads.map((bead) => (
                <span key={bead.id} className="adjust__collection-swatch" style={{ background: bead.hex }} title={bead.name} />
              ))}
            </div>
          </div>

          <div className="adjust-card">
            <Slider
              label="CONTRAST"
              value={draft.preprocessSettings.contrast}
              min={-100}
              max={100}
              fill="red"
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}`}
              onChange={(v) => updatePreprocess({ contrast: v })}
            />
          </div>

          <div className="adjust-card adjust__toggle-card">
            <div>
              <div className="type-row-label">DITHERING</div>
              <div className="type-meta">Smoother, noisier</div>
            </div>
            <Toggle checked={draft.dither} onChange={(v) => dispatch({ type: 'draft/update', patch: { dither: v } })} />
          </div>

          <div className="adjust-card adjust__toggle-card">
            <span className="type-row-label">GRIDLINES</span>
            <Toggle
              checked={draft.gridlines}
              onChange={(v) => dispatch({ type: 'draft/update', patch: { gridlines: v } })}
            />
          </div>
        </div>
      )}

      {tab === 'colors' && (
        <div className="adjust__color-list">
          {usage.length === 0 && <p className="type-body">No beads matched yet.</p>}
          {usage.map(({ beadId, count }) => {
            const bead = catalogBeadById(beadId);
            return (
              <div key={beadId} className="adjust__color-row">
                <span className="adjust__color-swatch" style={{ background: bead?.hex }} />
                <span className="adjust__color-name">{bead?.name ?? beadId}</span>
                <span className="adjust__color-bar">
                  <span className="adjust__color-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                </span>
                <span className="type-numeric adjust__color-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="screen screen--cream">
      <WizardBar
        left={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'photo' })}>
            BACK
          </button>
        }
        center={<span className="adjust__title-center type-numeric">{draft.name.toUpperCase()}</span>}
        right={
          <button type="button" className="adjust__next-btn" onClick={goToPreview}>
            NEXT
          </button>
        }
      />

      <EditorLayout stage={stage} panelContent={panelContent} />

      {calibrateOpen && (
        <CalibrateSheet
          beadType={boardConfig.beadType}
          onApply={(ppin) => updateBoard({ pegsPerInchOverride: ppin })}
          onClose={() => setCalibrateOpen(false)}
        />
      )}
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
