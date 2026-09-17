import type { ReactNode } from 'react';
import { useIsTablet } from '../../hooks/useIsTablet';
import { BottomSheet } from './BottomSheet';
import './EditorLayout.css';

interface EditorLayoutProps {
  stage: ReactNode;
  panelContent: ReactNode;
  /**
   * Caps the phone stage to a fixed portion of the screen and makes the
   * panel below scroll internally, instead of the stage and panel scrolling
   * together as one long page — so the image stays on screen no matter how
   * far you scroll into the controls. Requires the screen itself to be a
   * fixed-height container (see ResultAdjust's `editor-screen--pinned`);
   * without that there's nothing for the split to divide up. Off by default
   * since ManualEdit's canvas wants all the room it can get instead.
   */
  pinnedStage?: boolean;
}

/**
 * Phone: canvas above, controls in a bottom sheet.
 * iPad (>=900px, per the handoff's 2a breakpoint): canvas left, controls in
 * a persistent 332px right panel — "the iPhone bottom sheet becomes this
 * fixed panel." Same panel content either way; only the chrome changes.
 */
export function EditorLayout({ stage, panelContent, pinnedStage }: EditorLayoutProps) {
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
      <div
        className={`screen__body editor-layout__stage-region-phone${pinnedStage ? ' editor-layout__stage-region-phone--bounded' : ''}`}
      >
        {stage}
      </div>
      <BottomSheet variant="white" fill={pinnedStage}>
        {panelContent}
      </BottomSheet>
    </>
  );
}
