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
    <BottomSheet variant="light" modal onBackdropClick={onClose}>
      <h2 className="type-card-title">Calibrate my board</h2>
      <p className="type-body calibrate__explain">
        Pegboards vary by brand. Measure once and every board size you enter in inches or centimeters converts
        correctly.
      </p>

      <div className="calibrate__diagram">
        <div className="type-eyebrow calibrate__diagram-label">MEASURE ACROSS 10 SPACINGS</div>
        <div className="calibrate__dots">
          {Array.from({ length: 11 }, (_, i) => (
            <span
              key={i}
              className="calibrate__dot"
              style={{ opacity: i === 0 || i === 10 ? 0.55 : 0.22 }}
            />
          ))}
        </div>
        <div className="calibrate__rule">
          <span className="calibrate__tick" />
          <span className="calibrate__rule-line" />
          <span className="type-mono calibrate__rule-label">{measuredNum.toFixed(1)} MM</span>
          <span className="calibrate__rule-line" />
          <span className="calibrate__tick" />
        </div>
      </div>

      <div className="calibrate__input-row">
        <NumberField label="MEASURED" value={measured} onChange={setMeasured} />
        <div className="calibrate__unit-chip">
          <span>mm</span>
          <span className="type-mono calibrate__unit-sub">mm · in</span>
        </div>
      </div>

      <div className="calibrate__results type-mono">
        <div>
          Your pitch → {result.pitchMm.toFixed(2)} mm · {result.pegsPerIn.toFixed(2)} pegs/in
        </div>
        <div>
          Standard {beadType === 'regular' ? 'midi' : 'mini'} → {standardPitch.toFixed(2)} mm · {result.percentOffStandard.toFixed(1)}% off
        </div>
      </div>

      <div className="calibrate__actions">
        <PillButton
          onClick={() => {
            onApply(result.pegsPerIn);
            onClose();
          }}
        >
          Use my measurement
        </PillButton>
        <PillButton
          variant="secondary"
          onClick={() => {
            onApply(undefined);
            setMeasured((standardPitch * 10).toFixed(1));
          }}
        >
          Standard
        </PillButton>
      </div>
    </BottomSheet>
  );
}
