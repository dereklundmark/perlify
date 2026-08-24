import type { ReactNode } from 'react';
import './WizardBar.css';

interface WizardBarProps {
  left: ReactNode;
  center?: ReactNode;
  right: ReactNode;
  step?: number;
  totalSteps?: number;
}

/** Progress is N discrete segments, not a continuous bar — per the Pegboard spec. */
export function WizardBar({ left, center, right, step, totalSteps = 4 }: WizardBarProps) {
  return (
    <div className="wizard-bar">
      <div className="wizard-bar__row">
        <div className="wizard-bar__side">{left}</div>
        <div className="wizard-bar__center type-eyebrow">
          {center ?? (step !== undefined ? `STEP ${step} OF ${totalSteps}` : null)}
        </div>
        <div className="wizard-bar__side wizard-bar__side--right">{right}</div>
      </div>
      {step !== undefined && (
        <div className="wizard-bar__segments">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={`wizard-bar__segment${i < step ? ' wizard-bar__segment--done' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
