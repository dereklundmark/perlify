import type { ReactNode } from 'react';
import './GroupedList.css';

export function GroupedList({ children }: { children: ReactNode }) {
  return <div className="grouped-list">{children}</div>;
}

interface GroupedListRowProps {
  label: ReactNode;
  value?: ReactNode;
  caption?: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
}

export function GroupedListRow({ label, value, caption, onClick, trailing }: GroupedListRowProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp className="grouped-list__row" onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="grouped-list__row-main">
        <span className="grouped-list__label">{label}</span>
        {caption && <span className="grouped-list__caption">{caption}</span>}
      </div>
      {value !== undefined && <span className="grouped-list__value type-numeric">{value}</span>}
      {trailing}
    </Comp>
  );
}
