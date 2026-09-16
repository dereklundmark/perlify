import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { EditorLayout } from '../ui/EditorLayout';
import { useLiveMatch } from '../../hooks/useLiveMatch';
import { catalogBeadById, HAMA_PRESET_BEADS, PERLER_PRESET_BEADS } from '../../lib/catalog';
import { HAMA_PRESET_COLLECTION_ID, PERLER_PRESET_COLLECTION_ID } from '../../db/db';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, gridStats } from '../../lib/grid';
import { savePattern } from '../../db/db';
import type { DitherMode, Pattern, SamplingMode } from '../../db/schema';
import './ResultAdjust.css';

const PRESETS = [8, 12, 16, 24, 32, 60];
const GRID_DISPLAY_SIZE = 336;

const DITHER_OPTIONS: { value: DitherMode; label: string }[] = [
  { value: 'none', label: 'NONE' },
  { value: 'floyd-steinberg', label: 'FLOYD' },
  { value: 'atkinson', label: 'ATKINSON' },
  { value: 'ordered', label: 'ORDERED' },
];

const SAMPLING_OPTIONS: { value: SamplingMode; label: string }[] = [
  { value: 'box', label: 'BOX AVERAGE' },
  { value: 'nearest', label: 'NEAREST NEIGHBOR' },
];

type AccordionSection = 'palette' | 'adjustments' | 'detail' | null;

function formatSigned(v: number): string {
  return `${v > 0 ? '+' : ''}${v}`;
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

interface ColorCountBodyProps {
  max: number;
  value: number;
  onChange: (v: number) => void;
}

// Shared by every palette option (Auto and each collection) — same slider
// caps whichever pool is currently active to its N most-used colors, so
// switching between Auto/Hama/Perler/My Collection keeps one consistent
// "how many colors" control instead of each mode needing its own.
function ColorCountBody({ max, value, onChange }: ColorCountBodyProps) {
  const clampedMax = Math.max(2, max);
  return (
    <div className="adjust__auto-body">
      <Slider label="" value={Math.min(value, clampedMax)} min={2} max={clampedMax} onChange={onChange} formatValue={() => ''} />
      <div className="adjust__presets">
        {PRESETS.filter((p) => p <= clampedMax).map((p) => (
          <button
            key={p}
            type="button"
            className={`preset-chip${value === p ? ' preset-chip--active' : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResultAdjust() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [tab, setTab] = useState<'adjust' | 'colors'>('adjust');
  const [openSection, setOpenSection] = useState<AccordionSection>('palette');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLiveMatch();

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
  const isCollectionMode = draft.paletteMode === 'collection';
  const isHamaSelected = isCollectionMode && draft.collectionId === HAMA_PRESET_COLLECTION_ID;
  const isPerlerSelected = isCollectionMode && draft.collectionId === PERLER_PRESET_COLLECTION_ID;
  const isMyCollectionSelected = isCollectionMode && !isHamaSelected && !isPerlerSelected;
  const collection = state.collections.find((c) => c.id === draft.collectionId) ?? state.collections[0];
  // Distinct from `collection` above: MY COLLECTION must resolve to the
  // user's own collection even while a preset is active, both so tapping
  // it doesn't just re-select the preset it's currently showing, and so
  // its own label/swatches don't briefly read "Hama"/"Perler".
  const myCollection = isMyCollectionSelected
    ? collection
    : state.collections.find((c) => c.id !== HAMA_PRESET_COLLECTION_ID && c.id !== PERLER_PRESET_COLLECTION_ID);
  const { contrast, saturation, brightness, denoise, abstraction, sharpen } = draft.preprocessSettings;
  const hamaCount = isHamaSelected ? Math.min(draft.colorCount, HAMA_PRESET_BEADS.length) : HAMA_PRESET_BEADS.length;
  const perlerCount = isPerlerSelected
    ? Math.min(draft.colorCount, PERLER_PRESET_BEADS.length)
    : PERLER_PRESET_BEADS.length;
  const myCollectionSize = myCollection?.beads.length ?? 0;
  const myCollectionCount = isMyCollectionSelected ? Math.min(draft.colorCount, myCollectionSize) : myCollectionSize;

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

  async function goToLibrary() {
    if (!draft) return;
    await savePattern(draft);
    dispatch({ type: 'library/upsert', pattern: draft });
    dispatch({ type: 'nav', screen: 'library' });
  }

  function toggleSection(section: 'palette' | 'adjustments' | 'detail') {
    setOpenSection((cur) => (cur === section ? null : section));
  }

  const paletteSummary = isHamaSelected
    ? `Hama · ${hamaCount}`
    : isPerlerSelected
      ? `Perler · ${perlerCount}`
      : isMyCollectionSelected
        ? `${collection?.name ?? 'My Collection'} · ${myCollectionCount}`
        : `Auto · ${draft.colorCount}`;

  const stage = (
    <div className="adjust__grid-block">
      <canvas ref={canvasRef} className="adjust__canvas" />
    </div>
  );

  const panelContent = (
    <>
      <SegmentedControl
        size="compact"
        options={[
          { value: 'adjust', label: 'ADJUST' },
          { value: 'colors', label: `COLORS · ${formatCount(stats.beadCount)}` },
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
          <div className="accordion-section">
            <button type="button" className="accordion-section__head" onClick={() => toggleSection('palette')}>
              <span className="type-row-label">PALETTE</span>
              <span className="type-meta accordion-section__summary">{paletteSummary}</span>
              <span
                className={`accordion-section__chevron${openSection === 'palette' ? ' accordion-section__chevron--open' : ''}`}
              />
            </button>
            {openSection === 'palette' && (
              <div className="accordion-section__body">
                <button
                  type="button"
                  className="radio-card__head"
                  onClick={() => dispatch({ type: 'draft/update', patch: { paletteMode: 'auto' } })}
                >
                  <span className={`radio-dot${!isCollectionMode ? ' radio-dot--selected' : ''}`} />
                  <span className="adjust__palette-label">AUTO PALETTE</span>
                  <span className="type-numeric adjust__count-value">{draft.colorCount}</span>
                </button>
                {!isCollectionMode && (
                  <ColorCountBody
                    max={60}
                    value={draft.colorCount}
                    onChange={(v) => dispatch({ type: 'draft/update', patch: { colorCount: v } })}
                  />
                )}

                <div className="adjust__divider" />

                <button
                  type="button"
                  className="radio-card__head"
                  onClick={() =>
                    dispatch({
                      type: 'draft/update',
                      patch: { paletteMode: 'collection', collectionId: HAMA_PRESET_COLLECTION_ID },
                    })
                  }
                >
                  <span className={`radio-dot${isHamaSelected ? ' radio-dot--selected radio-dot--filled' : ''}`} />
                  <span className="adjust__palette-label">HAMA</span>
                  <span className="type-numeric adjust__count-value">{hamaCount}</span>
                </button>
                {isHamaSelected && (
                  <ColorCountBody
                    max={HAMA_PRESET_BEADS.length}
                    value={draft.colorCount}
                    onChange={(v) => dispatch({ type: 'draft/update', patch: { colorCount: v } })}
                  />
                )}

                <div className="adjust__divider" />

                <button
                  type="button"
                  className="radio-card__head"
                  onClick={() =>
                    dispatch({
                      type: 'draft/update',
                      patch: { paletteMode: 'collection', collectionId: PERLER_PRESET_COLLECTION_ID },
                    })
                  }
                >
                  <span className={`radio-dot${isPerlerSelected ? ' radio-dot--selected radio-dot--filled' : ''}`} />
                  <span className="adjust__palette-label">PERLER</span>
                  <span className="type-numeric adjust__count-value">{perlerCount}</span>
                </button>
                {isPerlerSelected && (
                  <ColorCountBody
                    max={PERLER_PRESET_BEADS.length}
                    value={draft.colorCount}
                    onChange={(v) => dispatch({ type: 'draft/update', patch: { colorCount: v } })}
                  />
                )}

                <div className="adjust__divider" />

                <div className="radio-card__head radio-card__head--row">
                  <button
                    type="button"
                    className="radio-card__head-select"
                    onClick={() =>
                      dispatch({
                        type: 'draft/update',
                        patch: { paletteMode: 'collection', collectionId: myCollection?.id ?? null },
                      })
                    }
                  >
                    <span className={`radio-dot${isMyCollectionSelected ? ' radio-dot--selected radio-dot--filled' : ''}`} />
                    <span className="adjust__palette-label">{myCollection?.name ?? 'MY COLLECTION'}</span>
                  </button>
                  <button
                    type="button"
                    className="adjust__link"
                    onClick={() => dispatch({ type: 'nav', screen: 'collections' })}
                  >
                    {myCollectionCount} ›
                  </button>
                </div>
                {isMyCollectionSelected && myCollectionSize > 0 && (
                  <ColorCountBody
                    max={myCollectionSize}
                    value={draft.colorCount}
                    onChange={(v) => dispatch({ type: 'draft/update', patch: { colorCount: v } })}
                  />
                )}
                <div className="adjust__collection-swatch-row">
                  {myCollection?.beads.map((bead) => (
                    <span
                      key={bead.id}
                      className="adjust__collection-swatch"
                      style={{ background: bead.hex }}
                      title={bead.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="accordion-section">
            <button type="button" className="accordion-section__head" onClick={() => toggleSection('adjustments')}>
              <span className="type-row-label">ADJUSTMENTS</span>
              <span className="type-meta accordion-section__summary">{`Contrast ${formatSigned(contrast)}`}</span>
              <span
                className={`accordion-section__chevron${openSection === 'adjustments' ? ' accordion-section__chevron--open' : ''}`}
              />
            </button>
            {openSection === 'adjustments' && (
              <div className="accordion-section__body accordion-section__body--padded adjust__adjustments-body">
                <Slider
                  label="CONTRAST"
                  value={contrast}
                  min={-100}
                  max={100}
                  fill="red"
                  formatValue={formatSigned}
                  onChange={(v) => updatePreprocess({ contrast: v })}
                />
                <Slider
                  label="SATURATION"
                  value={saturation}
                  min={-100}
                  max={100}
                  fill="red"
                  formatValue={formatSigned}
                  onChange={(v) => updatePreprocess({ saturation: v })}
                />
                <Slider
                  label="BRIGHTNESS"
                  value={brightness}
                  min={-100}
                  max={100}
                  fill="red"
                  formatValue={formatSigned}
                  onChange={(v) => updatePreprocess({ brightness: v })}
                />

                <div className="adjust__divider" />

                <div className="adjust__inline-toggle-row">
                  <span className="type-row-label">DUOTONE</span>
                  <Toggle checked={draft.preprocessSettings.duotone} onChange={(v) => updatePreprocess({ duotone: v })} />
                </div>
                {draft.preprocessSettings.duotone && (
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={draft.preprocessSettings.duotoneHue}
                    onChange={(e) => updatePreprocess({ duotoneHue: Number(e.target.value) })}
                    className="adjust__hue-rail"
                  />
                )}
              </div>
            )}
          </div>

          <div className="accordion-section">
            <button type="button" className="accordion-section__head" onClick={() => toggleSection('detail')}>
              <span className="type-row-label">DETAIL</span>
              <span className="type-meta accordion-section__summary">
                {draft.samplingMode === 'box' ? 'Box average' : 'Nearest neighbor'}
              </span>
              <span
                className={`accordion-section__chevron${openSection === 'detail' ? ' accordion-section__chevron--open' : ''}`}
              />
            </button>
            {openSection === 'detail' && (
              <div className="accordion-section__body accordion-section__body--padded adjust__adjustments-body">
                <div className="adjust__presets">
                  {SAMPLING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`preset-chip${draft.samplingMode === opt.value ? ' preset-chip--active' : ''}`}
                      onClick={() => dispatch({ type: 'draft/update', patch: { samplingMode: opt.value } })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="adjust__divider" />

                <Slider
                  label="DENOISE"
                  value={denoise}
                  min={0}
                  max={10}
                  onChange={(v) => updatePreprocess({ denoise: v })}
                />
                <Slider
                  label="ABSTRACTION"
                  value={abstraction}
                  min={0}
                  max={10}
                  onChange={(v) => updatePreprocess({ abstraction: v })}
                />
                <Slider
                  label="SHARPEN"
                  value={sharpen}
                  min={0}
                  max={10}
                  onChange={(v) => updatePreprocess({ sharpen: v })}
                />
              </div>
            )}
          </div>

          <div className="adjust-card">
            <div className="type-row-label" style={{ marginBottom: 10 }}>
              DITHERING
            </div>
            <div className="adjust__presets">
              {DITHER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`preset-chip${draft.ditherMode === opt.value ? ' preset-chip--active' : ''}`}
                  onClick={() => dispatch({ type: 'draft/update', patch: { ditherMode: opt.value } })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
          <>
            <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'board' })}>
              BACK
            </button>
            <button type="button" className="adjust__home-btn" aria-label="Go to library" onClick={goToLibrary}>
              ⌂
            </button>
          </>
        }
        center={<span className="adjust__title-center type-numeric">{draft.name.toUpperCase()}</span>}
        right={
          <button type="button" className="adjust__next-btn" onClick={goToPreview}>
            NEXT
          </button>
        }
      />

      <EditorLayout stage={stage} panelContent={panelContent} />
    </div>
  );
}
