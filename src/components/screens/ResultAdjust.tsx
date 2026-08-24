import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { EditorLayout } from '../ui/EditorLayout';
import { CropSheet } from './CropSheet';
import { useLiveMatch } from '../../hooks/useLiveMatch';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, gridStats } from '../../lib/grid';
import type { CropRect, Pattern } from '../../db/schema';
import './ResultAdjust.css';

const PRESETS = [8, 12, 16, 24, 32, 60];
const GRID_DISPLAY_SIZE = 320;

export function ResultAdjust() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [tab, setTab] = useState<'adjust' | 'colors'>('adjust');
  const [cropSheetOpen, setCropSheetOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offeredCropPrompt = useRef(false);
  const imgEl = useLiveMatch();

  // A fresh photo (never framed yet) prompts the crop tool immediately
  // instead of silently auto-cropping — the user decides the framing.
  useEffect(() => {
    if (!draft || !imgEl || offeredCropPrompt.current) return;
    const c = draft.cropRect;
    const isFreshPhoto = c.x === 0 && c.y === 0 && c.width === 1 && c.height === 1;
    if (isFreshPhoto) {
      offeredCropPrompt.current = true;
      setCropSheetOpen(true);
    }
  }, [draft, imgEl]);

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
  const collection = state.collections.find((c) => c.id === draft.collectionId) ?? state.collections[0];
  const isCollectionMode = draft.paletteMode === 'collection';

  function updatePreprocess(patch: Partial<Pattern['preprocessSettings']>) {
    if (!draft) return;
    dispatch({ type: 'draft/update', patch: { preprocessSettings: { ...draft.preprocessSettings, ...patch } } });
  }

  function goToBoard() {
    dispatch({ type: 'nav', screen: 'board' });
  }

  function applyCrop(newCropRect: CropRect, rotatedSourceImage?: string) {
    dispatch({
      type: 'draft/update',
      patch: rotatedSourceImage
        ? { cropRect: newCropRect, sourceImage: rotatedSourceImage }
        : { cropRect: newCropRect },
    });
    setCropSheetOpen(false);
  }

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
            <div className="adjust__stepper-row">
              <span className="type-row-label">PHOTO FRAMING</span>
              <button type="button" className="adjust__link" onClick={() => setCropSheetOpen(true)}>
                CROP PHOTO ›
              </button>
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
                <span className="type-row-label">{collection?.name ?? 'MY COLLECTION'}</span>
              </button>
              <button
                type="button"
                className="adjust__link"
                onClick={() => dispatch({ type: 'nav', screen: 'collections' })}
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
          <button type="button" className="adjust__next-btn" onClick={goToBoard}>
            NEXT
          </button>
        }
      />

      <EditorLayout stage={stage} panelContent={panelContent} />

      {cropSheetOpen && draft.sourceImage && (
        <CropSheet
          sourceImage={draft.sourceImage}
          cropRect={draft.cropRect}
          boardAspect={boardConfig.widthPegs / boardConfig.heightPegs}
          onApply={applyCrop}
          onClose={() => setCropSheetOpen(false)}
        />
      )}
    </div>
  );
}
