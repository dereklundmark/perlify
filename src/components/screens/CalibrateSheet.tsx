import { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { PillButton } from '../ui/PillButton';
import { NumberField } from '../ui/NumberField';
import { calibrateFromMeasurement, pitchMm, type BeadType } from '../../lib/board';
import './CalibrateSheet.css';

interface CalibrateSheetProps {
  beadType: BeadType;
  onApply: (pegsPerInchOverride: number | undefined) => void;
  onClose: () => void;
}

export function CalibrateSheet({ beadType, onApply, onClose }: CalibrateSheetProps) {
  const [measured, setMeasured] = useState('50.0');
  const measuredNum = Number(measured) || 0;
  const result = calibrateFromMeasurement(measuredNum, beadType);
  const standardPitch = pitchMm(beadType);

  return (
    <BottomSheet variant="cream" modal onBackdropClick={onClose}>
      <h2 className="type-headline">
        CALIBRATE
        <br />
        MY BOARD
      </h2>
      <p className="type-body">
        Pegboards vary by brand. Measure once and every size you enter in inches or cm converts correctly.
      </p>

      <div className="calibrate__diagram">
        <div className="type-eyebrow calibrate__diagram-label">MEASURE ACROSS 10 SPACINGS</div>
        <div className="calibrate__dots">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className={`calibrate__dot${i === 0 || i === 10 ? ' calibrate__dot--end' : ''}`} />
          ))}
        </div>
        <div className="calibrate__rule">
          <span className="calibrate__tick" />
          <span className="calibrate__rule-line" />
          <span className="type-numeric calibrate__rule-label">{measuredNum.toFixed(1)} MM</span>
          <span className="calibrate__rule-line" />
          <span className="calibrate__tick" />
        </div>
      </div>

      <div className="calibrate__input-row">
        <NumberField label="MEASURED" value={measured} onChange={setMeasured} />
        <div className="calibrate__unit-chip">MM</div>
      </div>

      <div className="calibrate__results">
        <div className="calibrate__result-row calibrate__result-row--primary">
          <span>YOUR PITCH</span>
          <span>{result.pitchMm.toFixed(2)} mm</span>
        </div>
        <div className="calibrate__result-row">
          <span>STANDARD {beadType === 'regular' ? 'MIDI' : 'MINI'}</span>
          <span>{result.percentOffStandard.toFixed(1)}% OFF</span>
        </div>
      </div>

      <div className="calibrate__actions">
        <PillButton
          onClick={() => {
            onApply(result.pegsPerIn);
            onClose();
          }}
          style={{ flex: 1 }}
        >
          USE MINE
        </PillButton>
        <PillButton
          variant="secondary"
          onClick={() => {
            onApply(undefined);
            setMeasured((standardPitch * 10).toFixed(1));
          }}
        >
          STANDARD
        </PillButton>
      </div>
    </BottomSheet>
  );
}
