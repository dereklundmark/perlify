import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { NumberField } from '../ui/NumberField';
import { UnitChip } from '../ui/UnitChip';
import { CalibrateSheet } from './CalibrateSheet';
import { PegboardCropSheet } from './PegboardCropSheet';
import { useLiveMatch } from '../../hooks/useLiveMatch';
import { computeCoverCrop, isSentinelCrop } from '../../lib/crop';
import { pegsToUnit, pitchMm, unitToPegs, type BoardUnit } from '../../lib/board';
import { savePattern } from '../../db/db';
import type { BeadType, BoardConfig, CropRect } from '../../db/schema';
import './BoardSetup.css';

const UNIT_CYCLE: BoardUnit[] = ['pegs', 'in', 'cm'];

/**
 * Board size / bead type / pattern name — split out from the Colors screen
 * so choosing a color count against a big live preview isn't buried under
 * a long scrolling form of unrelated structural fields.
 */
export function BoardSetup() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const [unit, setUnit] = useState<BoardUnit>('pegs');
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [pegboardCropOpen, setPegboardCropOpen] = useState(false);
  const imgEl = useLiveMatch();

  // Sample-then-stretch would otherwise distort the pattern whenever the
  // board's aspect ratio doesn't match the (trimmed) photo's — silently
  // fill in a centered crop matching the current board shape until the
  // user deliberately frames it themselves via Pegboard Crop. Never
  // touches a crop that's already real (manual, or a saved pattern's).
  useEffect(() => {
    if (!draft || !imgEl) return;
    if (!isSentinelCrop(draft.cropRect)) return;
    const imageAspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const boardAspect = draft.boardConfig.widthPegs / draft.boardConfig.heightPegs;
    dispatch({ type: 'draft/update', patch: { cropRect: computeCoverCrop(imageAspect, boardAspect) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.boardConfig.widthPegs, draft?.boardConfig.heightPegs, imgEl, draft?.cropRect]);

  if (!draft) return null;

  const { boardConfig } = draft;
  const override = boardConfig.pegsPerInchOverride;

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

  return (
    <div className="screen screen--cream">
      <WizardBar
        left={
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'adjust' })}>
            BACK
          </button>
        }
        center={<span className="adjust__title-center type-numeric">BOARD SETUP</span>}
        right={
          <button type="button" className="adjust__next-btn" onClick={goToPreview}>
            NEXT
          </button>
        }
      />

      <div className="screen__body board-setup__body">
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

        <div className="adjust-card">
          <div className="adjust__stepper-row">
            <span className="type-row-label">PEGBOARD CROP</span>
            <button type="button" className="adjust__link" onClick={() => setPegboardCropOpen(true)}>
              FIT TO BOARD ›
            </button>
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
