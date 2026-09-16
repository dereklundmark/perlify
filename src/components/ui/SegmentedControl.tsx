import './SegmentedControl.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'compact' for tight contexts (e.g. tabs above a scrolling panel). */
  size?: 'default' | 'compact';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented${size === 'compact' ? ' segmented--compact' : ''}`} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          type="button"
          aria-selected={opt.value === value}
          className={`segmented__option${opt.value === value ? ' segmented__option--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
