import './UnitChip.css';

interface UnitChipProps {
  value: string;
  subLabel: string;
  onClick: () => void;
}

export function UnitChip({ value, subLabel, onClick }: UnitChipProps) {
  return (
    <button type="button" className="unit-chip" onClick={onClick}>
      <span className="unit-chip__value">{value}</span>
      <span className="unit-chip__sub type-mono">{subLabel}</span>
    </button>
  );
}
