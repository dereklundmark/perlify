import type { InputHTMLAttributes } from 'react';
import './NumberField.css';

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  value: number | string;
  onChange: (value: string) => void;
}

export function NumberField({ label, value, onChange, ...rest }: NumberFieldProps) {
  return (
    <label className="number-field">
      {label && <span className="number-field__label type-eyebrow">{label}</span>}
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        className="number-field__input type-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
