import type { ReactNode } from 'react';
import './BottomSheet.css';

interface BottomSheetProps {
  children: ReactNode;
  variant?: 'light' | 'dark';
  onBackdropClick?: () => void;
  modal?: boolean;
}

export function BottomSheet({ children, variant = 'dark', onBackdropClick, modal }: BottomSheetProps) {
  return (
    <>
      {modal && <div className="bottom-sheet-backdrop" onClick={onBackdropClick} />}
      <div className={`bottom-sheet bottom-sheet--${variant}${modal ? ' bottom-sheet--modal' : ''}`}>
        <div className="bottom-sheet__handle" />
        {children}
      </div>
    </>
  );
}
