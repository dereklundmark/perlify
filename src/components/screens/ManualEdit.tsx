import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { EditorLayout } from '../ui/EditorLayout';
import { catalogBeadById, CATALOG } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, type GridData } from '../../lib/grid';
import { paintCell, clearCell, swapColor, rotate90, flipHorizontal } from '../../lib/gridTransform';
import { savePattern } from '../../db/db';
import './ManualEdit.css';

const BASE_CELL_SIZE = 26;
const MAX_HISTORY = 50;
type Tool = 'paint' | 'clear' | 'swap';

export function ManualEdit() {
  const { state, dispatch } = useApp();
  const draft = state.draft;

  const [grid, setGrid] = useState<GridData>(draft?.gridData ?? []);
  const [undoStack, setUndoStack] = useState<GridData[]>([]);
  const [redoStack, setRedoStack] = useState<GridData[]>([]);
  const [tool, setTool] = useState<Tool>('paint');
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const [extraPaletteIds, setExtraPaletteIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState(BASE_CELL_SIZE);
  const [lastCell, setLastCell] = useState<{ row: number; col: number } | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [hoverPointer, setHoverPointer] = useState<{ x: number; y: number; row: number; col: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinchState = useRef<{ dist: number; cellSize: number } | null>(null);

  const usage = useMemo(() => beadUsage(grid), [grid]);
  const paletteIds = useMemo(() => {
    const ids = new Set(usage.map((u) => u.beadId));
    extraPaletteIds.forEach((id) => ids.add(id));
    return [...ids];
  }, [usage, extraPaletteIds]);

  useEffect(() => {
    if (!currentColor && paletteIds.length > 0) setCurrentColor(paletteIds[0]);
  }, [currentColor, paletteIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || grid.length === 0) return;
    const cols = grid[0].length;
    const rows = grid.length;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderGrid(ctx, {
      grid,
      cellSize,
      getBead: catalogBeadById,
      gridlines: true,
      symbolOverlay: false,
      surface: 'dark',
      background: '#08080a',
    });
    if (lastCell) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.strokeRect(lastCell.col * cellSize + 1, lastCell.row * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.shadowBlur = 0;
    }
  }, [grid, cellSize, lastCell]);

  if (!draft) return null;

  function commit(next: GridData) {
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), grid]);
    setRedoStack([]);
    setGrid(next);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const popped = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, grid]);
    setGrid(popped);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const popped = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, grid]);
    setGrid(popped);
  }

  function cellFromEvent(e: { clientX: number; clientY: number }): { row: number; col: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / cellSize);
    const row = Math.floor((e.clientY - rect.top) / cellSize);
    if (row < 0 || row >= grid.length || col < 0 || col >= (grid[0]?.length ?? 0)) return null;
    return { row, col };
  }

  function handleCanvasClick(e: ReactPointerEvent) {
    const cell = cellFromEvent(e);
    if (!cell) return;
    setLastCell(cell);
    if (tool === 'paint' && currentColor) {
      commit(paintCell(grid, cell.row, cell.col, currentColor));
    } else if (tool === 'clear') {
      commit(clearCell(grid, cell.row, cell.col));
    }
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
    const cell = cellFromEvent(e);
    if (!cell) {
      setHoverPointer(null);
      return;
    }
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    setHoverPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top, row: cell.row, col: cell.col });
  }

  function touchDist(touches: ReactTouchEvent['touches']) {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function onTouchStart(e: ReactTouchEvent) {
    if (e.touches.length === 2) pinchState.current = { dist: touchDist(e.touches), cellSize };
  }
  function onTouchMove(e: ReactTouchEvent) {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinchState.current.dist;
      setCellSize(Math.min(52, Math.max(12, pinchState.current.cellSize * ratio)));
    }
  }
  function onTouchEnd(e: ReactTouchEvent) {
    if (e.touches.length < 2) pinchState.current = null;
  }

  function handleSwatchTap(beadId: string) {
    if (tool === 'swap') {
      if (swapFrom === null) {
        setSwapFrom(beadId);
      } else {
        commit(swapColor(grid, swapFrom, beadId));
        setSwapFrom(null);
        setTool('paint');
      }
    } else {
      setCurrentColor(beadId);
    }
  }

  function handleRotate() {
    commit(rotate90(grid));
  }
  function handleFlip() {
    commit(flipHorizontal(grid));
  }

  function addFromCatalog(id: string) {
    setExtraPaletteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCurrentColor(id);
    setCatalogOpen(false);
    setTool('paint');
  }

  async function handleDone() {
    if (!draft) return;
    const finalWidth = grid[0]?.length ?? draft.boardConfig.widthPegs;
    const finalHeight = grid.length || draft.boardConfig.heightPegs;
    const boardConfig = { ...draft.boardConfig, widthPegs: finalWidth, heightPegs: finalHeight };
    const updated = { ...draft, gridData: grid, boardConfig, updatedAt: Date.now() };
    dispatch({ type: 'draft/update', patch: { gridData: grid, boardConfig } });
    await savePattern(updated);
    dispatch({ type: 'library/upsert', pattern: updated });
    dispatch({ type: 'nav', screen: 'adjust' });
  }

  const currentColorBead = currentColor ? catalogBeadById(currentColor) : undefined;
  const currentColorCount = usage.find((u) => u.beadId === currentColor)?.count ?? 0;

  const stage = (
    <div className="edit__stage-wrap">
      <div className="edit__tool-row">
        <button
          type="button"
          className={`edit__tool-pill${tool === 'paint' ? ' edit__tool-pill--active' : ''}`}
          onClick={() => setTool('paint')}
        >
          {tool === 'paint' && currentColorBead && (
            <span className="edit__tool-swatch" style={{ background: currentColorBead.hex }} />
          )}
          Paint
        </button>
        <button
          type="button"
          className={`edit__tool-pill${tool === 'clear' ? ' edit__tool-pill--active' : ''}`}
          onClick={() => setTool('clear')}
        >
          Clear
        </button>
        <button
          type="button"
          className={`edit__tool-pill${tool === 'swap' ? ' edit__tool-pill--active' : ''}`}
          onClick={() => {
            setTool('swap');
            setSwapFrom(null);
          }}
        >
          {tool === 'swap' ? (swapFrom ? 'Pick target…' : 'Pick source…') : 'Swap'}
        </button>
        <button type="button" className="edit__tool-pill" onClick={handleRotate}>
          Rotate
        </button>
        <button type="button" className="edit__tool-pill" onClick={handleFlip}>
          Flip
        </button>
      </div>

      <div
        className="edit__viewport"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas
          ref={canvasRef}
          className="edit__canvas"
          onPointerDown={handleCanvasClick}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverPointer(null)}
        />
      </div>

      {hoverPointer && (
        <div
          className="edit__hover-readout type-mono"
          style={{ left: hoverPointer.x + 16, top: hoverPointer.y - 10 }}
        >
          <span
            className="edit__hover-swatch"
            style={{ background: catalogBeadById(grid[hoverPointer.row]?.[hoverPointer.col] ?? '')?.hex ?? 'transparent' }}
          />
          {hoverPointer.row},{hoverPointer.col} →{' '}
          {catalogBeadById(grid[hoverPointer.row]?.[hoverPointer.col] ?? '')?.name.toUpperCase() ?? 'EMPTY'}
        </div>
      )}
    </div>
  );

  const panelContent = (
    <>
      <div className="edit__palette-header">
        <span className="type-eyebrow">ACTIVE PALETTE · {paletteIds.length} COLORS</span>
        <button type="button" className="edit__catalog-btn" onClick={() => setCatalogOpen(true)}>
          Catalog +
        </button>
      </div>
      <div className="edit__palette-grid">
        {paletteIds.map((id) => {
          const bead = catalogBeadById(id);
          if (!bead) return null;
          const selected = tool === 'swap' ? id === swapFrom : id === currentColor;
          return (
            <button
              key={id}
              type="button"
              className={`edit__swatch${selected ? ' edit__swatch--selected' : ''}`}
              style={{ background: bead.hex }}
              onClick={() => handleSwatchTap(id)}
            >
              <span className="type-mono">{bead.symbol}</span>
            </button>
          );
        })}
      </div>
      <div className="edit__palette-footer">
        <span>{currentColorBead?.name ?? '—'}</span>
        <span className="type-mono">{currentColorCount} placed</span>
      </div>
    </>
  );

  return (
    <div className="screen screen--dark edit__screen">
      <WizardBar
        variant="dark"
        left={
          <button type="button" disabled={undoStack.length === 0} onClick={undo}>
            Undo
          </button>
        }
        center={
          <span className="type-mono">
            ZOOM {Math.round((cellSize / BASE_CELL_SIZE) * 100)}%
            {lastCell ? ` · CELL ${lastCell.row},${lastCell.col}` : ''}
          </span>
        }
        right={
          <>
            <button type="button" disabled={redoStack.length === 0} onClick={redo} style={{ marginRight: 16 }}>
              Redo
            </button>
            <button type="button" onClick={handleDone}>
              Done
            </button>
          </>
        }
      />

      <EditorLayout stage={stage} panelContent={panelContent} />

      {catalogOpen && (
        <div className="edit__catalog-modal-backdrop" onClick={() => setCatalogOpen(false)}>
          <div className="edit__catalog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="type-card-title edit__catalog-modal-title">Add a catalog color</div>
            <div className="edit__catalog-modal-grid">
              {CATALOG.map((bead) => (
                <button
                  key={bead.id}
                  type="button"
                  className="edit__swatch"
                  style={{ background: bead.hex }}
                  onClick={() => addFromCatalog(bead.id)}
                  title={bead.name}
                >
                  <span className="type-mono">{bead.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
