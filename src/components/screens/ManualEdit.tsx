import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { EditorLayout } from '../ui/EditorLayout';
import { BottomSheet } from '../ui/BottomSheet';
import { PillButton } from '../ui/PillButton';
import { catalogBeadById, CATALOG } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, gridStats, type GridData } from '../../lib/grid';
import { paintCell, clearCell, swapColor, rotate90, flipHorizontal } from '../../lib/gridTransform';
import { savePattern } from '../../db/db';
import './ManualEdit.css';

const BASE_CELL_SIZE = 26;
const MAX_HISTORY = 50;
type Tool = 'paint' | 'clear' | 'swap';
type View = 'edit' | 'swap-find' | 'swap-choose';

interface HistoryStep {
  id: string;
  label: string;
  affectedCount: number;
  grid: GridData;
  swatch?: string;
  swatchFrom?: string;
  swatchTo?: string;
}

export function ManualEdit() {
  const { state, dispatch } = useApp();
  const draft = state.draft;

  const [grid, setGrid] = useState<GridData>(draft?.gridData ?? []);
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [pointer, setPointer] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('paint');
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const [extraPaletteIds, setExtraPaletteIds] = useState<string[]>([]);
  const [cellSize, setCellSize] = useState(BASE_CELL_SIZE);
  const [lastCell, setLastCell] = useState<{ row: number; col: number } | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [hoverPointer, setHoverPointer] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const [view, setView] = useState<View>('edit');
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinchState = useRef<{ dist: number; cellSize: number } | null>(null);
  const activeBatchRef = useRef<string | null>(null);
  const seeded = useRef(false);

  const usage = useMemo(() => beadUsage(grid), [grid]);
  const paletteIds = useMemo(() => {
    const ids = new Set(usage.map((u) => u.beadId));
    extraPaletteIds.forEach((id) => ids.add(id));
    return [...ids];
  }, [usage, extraPaletteIds]);

  // Seed step 0 ("Perlified · N colors") once, from the grid Adjust handed off.
  useEffect(() => {
    if (seeded.current || !draft) return;
    seeded.current = true;
    const stats = gridStats(draft.gridData);
    const seed: HistoryStep = {
      id: 'seed',
      label: `Perlified · ${stats.colorCount} colors`,
      affectedCount: stats.beadCount,
      grid: draft.gridData,
    };
    setHistory([seed]);
    setPointer(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

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

    let outlineChanged: Set<string> | undefined;
    let isolate: { beadId: string; fadeToward: string; fadePct: number } | undefined;
    let displayGrid = grid;

    if (view === 'swap-find' && swapSourceId) {
      isolate = { beadId: swapSourceId, fadeToward: '#fff8e7', fadePct: 0.88 };
    } else if (view === 'swap-choose' && swapSourceId && swapTargetId) {
      displayGrid = swapColor(grid, swapSourceId, swapTargetId);
      outlineChanged = new Set();
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          if (grid[r][c] === swapSourceId) outlineChanged.add(`${r},${c}`);
        }
      }
    }

    renderGrid(ctx, {
      grid: displayGrid,
      cellSize,
      getBead: catalogBeadById,
      gridlines: true,
      symbolOverlay: false,
      surface: 'light',
      background: '#ffffff',
      isolate,
      outlineChanged,
    });
    if (lastCell && view === 'edit') {
      ctx.strokeStyle = '#e8533f';
      ctx.lineWidth = 3;
      ctx.strokeRect(lastCell.col * cellSize + 1.5, lastCell.row * cellSize + 1.5, cellSize - 3, cellSize - 3);
    }
  }, [grid, cellSize, lastCell, view, swapSourceId, swapTargetId]);

  if (!draft) return null;

  function pushStep(newGrid: GridData, label: string, affectedCount: number, extra: Partial<HistoryStep> = {}) {
    const truncated = history.slice(0, pointer + 1);
    const step: HistoryStep = { id: crypto.randomUUID(), label, affectedCount, grid: newGrid, ...extra };
    const next = [...truncated, step].slice(-MAX_HISTORY);
    setHistory(next);
    setPointer(next.length - 1);
    setGrid(newGrid);
  }

  function jumpTo(index: number) {
    activeBatchRef.current = null;
    setPointer(index);
    setGrid(history[index].grid);
  }

  function undo() {
    if (pointer <= 0) return;
    activeBatchRef.current = null;
    jumpTo(pointer - 1);
  }
  function redo() {
    if (pointer >= history.length - 1) return;
    activeBatchRef.current = null;
    jumpTo(pointer + 1);
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
    if (view !== 'edit') return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    setLastCell(cell);

    if (tool === 'paint' && currentColor) {
      const newGrid = paintCell(grid, cell.row, cell.col, currentColor);
      const batchKey = `paint:${currentColor}`;
      if (activeBatchRef.current === batchKey && pointer === history.length - 1) {
        const count = history[pointer].affectedCount + 1;
        const updated = { ...history[pointer], grid: newGrid, affectedCount: count, label: `Painted ${count} bead${count === 1 ? '' : 's'}` };
        setHistory((prev) => [...prev.slice(0, -1), updated]);
        setGrid(newGrid);
      } else {
        activeBatchRef.current = batchKey;
        const bead = catalogBeadById(currentColor);
        pushStep(newGrid, 'Painted 1 bead', 1, { swatch: bead?.hex });
      }
    } else if (tool === 'clear') {
      const newGrid = clearCell(grid, cell.row, cell.col);
      const batchKey = 'clear';
      if (activeBatchRef.current === batchKey && pointer === history.length - 1) {
        const count = history[pointer].affectedCount + 1;
        const updated = { ...history[pointer], grid: newGrid, affectedCount: count, label: `Cleared ${count} bead${count === 1 ? '' : 's'}` };
        setHistory((prev) => [...prev.slice(0, -1), updated]);
        setGrid(newGrid);
      } else {
        activeBatchRef.current = batchKey;
        pushStep(newGrid, 'Cleared 1 bead', 1);
      }
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

  function handlePaletteSwatchTap(beadId: string) {
    activeBatchRef.current = null;
    setCurrentColor(beadId);
    setTool('paint');
  }

  function handleRotate() {
    activeBatchRef.current = null;
    const stats = gridStats(grid);
    pushStep(rotate90(grid), 'Rotated 90°', stats.beadCount);
  }
  function handleFlip() {
    activeBatchRef.current = null;
    const stats = gridStats(grid);
    pushStep(flipHorizontal(grid), 'Flipped', stats.beadCount);
  }

  function addFromCatalog(id: string) {
    setExtraPaletteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCurrentColor(id);
    setCatalogOpen(false);
    setTool('paint');
  }

  function openSwapFind() {
    activeBatchRef.current = null;
    setSwapSourceId(null);
    setSwapTargetId(null);
    setView('swap-find');
  }

  function applySwap() {
    if (!swapSourceId || !swapTargetId) return;
    const affected = usage.find((u) => u.beadId === swapSourceId)?.count ?? 0;
    const fromBead = catalogBeadById(swapSourceId);
    const toBead = catalogBeadById(swapTargetId);
    pushStep(swapColor(grid, swapSourceId, swapTargetId), `${fromBead?.name ?? 'Color'} → ${toBead?.name ?? 'color'}`, affected, {
      swatchFrom: fromBead?.hex,
      swatchTo: toBead?.hex,
    });
    setView('edit');
    setSwapSourceId(null);
    setSwapTargetId(null);
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

  // ---- Swap-Find view ----
  if (view === 'swap-find') {
    const sourceBead = swapSourceId ? catalogBeadById(swapSourceId) : undefined;
    const sourceCount = swapSourceId ? usage.find((u) => u.beadId === swapSourceId)?.count ?? 0 : 0;
    return (
      <div className="screen screen--cream edit__screen">
        <WizardBar
          left={
            <button type="button" onClick={() => setView('edit')}>
              CANCEL
            </button>
          }
          center={<span className="type-eyebrow">SWAP · 1 OF 2</span>}
          right={
            <button type="button" disabled={!swapSourceId} onClick={() => setView('swap-choose')}>
              NEXT
            </button>
          }
        />
        <div className="screen__body edit__swap-body">
          <canvas ref={canvasRef} className="edit__swap-canvas" />
          <p className="type-body edit__swap-caption">Everything else fades so you can see exactly what moves.</p>
        </div>
        <BottomSheet variant="white">
          <div className="type-eyebrow">TAP A COLOR TO FIND IT</div>
          <div className="edit__palette-grid">
            {paletteIds.map((id) => {
              const bead = catalogBeadById(id);
              if (!bead) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={`edit__swatch${id === swapSourceId ? ' edit__swatch--selected' : ''}`}
                  style={{ background: bead.hex }}
                  onClick={() => setSwapSourceId(id)}
                >
                  <span>{bead.symbol}</span>
                </button>
              );
            })}
          </div>
          {sourceBead && (
            <div className="edit__swap-selected-row">
              <span className="edit__swap-selected-swatch" style={{ background: sourceBead.hex }} />
              <span className="type-row-label" style={{ flex: 1 }}>
                {sourceBead.name}
              </span>
              <span className="type-numeric">{sourceCount}</span>
            </div>
          )}
        </BottomSheet>
      </div>
    );
  }

  // ---- Swap-Choose view ----
  if (view === 'swap-choose') {
    const sourceBead = swapSourceId ? catalogBeadById(swapSourceId) : undefined;
    const targetBead = swapTargetId ? catalogBeadById(swapTargetId) : undefined;
    const sourceCount = swapSourceId ? usage.find((u) => u.beadId === swapSourceId)?.count ?? 0 : 0;
    return (
      <div className="screen screen--cream edit__screen">
        <WizardBar
          left={
            <button type="button" onClick={() => setView('swap-find')}>
              BACK
            </button>
          }
          center={<span className="type-eyebrow">SWAP · 2 OF 2</span>}
          right={
            <button type="button" onClick={() => setView('swap-find')}>
              UNDO
            </button>
          }
        />
        <div className="screen__body edit__swap-body">
          <canvas ref={canvasRef} className="edit__swap-canvas" />
          <p className="type-body edit__swap-caption">Live preview — outlined cells are the ones changing.</p>
        </div>
        <BottomSheet variant="white">
          <div className="edit__swap-decision-row">
            <span className="edit__swap-selected-swatch" style={{ background: sourceBead?.hex }} />
            <span className="type-row-label">{sourceBead?.name}</span>
            <span className="edit__swap-arrow">→</span>
            <span className="edit__swap-selected-swatch" style={{ background: targetBead?.hex ?? '#fff' }} />
            <span className="type-row-label" style={{ flex: 1 }}>
              {targetBead?.name ?? '—'}
            </span>
            <span className="type-numeric">{sourceCount}</span>
          </div>
          <div className="type-eyebrow">
            SWAP IN — FROM {(state.collections.find((c) => c.id === draft.collectionId) ?? state.collections[0])?.name?.toUpperCase() ?? 'MY COLLECTION'}
          </div>
          <div className="edit__palette-grid">
            {(state.collections.find((c) => c.id === draft.collectionId)?.beads ?? state.collections[0]?.beads ?? []).map((bead) => (
              <button
                key={bead.id}
                type="button"
                className={`edit__swatch${bead.id === swapTargetId ? ' edit__swatch--selected' : ''}`}
                style={{ background: bead.hex }}
                onClick={() => setSwapTargetId(bead.id)}
              >
                <span>{catalogBeadById(bead.id)?.symbol ?? ''}</span>
              </button>
            ))}
          </div>
          <div className="edit__swap-actions">
            <PillButton variant="secondary" onClick={() => setView('edit')} style={{ width: 112 }}>
              CANCEL
            </PillButton>
            <PillButton onClick={applySwap} disabled={!swapTargetId} style={{ flex: 1 }}>
              APPLY SWAP
            </PillButton>
          </div>
        </BottomSheet>
      </div>
    );
  }

  // ---- Edit view ----
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
          PAINT
        </button>
        <button
          type="button"
          className={`edit__tool-pill${tool === 'clear' ? ' edit__tool-pill--active' : ''}`}
          onClick={() => setTool('clear')}
        >
          CLEAR
        </button>
        <button type="button" className="edit__tool-pill" onClick={openSwapFind}>
          SWAP
        </button>
        <button type="button" className="edit__glyph-btn" onClick={handleRotate} aria-label="Rotate">
          ⟳
        </button>
        <button type="button" className="edit__glyph-btn" onClick={handleFlip} aria-label="Flip">
          ⇄
        </button>
      </div>

      <div className="edit__viewport" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <canvas
          ref={canvasRef}
          className="edit__canvas"
          onPointerDown={handleCanvasClick}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverPointer(null)}
        />
      </div>

      {hoverPointer && (
        <div className="edit__hover-readout" style={{ left: hoverPointer.x + 16, top: hoverPointer.y - 10 }}>
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
        <span className="type-eyebrow">ACTIVE PALETTE · {paletteIds.length}</span>
        <button type="button" className="adjust__link" onClick={() => setCatalogOpen(true)}>
          CATALOG +
        </button>
      </div>
      <div className="edit__palette-grid">
        {paletteIds.map((id) => {
          const bead = catalogBeadById(id);
          if (!bead) return null;
          return (
            <button
              key={id}
              type="button"
              className={`edit__swatch${id === currentColor ? ' edit__swatch--selected' : ''}`}
              style={{ background: bead.hex }}
              onClick={() => handlePaletteSwatchTap(id)}
            >
              <span>{bead.symbol}</span>
            </button>
          );
        })}
      </div>
      <div className="edit__palette-footer">
        <span className="type-row-label">{currentColorBead?.name ?? '—'}</span>
        <span className="type-numeric">{currentColorCount} PLACED</span>
      </div>
    </>
  );

  return (
    <div className="screen screen--cream edit__screen">
      <WizardBar
        left={
          <button type="button" disabled={pointer <= 0} onClick={undo}>
            ↶
          </button>
        }
        center={
          <span className="edit__bar-center">
            <button type="button" className="edit__step-chip" onClick={() => setHistoryOpen(true)}>
              <span className="type-numeric">{history.length}</span> STEPS
            </button>
            <span className="type-eyebrow">{Math.round((cellSize / BASE_CELL_SIZE) * 100)}%</span>
          </span>
        }
        right={
          <>
            <button type="button" disabled={pointer >= history.length - 1} onClick={redo} style={{ marginRight: 16 }}>
              ↷
            </button>
            <button type="button" onClick={handleDone}>
              DONE
            </button>
          </>
        }
      />

      <EditorLayout stage={stage} panelContent={panelContent} />

      {catalogOpen && (
        <div className="edit__catalog-modal-backdrop" onClick={() => setCatalogOpen(false)}>
          <div className="edit__catalog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="type-headline" style={{ fontSize: 22 }}>
              Add a catalog color
            </div>
            <div className="edit__palette-grid edit__catalog-modal-grid">
              {CATALOG.map((bead) => (
                <button
                  key={bead.id}
                  type="button"
                  className="edit__swatch"
                  style={{ background: bead.hex }}
                  onClick={() => addFromCatalog(bead.id)}
                  title={bead.name}
                >
                  <span>{bead.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <BottomSheet variant="cream" modal onBackdropClick={() => setHistoryOpen(false)}>
          <div className="edit__history-preview-wrap">
            <canvas
              className="edit__history-preview"
              ref={(el) => {
                if (!el) return;
                const g = history[pointer]?.grid ?? grid;
                const cols = g[0]?.length ?? 1;
                const rows = g.length || 1;
                const cs = 145 / Math.max(cols, rows);
                el.width = cols * cs;
                el.height = rows * cs;
                const ctx = el.getContext('2d');
                if (ctx) renderGrid(ctx, { grid: g, cellSize: cs, getBead: catalogBeadById, gridlines: false, symbolOverlay: false, surface: 'light' });
              }}
            />
          </div>
          <div className="edit__history-header">
            <h2 className="type-headline" style={{ fontSize: 26 }}>
              HISTORY
            </h2>
            <span className="type-meta">{history.length} STEPS</span>
          </div>
          <div className="edit__history-list">
            {history.map((step, i) => {
              const applied = i <= pointer;
              return (
                <div key={step.id}>
                  <button
                    type="button"
                    className={`edit__history-row${applied ? '' : ' edit__history-row--undone'}`}
                    onClick={() => jumpTo(i)}
                  >
                    {step.swatchFrom ? (
                      <span className="edit__history-swatch-pair">
                        <span className="edit__history-swatch" style={{ background: step.swatchFrom }} />
                        <span>→</span>
                        <span className="edit__history-swatch" style={{ background: step.swatchTo }} />
                      </span>
                    ) : step.swatch ? (
                      <span className="edit__history-swatch" style={{ background: step.swatch }} />
                    ) : null}
                    <span className="edit__history-label">{step.label}</span>
                    <span className="edit__history-count">{i === 0 ? 'START' : `+${step.affectedCount}`}</span>
                  </button>
                  {i === pointer && history.length > 1 && (
                    <div className="edit__history-here">
                      <span />
                      <span className="type-eyebrow">YOU ARE HERE</span>
                      <span />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="edit__swap-actions">
            <PillButton variant="secondary" onClick={() => jumpTo(history.length - 1)} style={{ flex: 1 }}>
              REDO ALL {history.length - 1 - pointer}
            </PillButton>
            <PillButton onClick={() => setHistoryOpen(false)} style={{ flex: 1 }}>
              KEEP THIS
            </PillButton>
          </div>
          <p className="type-body">Tap any step to jump there. Nothing is discarded until you make a new change.</p>
        </BottomSheet>
      )}
    </div>
  );
}
