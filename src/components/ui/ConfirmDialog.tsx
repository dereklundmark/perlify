import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** 'danger' styles the confirm button red — for deletes and overwrites. */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app "are you sure?" sheet — used instead of window.confirm so it matches the app and can explain consequences. */
export function ConfirmDialog({ title, children, confirmLabel, tone = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <BottomSheet variant="white" modal onBackdropClick={onCancel}>
      <div className="confirm-dialog" role="alertdialog" aria-label={title}>
        <h2 className="confirm-dialog__title">{title}</h2>
        <div className="type-body confirm-dialog__body">{children}</div>
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__cancel" onClick={onCancel}>
            CANCEL
          </button>
          <button
            type="button"
            className={`confirm-dialog__confirm${tone === 'danger' ? ' confirm-dialog__confirm--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
