import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { BottomSheet } from '../ui/BottomSheet';
import { matchImageToGrid } from '../../lib/match';
import { catalogBeadById } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { gridStats } from '../../lib/grid';
import { savePattern } from '../../db/db';
import type { Pattern } from '../../db/schema';
import './ResultAdjust.css';

const PRESETS = [8, 12, 16, 24, 32, 60];
const GRID_DISPLAY_SIZE = 261;
const DEBOUNCE_MS = 80;

export function ResultAdjust() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [tab, setTab] = useState<'adjust' | 'colors' | 'edit'>('adjust');
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!draft?.sourceImage) return;
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = draft.sourceImage;
  }, [draft?.sourceImage]);

  useEffect(() => {
    if (!draft || !imgEl) return;
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
      surface: 'dark',
      background: '#08080a',
    });
  }, [draft]);

  if (!draft) return null;

  const stats = gridStats(draft.gridData);

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

  return (
    <div className="screen screen--dark">
      <WizardBar
        variant="dark"
        left={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'photo' })}>
            Back
          </button>
        }
        center={
          <span className="adjust__title-center">
            <span className="adjust__title type-card-title">{draft.name}</span>
            <span className="type-mono adjust__title-meta">
              {draft.boardConfig.widthPegs} × {draft.boardConfig.heightPegs} ·{' '}
              {draft.boardConfig.beadType === 'regular' ? 'MIDI' : 'MINI'}
            </span>
          </span>
        }
        right={
          <button type="button" onClick={goToPreview}>
            Preview
          </button>
        }
      />

      <div className="screen__body adjust__body">
        <div className="adjust__grid-block">
          <canvas ref={canvasRef} className="adjust__canvas" />
          <div className="adjust__chips">
            <span className="type-mono adjust__chip">{stats.beadCount} BEADS</span>
            <span className="type-mono adjust__chip">{stats.colorCount} COLORS</span>
            <span className="type-mono adjust__chip">{stats.emptyCount} EMPTY</span>
          </div>
        </div>
      </div>

      <BottomSheet variant="dark">
        <SegmentedControl
          variant="dark"
          options={[
            { value: 'adjust', label: 'Adjust' },
            { value: 'colors', label: 'Colors' },
            { value: 'edit', label: 'Edit' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'adjust' && (
          <div className="adjust__sliders">
            <Slider
              label="Contrast"
              value={draft.preprocessSettings.contrast}
              min={-100}
              max={100}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}`}
              onChange={(v) => updatePreprocess({ contrast: v })}
            />
            <Slider
              label="Saturation"
              value={draft.preprocessSettings.saturation}
              min={-100}
              max={100}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}`}
              onChange={(v) => updatePreprocess({ saturation: v })}
            />
            <Slider
              label="Brightness"
              value={draft.preprocessSettings.brightness}
              min={-100}
              max={100}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}`}
              onChange={(v) => updatePreprocess({ brightness: v })}
            />

            {draft.paletteMode === 'auto' ? (
              <>
                <Slider
                  label="Colors used"
                  value={draft.colorCount}
                  min={2}
                  max={60}
                  onChange={(v) => dispatch({ type: 'draft/update', patch: { colorCount: v } })}
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
              </>
            ) : (
              <div className="adjust__locked-row type-caption">
                Matching is locked to My Colors. Switch to auto palette in setup to change the count.
              </div>
            )}

            <div className="adjust__toggle-row">
              <span className="type-row-label">Gridlines</span>
              <Toggle
                variant="dark"
                checked={draft.gridlines}
                onChange={(v) => dispatch({ type: 'draft/update', patch: { gridlines: v } })}
              />
            </div>
            <div className="adjust__toggle-row">
              <span className="type-row-label">Floyd–Steinberg dither</span>
              <Toggle
                variant="dark"
                checked={draft.dither}
                onChange={(v) => dispatch({ type: 'draft/update', patch: { dither: v } })}
              />
            </div>
          </div>
        )}

        {tab !== 'adjust' && (
          <div className="adjust__coming-soon type-caption">
            {tab === 'colors' ? 'Per-color review' : 'Manual pixel editing'} is coming in a later round — for now,
            use Adjust to change the palette.
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
