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
  variant?: 'light' | 'dark';
}

export function Slider({ label, value, min, max, step = 1, onChange, formatValue, variant = 'dark' }: SliderProps) {
  const display = formatValue ? formatValue(value) : String(value);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <label className={`slider slider--${variant}`}>
      <div className="slider__row">
        <span className="slider__label">{label}</span>
        <span className="slider__value type-mono">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider__input"
        style={{ '--slider-fill': `${pct}%` } as CSSProperties}
      />
    </label>
  );
}
