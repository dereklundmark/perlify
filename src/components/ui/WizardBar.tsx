import type { ReactNode } from 'react';
import './WizardBar.css';

interface WizardBarProps {
  left: ReactNode;
  center?: ReactNode;
  right: ReactNode;
  variant?: 'light' | 'dark';
  step?: number;
  totalSteps?: number;
}

export function WizardBar({ left, center, right, variant = 'light', step, totalSteps = 5 }: WizardBarProps) {
  return (
    <div className={`wizard-bar wizard-bar--${variant}`}>
      <div className="wizard-bar__row">
        <div className="wizard-bar__side">{left}</div>
        <div className="wizard-bar__center type-mono">
          {center ?? (step !== undefined ? `STEP ${step} OF ${totalSteps}` : null)}
        </div>
        <div className="wizard-bar__side wizard-bar__side--right">{right}</div>
      </div>
      {step !== undefined && (
        <div className="wizard-bar__track">
          <div className="wizard-bar__fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
