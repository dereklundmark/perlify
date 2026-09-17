import type { ReactNode } from 'react';
import './BottomSheet.css';

interface BottomSheetProps {
  children: ReactNode;
  variant?: 'white' | 'cream';
  onBackdropClick?: () => void;
  modal?: boolean;
  /** Takes the remaining height of a fixed-height parent and scrolls its own content internally — see EditorLayout's `pinnedStage`. */
  fill?: boolean;
}

export function BottomSheet({ children, variant = 'white', onBackdropClick, modal, fill }: BottomSheetProps) {
  return (
    <>
      {modal && <div className="bottom-sheet-backdrop" onClick={onBackdropClick} />}
      <div
        className={`bottom-sheet bottom-sheet--${variant}${modal ? ' bottom-sheet--modal' : ''}${fill ? ' bottom-sheet--fill' : ''}`}
      >
        <div className="bottom-sheet__handle" />
        {children}
      </div>
    </>
  );
}
