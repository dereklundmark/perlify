import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { NumberField } from '../ui/NumberField';
import { UnitChip } from '../ui/UnitChip';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { CalibrateSheet } from './CalibrateSheet';
import { pegsPerInch, pegsToUnit, pitchMm, unitToPegs, type BoardUnit } from '../../lib/board';
import type { BeadType } from '../../db/schema';
import './Setup.css';

const PRESETS = [8, 12, 16, 24, 32, 60];
const UNIT_CYCLE: BoardUnit[] = ['pegs', 'in', 'cm'];

export function Setup() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [unit, setUnit] = useState<BoardUnit>('pegs');
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [boardCount, setBoardCount] = useState(1);

  if (!draft) return null;

  const { boardConfig } = draft;
  const override = boardConfig.pegsPerInchOverride;

  function updateBoard(patch: Partial<typeof boardConfig>) {
    dispatch({ type: 'draft/update', patch: { boardConfig: { ...boardConfig, ...patch } } });
  }

  function cycleUnit() {
    const next = UNIT_CYCLE[(UNIT_CYCLE.indexOf(unit) + 1) % UNIT_CYCLE.length];
    setUnit(next);
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

  const widthDisplay = pegsToUnit(boardConfig.widthPegs, unit, boardConfig.beadType, override);
  const heightDisplay = pegsToUnit(boardConfig.heightPegs, unit, boardConfig.beadType, override);
  const widthIn = pegsToUnit(boardConfig.widthPegs, 'in', boardConfig.beadType, override);
  const heightIn = pegsToUnit(boardConfig.heightPegs, 'in', boardConfig.beadType, override);
  const widthCm = pegsToUnit(boardConfig.widthPegs, 'cm', boardConfig.beadType, override);
  const heightCm = pegsToUnit(boardConfig.heightPegs, 'cm', boardConfig.beadType, override);
  const conversionLabel =
    boardConfig.widthPegs === boardConfig.heightPegs
      ? `= ${widthIn.toFixed(1)} in · ${widthCm.toFixed(1)} cm`
      : `= ${widthIn.toFixed(1)}×${heightIn.toFixed(1)} in · ${widthCm.toFixed(1)}×${heightCm.toFixed(1)} cm`;

  const collection = state.collection;
  const isCollectionMode = draft.paletteMode === 'collection';
  const canProceed =
    boardConfig.widthPegs > 0 &&
    boardConfig.heightPegs > 0 &&
    (isCollectionMode ? (collection?.beads.length ?? 0) > 0 : draft.colorCount >= 2 && draft.colorCount <= 60);

  return (
    <div className="screen screen--light">
      <WizardBar
        variant="light"
        step={1}
        left={
          <button type="button" onClick={() => dispatch({ type: 'draft/discard' })}>
            Cancel
          </button>
        }
        right={
          <button type="button" disabled={!canProceed} onClick={() => dispatch({ type: 'nav', screen: 'photo' })}>
            Next
          </button>
        }
      />

      <div className="screen__body setup__body">
        <h1 className="type-screen-title setup__title">Set up the board</h1>

        <div className="setup-card">
          <div className="type-eyebrow setup-card__eyebrow">PATTERN NAME</div>
          <input
            className="setup__name-input"
            value={draft.name}
            onChange={(e) => dispatch({ type: 'draft/update', patch: { name: e.target.value } })}
            placeholder="Untitled pattern"
          />
        </div>

        <div className="setup-card">
          <SegmentedControl
            options={[
              { value: 'regular', label: 'Regular · midi' },
              { value: 'mini', label: 'Mini' },
            ]}
            value={boardConfig.beadType}
            onChange={handleBeadType}
          />
          <div className="setup__pitch-row">
            <span className="type-mono setup__pitch-value">
              {pitchMm(boardConfig.beadType, override).toFixed(1)} mm pitch · {pegsPerInch(boardConfig.beadType, override).toFixed(2)} pegs/in
            </span>
            <button type="button" className="setup__calibrate-link" onClick={() => setCalibrateOpen(true)}>
              Calibrate
            </button>
          </div>
        </div>

        <div className="setup-card">
          <div className="setup__board-header">
            <span className="type-eyebrow">BOARD SIZE</span>
            <span className="type-mono setup__conversion">{conversionLabel}</span>
          </div>
          <div className="setup__board-fields">
            <NumberField label="WIDTH" value={round1(widthDisplay)} onChange={handleWidth} />
            <span className="setup__times type-mono">×</span>
            <NumberField label="HEIGHT" value={round1(heightDisplay)} onChange={handleHeight} />
            <UnitChip value={unit} subLabel="in · cm · pegs" onClick={cycleUnit} />
          </div>
          <div className="setup__divider" />
          <div className="setup__stepper-row">
            <span className="type-row-label">Interlocked boards</span>
            <div className="setup__stepper">
              <button type="button" onClick={() => setBoardCount((n) => Math.max(1, n - 1))}>
                −
              </button>
              <span className="type-mono">{boardCount} × 1</span>
              <button type="button" onClick={() => setBoardCount((n) => Math.min(4, n + 1))}>
                +
              </button>
            </div>
          </div>
        </div>

        <div className="setup-card">
          <div className={`radio-card${!isCollectionMode ? ' radio-card--selected' : ''}`}>
            <button
              type="button"
              className="radio-card__head"
              onClick={() => dispatch({ type: 'draft/update', patch: { paletteMode: 'auto' } })}
            >
              <span className={`radio-dot${!isCollectionMode ? ' radio-dot--selected' : ''}`} />
              <span className="type-row-label">Auto palette</span>
            </button>
            {!isCollectionMode ? (
              <div className="setup__auto-body">
                <div className="setup__count-row">
                  <span className="type-mono setup__count-value">{draft.colorCount}</span>
                  <span className="type-mono setup__count-max">/60</span>
                </div>
                <Slider
                  label=""
                  value={draft.colorCount}
                  min={2}
                  max={60}
                  variant="light"
                  onChange={(v) => dispatch({ type: 'draft/update', patch: { colorCount: v } })}
                  formatValue={() => ''}
                />
                <div className="setup__minmax type-mono">
                  <span>2</span>
                  <span>TYPE ANY NUMBER · 2–60</span>
                  <span>60</span>
                </div>
                <div className="setup__presets">
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
                <p className="type-caption setup__caption">
                  Fewer colors read graphic and cost less; more hold gradients. Picks the N nearest matches from the
                  60-color catalog — you may not own them all.
                </p>
              </div>
            ) : (
              <div className="type-mono setup__collapsed-hint">2–60 FROM CATALOG</div>
            )}
          </div>

          <div className={`radio-card${isCollectionMode ? ' radio-card--selected' : ''}`}>
            <button
              type="button"
              className="radio-card__head"
              onClick={() =>
                dispatch({ type: 'draft/update', patch: { paletteMode: 'collection', collectionId: collection?.id ?? null } })
              }
            >
              <span className={`radio-dot${isCollectionMode ? ' radio-dot--selected radio-dot--filled' : ''}`} />
              <span className="type-row-label">{collection?.name ?? 'My Colors'}</span>
            </button>
            {isCollectionMode && (
              <div className="setup__collection-body">
                <div className="setup__swatch-row">
                  {collection?.beads.map((bead) => (
                    <span key={bead.id} className="setup__swatch" style={{ background: bead.hex }} title={bead.name} />
                  ))}
                </div>
                <div className="setup__callout">
                  Locked to these {collection?.beads.length ?? 0} colors. Nothing outside your collection can appear
                  in the pattern — the color count follows the collection, not a slider.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="setup-card setup__dither-card">
          <div>
            <div className="type-row-label">Dithering</div>
            <div className="type-caption setup__caption">Smoother gradients, noisier pattern</div>
          </div>
          <Toggle checked={draft.dither} onChange={(v) => dispatch({ type: 'draft/update', patch: { dither: v } })} />
        </div>
      </div>

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
