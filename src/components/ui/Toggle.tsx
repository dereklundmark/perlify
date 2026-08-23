import './Toggle.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: 'light' | 'dark' | 'panel';
  label?: string;
}

export function Toggle({ checked, onChange, variant = 'light', label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle toggle--${variant}${checked ? ' toggle--checked' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  );
}
