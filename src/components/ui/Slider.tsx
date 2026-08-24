import type { CSSProperties } from 'react';
import './Slider.css';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  /** Track fill color — yellow for most controls, red for image adjustments (contrast). */
  fill?: 'yellow' | 'red';
}

export function Slider({ label, value, min, max, step = 1, onChange, formatValue, fill = 'yellow' }: SliderProps) {
  const display = formatValue ? formatValue(value) : String(value);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="slider">
      <div className="slider__row">
        <span className="slider__label type-row-label">{label}</span>
        <span className="slider__value type-numeric">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`slider__input slider__input--${fill}`}
        style={{ '--slider-fill': `${pct}%` } as CSSProperties}
      />
    </div>
  );
}
