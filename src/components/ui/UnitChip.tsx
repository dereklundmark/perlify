import './UnitChip.css';

interface UnitChipProps {
  value: string;
  onClick: () => void;
}

export function UnitChip({ value, onClick }: UnitChipProps) {
  return (
    <button type="button" className="unit-chip" onClick={onClick}>
      {value}
    </button>
  );
}
