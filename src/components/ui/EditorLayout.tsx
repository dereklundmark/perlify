import type { ReactNode } from 'react';
import { useIsTablet } from '../../hooks/useIsTablet';
import { BottomSheet } from './BottomSheet';
import './EditorLayout.css';

interface EditorLayoutProps {
  stage: ReactNode;
  panelContent: ReactNode;
}

/**
 * Phone: canvas above, controls in a bottom sheet.
 * iPad (>=900px, per the handoff's 2a breakpoint): canvas left, controls in
 * a persistent 332px right panel — "the iPhone bottom sheet becomes this
 * fixed panel." Same panel content either way; only the chrome changes.
 */
export function EditorLayout({ stage, panelContent }: EditorLayoutProps) {
  const isTablet = useIsTablet();

  if (isTablet) {
    return (
      <div className="editor-layout editor-layout--tablet">
        <div className="editor-layout__stage-region">{stage}</div>
        <div className="editor-layout__panel">{panelContent}</div>
      </div>
    );
  }

  return (
    <>
      <div className="screen__body editor-layout__stage-region-phone">{stage}</div>
      <BottomSheet variant="white">{panelContent}</BottomSheet>
    </>
  );
}
