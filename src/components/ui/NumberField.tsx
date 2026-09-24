import { useState, type InputHTMLAttributes } from 'react';
import './NumberField.css';

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  value: number | string;
  onChange: (value: string) => void;
  /**
   * Hold what's typed locally and only call onChange on Enter or when the
   * field loses focus. Needed where an in-progress value (empty, or "3"
   * on the way to "35") isn't valid to apply — otherwise the parent
   * rejects it and the field snaps back, so you can't clear it to retype.
   */
  commitOnEnter?: boolean;
}

export function NumberField({ label, value, onChange, commitOnEnter, ...rest }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    onChange(draft);
    setDraft(null);
  }

  return (
    <label className="number-field">
      {label && <span className="number-field__label">{label}</span>}
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        className="number-field__input"
        value={commitOnEnter && draft !== null ? draft : value}
        onChange={(e) => (commitOnEnter ? setDraft(e.target.value) : onChange(e.target.value))}
        onFocus={(e) => {
          if (commitOnEnter) e.currentTarget.select();
        }}
        onBlur={commitOnEnter ? commit : undefined}
        onKeyDown={(e) => {
          if (!commitOnEnter) return;
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
