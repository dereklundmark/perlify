import { useEffect, useRef, useState, type RefObject } from 'react';
import './RulerStage.css';

const FALLBACK_DISPLAY_SIZE = 336;
// Width of the ruler gutter along the canvas's top and left edges.
const RULER_GUTTER = 16;

// Peg-count tick spacing — chosen so a board of any size shows a
// readable handful of ticks (5, 10, 15… for a small board; 50, 100… for
// a big one) instead of either a dense unreadable comb or almost none.
function pickRulerStep(maxDim: number): number {
  if (maxDim <= 20) return 5;
  if (maxDim <= 60) return 10;
  if (maxDim <= 120) return 20;
  return 50;
}

function ticksUpTo(n: number, step: number): number[] {
  const ticks: number[] = [];
  for (let v = step; v < n; v += step) ticks.push(v);
  return ticks;
}

export interface RulerLayout {
  stageBoxRef: RefObject<HTMLDivElement | null>;
  cellSize: number;
  canvasW: number;
  canvasH: number;
  xTicks: number[];
  yTicks: number[];
}

/**
 * Measures the space actually available for the pattern image (the ruler
 * gutter eats into it), so the ruler and the image always agree on scale —
 * rather than sizing the canvas to a fixed guess and hoping it happens to
 * match whatever room the current screen has.
 */
export function useRulerLayout(cols: number, rows: number): RulerLayout {
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const availableW = stageSize.width - RULER_GUTTER;
  const availableH = stageSize.height - RULER_GUTTER;
  const cellSize =
    availableW > 0 && availableH > 0
      ? Math.max(2, Math.min(availableW / cols, availableH / rows))
      : FALLBACK_DISPLAY_SIZE / Math.max(cols, rows);
  const step = pickRulerStep(Math.max(cols, rows));

  return {
    stageBoxRef,
    cellSize,
    canvasW: cellSize * cols,
    canvasH: cellSize * rows,
    xTicks: ticksUpTo(cols, step),
    yTicks: ticksUpTo(rows, step),
  };
}

interface RulerStageProps {
  layout: RulerLayout;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

/** Fills its parent's box with the pattern canvas plus peg-count rulers along the top and left. */
export function RulerStage({ layout, canvasRef }: RulerStageProps) {
  const { stageBoxRef, cellSize, canvasW, canvasH, xTicks, yTicks } = layout;
  return (
    <div className="ruler-stage" ref={stageBoxRef}>
      <div className="ruler-stage__frame" style={{ width: canvasW + RULER_GUTTER, height: canvasH + RULER_GUTTER }}>
        <div className="ruler-stage__ruler ruler-stage__ruler--x" style={{ left: RULER_GUTTER, width: canvasW }}>
          {xTicks.map((n) => (
            <span key={n} className="ruler-stage__tick" style={{ left: n * cellSize }}>
              {n}
            </span>
          ))}
        </div>
        <div className="ruler-stage__ruler ruler-stage__ruler--y" style={{ top: RULER_GUTTER, height: canvasH }}>
          {yTicks.map((n) => (
            <span key={n} className="ruler-stage__tick" style={{ top: n * cellSize }}>
              {n}
            </span>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          className="ruler-stage__canvas"
          style={{ left: RULER_GUTTER, top: RULER_GUTTER, width: canvasW, height: canvasH }}
        />
      </div>
    </div>
  );
}
