import { useState, type CSSProperties } from 'react';
import { pitchMm } from '../../lib/board';
import { CARD_HEIGHT_MM, CARD_WIDTH_MM, guessPxPerMm, resetCalibration, saveCalibration, setActualSize, useScreenScale } from '../../lib/screenScale';
import type { BoardConfig } from '../../db/schema';
import { BottomSheet } from './BottomSheet';
import { Toggle } from './Toggle';
import './Slider.css';
import './ActualSize.css';

/** CSS px per peg when ACTUAL SIZE is on, or null when it's off. */
export function useActualCellSize(board: Pick<BoardConfig, 'beadType' | 'pegsPerInchOverride'> | undefined): number | null {
  const { actualSize, pxPerMm } = useScreenScale();
  if (!actualSize || !board) return null;
  return pitchMm(board.beadType, board.pegsPerInchOverride) * pxPerMm;
}

function formatMm(mm: number): string {
  return mm >= 100 ? `${(mm / 10).toFixed(1)} cm` : `${Math.round(mm)} mm`;
}

interface ActualSizeBarProps {
  board: BoardConfig;
  className?: string;
}

/**
 * The ACTUAL SIZE switch plus the real-world size readout, shown under the
 * design on Adjust / Edit / Preview / Export. The switch is shared: turning
 * it on here keeps it on for the other screens too.
 */
export function ActualSizeBar({ board, className }: ActualSizeBarProps) {
  const { actualSize, calibrated } = useScreenScale();
  const [calibrating, setCalibrating] = useState(false);
  const pitch = pitchMm(board.beadType, board.pegsPerInchOverride);
  const widthMm = board.widthPegs * pitch;
  const heightMm = board.heightPegs * pitch;

  function toggle(on: boolean) {
    setActualSize(on);
    // The guess can be off by a few percent — ask once, the first time.
    if (on && !calibrated) setCalibrating(true);
  }

  return (
    <div className={`actual-size-bar${className ? ` ${className}` : ''}`}>
      <div className="actual-size-bar__text">
        <span className="type-row-label">ACTUAL SIZE</span>
        <span className="type-meta">
          {formatMm(widthMm)} × {formatMm(heightMm)}
          {actualSize && (
            <>
              {' · '}
              <button type="button" className="actual-size-bar__calibrate" onClick={() => setCalibrating(true)}>
                {calibrated ? 'RECALIBRATE' : 'CALIBRATE SCREEN'}
              </button>
            </>
          )}
        </span>
      </div>
      <Toggle label="Show actual size" checked={actualSize} onChange={toggle} />
      {calibrating && <ScreenCalibrateSheet onClose={() => setCalibrating(false)} />}
    </div>
  );
}

const MIN_PX_PER_MM = 2.5;
const MAX_PX_PER_MM = 9;
const NUDGE = 0.02;

/** Hold a bank card to the screen and grow/shrink the outline until they match. */
export function ScreenCalibrateSheet({ onClose }: { onClose: () => void }) {
  const { pxPerMm } = useScreenScale();
  const [value, setValue] = useState(pxPerMm);
  const clamp = (v: number) => Math.min(MAX_PX_PER_MM, Math.max(MIN_PX_PER_MM, v));
  // Portrait, so the card's 54 mm side is the width — fits even a phone.
  const cardStyle: CSSProperties = { width: CARD_HEIGHT_MM * value, height: CARD_WIDTH_MM * value };

  return (
    <BottomSheet variant="cream" modal onBackdropClick={onClose}>
      <div className="screen-calibrate">
        <h2 className="type-headline screen-calibrate__title">MATCH A CARD</h2>
        <p className="type-body screen-calibrate__note">
          Hold any bank or ID card flat against the screen, inside the outline. Adjust until the outline's edges line up
          with the card's. This is saved for this device.
        </p>

        <div className="screen-calibrate__card-wrap">
          <div className="screen-calibrate__card" style={cardStyle}>
            <span className="type-meta">CARD</span>
          </div>
        </div>

        <div className="screen-calibrate__controls">
          <button type="button" className="screen-calibrate__nudge" aria-label="Smaller" onClick={() => setValue((v) => clamp(v - NUDGE))}>
            −
          </button>
          <input
            type="range"
            min={MIN_PX_PER_MM}
            max={MAX_PX_PER_MM}
            step={0.01}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="slider__input slider__input--yellow screen-calibrate__slider"
            style={{ '--slider-fill': `${((value - MIN_PX_PER_MM) / (MAX_PX_PER_MM - MIN_PX_PER_MM)) * 100}%` } as CSSProperties}
            aria-label="Outline size"
          />
          <button type="button" className="screen-calibrate__nudge" aria-label="Bigger" onClick={() => setValue((v) => clamp(v + NUDGE))}>
            +
          </button>
        </div>

        <div className="screen-calibrate__actions">
          <button
            type="button"
            className="screen-calibrate__secondary"
            onClick={() => {
              resetCalibration();
              setValue(guessPxPerMm());
            }}
          >
            RESET
          </button>
          <button
            type="button"
            className="screen-calibrate__primary"
            onClick={() => {
              saveCalibration(value);
              onClose();
            }}
          >
            IT MATCHES
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
