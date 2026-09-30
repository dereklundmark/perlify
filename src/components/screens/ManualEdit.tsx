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
import { useIsTablet } from '../../hooks/useIsTablet';
import { ActualSizeBar, useActualCellSize } from '../ui/ActualSize';
import { setActualSize } from '../../lib/screenScale';
import { EditorLayout } from '../ui/EditorLayout';
import { BottomSheet } from '../ui/BottomSheet';
import { PillButton } from '../ui/PillButton';
import { Toggle } from '../ui/Toggle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { beadById, CATALOG } from '../../lib/catalog';
import { renderGrid } from '../../lib/renderGrid';
import { beadUsage, compositeGrid, gridStats, type GridData } from '../../lib/grid';
import type { BoardPadding, PatternLayer } from '../../db/schema';
import { paintCell, clearCell, swapColor, rotate90, flipHorizontal } from '../../lib/gridTransform';
import { savePattern } from '../../db/db';
import { flipPadding, NO_PADDING, resizeSide, rotatePadding, type Side } from '../../lib/boardPadding';
import { markGridCurrent } from '../../hooks/useLiveMatch';
import { ColorFamiliesPanel } from './ColorFamiliesPanel';
import { familiesInUsage, pickAddition, remapGrid, type FamilyCell, type FamilyGroup } from '../../lib/familyEdit';
import { sampleAdjustedGrid } from '../../lib/match';
import { photoArea } from '../../lib/boardPadding';
import type { Bead } from '../../db/schema';
import './ManualEdit.css';

const FIT_WIDTH = 336; // fallback before the viewport has been measured
// Room kept around the canvas in fit mode for its outline + offset shadow.
const FIT_MARGIN = 24;
const MIN_ZOOM_CELL = 8;
const MAX_ZOOM_CELL = 60;
const MAX_HISTORY = 50;
type Tool = 'paint' | 'clear' | 'swap';
type View = 'edit' | 'swap-find' | 'swap-choose';

/** Everything the editor can change and undo: the photo (base) layer plus the extra layers over it. */
interface Doc {
  base: GridData;
  baseVisible: boolean;
  layers: PatternLayer[];
  /** Empty rows/columns added around the photo ("extend board"). */
  pad: BoardPadding;
}

const EXTEND_SIDES: { side: Side; label: string }[] = [
  { side: 'top', label: 'TOP' },
  { side: 'bottom', label: 'BOTTOM' },
  { side: 'left', label: 'LEFT' },
  { side: 'right', label: 'RIGHT' },
];

const BASE_ID = 'base';

function withActiveGrid(doc: Doc, activeId: string, grid: GridData): Doc {
  if (activeId === BASE_ID) return { ...doc, base: grid };
  return { ...doc, layers: doc.layers.map((l) => (l.id === activeId ? { ...l, grid } : l)) };
}

function flatten(doc: Doc): GridData {
  return compositeGrid({ base: doc.base, layers: doc.layers, baseVisible: doc.baseVisible });
}

interface HistoryStep {
  id: string;
  label: string;
  affectedCount: number;
  doc: Doc;
  swatch?: string;
  swatchFrom?: string;
  swatchTo?: string;
  /** Set only for swap steps — the bead-id rule, so Done can persist it as a colorSwaps entry. */
  swapFromId?: string;
  swapToId?: string;
  /** Color-family edits on the photo layer: several from→to rules at once, persisted like swaps. */
  swaps?: { from: string; to: string }[];
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {open ? (
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M2 12s4-7 10-7c2 0 3.8.7 5.3 1.7M22 12s-4 7-10 7c-2 0-3.8-.7-5.3-1.7" />
        </>
      )}
    </svg>
  );
}

export function ManualEdit() {
  const { state, dispatch } = useApp();
  const draft = state.draft;

  const [doc, setDoc] = useState<Doc>(() => ({
    base: draft?.gridData ?? [],
    baseVisible: draft?.baseVisible !== false,
    layers: draft?.layers ?? [],
    pad: draft?.boardPadding ?? NO_PADDING,
  }));
  const [activeLayerId, setActiveLayerId] = useState(BASE_ID);
  // `grid` is the ACTIVE layer's grid — what the paint/clear/swap tools
  // act on. `flat` is what's actually shown: every visible layer combined.
  const activeLayer = doc.layers.find((l) => l.id === activeLayerId) ?? null;
  const activeIsBase = activeLayer === null;
  const grid = activeLayer ? activeLayer.grid : doc.base;
  const activeVisible = activeLayer ? activeLayer.visible : doc.baseVisible;
  const flat = useMemo(() => flatten(doc), [doc]);
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [pointer, setPointer] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('paint');
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const [extraPaletteIds, setExtraPaletteIds] = useState<string[]>([]);
  // null = fit the board to the viewport (like Adjust); a number = pinch zoom.
  const [zoomCellSize, setZoomCellSize] = useState<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const isTablet = useIsTablet();
  const boardCols = draft?.gridData[0]?.length || draft?.boardConfig.widthPegs || 1;
  const boardRows = draft?.gridData.length || draft?.boardConfig.heightPegs || 1;
  // Fit both ways into the stage. Its height is fixed on iPad and pinned on
  // phones (EditorLayout pinnedStage), so the canvas can't feed back into it.
  const fitCellSize =
    viewportSize.width > 0
      ? Math.max(
          4,
          viewportSize.height > 0
            ? Math.min((viewportSize.width - FIT_MARGIN) / boardCols, (viewportSize.height - FIT_MARGIN) / boardRows)
            : (viewportSize.width - FIT_MARGIN) / Math.max(boardCols, boardRows),
        )
      : FIT_WIDTH / Math.max(boardCols, boardRows);
  // ACTUAL SIZE overrides both until the user pinches.
  const actualCellSize = useActualCellSize(draft?.boardConfig);
  const cellSize = actualCellSize ?? zoomCellSize ?? fitCellSize;
  const [lastCell, setLastCell] = useState<{ row: number; col: number } | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [hoverPointer, setHoverPointer] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const [view, setView] = useState<View>('edit');
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  // Swap and Merge share the find → choose flow. Swap picks the new color
  // from the collection; Merge folds a color into one already in the design.
  const [replaceMode, setReplaceMode] = useState<'swap' | 'merge'>('swap');
  // COLOR FAMILIES: a remap of the active layer shown on the board, not yet applied.
  const [familyPreview, setFamilyPreview] = useState<Map<string, string> | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  // The side panel/sheet is split into tabs so no section needs a long scroll
  // away from the board (on iPhone the board stays pinned above it).
  const [panelTab, setPanelTab] = useState<'palette' | 'colors' | 'board'>('palette');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pinchState = useRef<{ dist: number; cellSize: number; midX: number; midY: number } | null>(null);
  const activeBatchRef = useRef<string | null>(null);
  const seeded = useRef(false);

  // Drag-painting: a finger sliding across squares fires many pointer events
  // faster than React re-renders, so each one must build on the previous
  // one's result (kept here), not on whatever `grid`/`history` the last
  // render happened to capture — otherwise squares get skipped or reverted.
  const live = useRef({ doc, history, pointer });
  live.current = { doc, history, pointer };
  const activeIdRef = useRef(activeLayerId);
  activeIdRef.current = activeLayerId;
  const strokeCellRef = useRef<{ row: number; col: number } | null>(null);
  const [dragPaint, setDragPaint] = useState(() => {
    try {
      return localStorage.getItem('perlify.dragPaint') === '1';
    } catch {
      return false;
    }
  });
  function updateDragPaint(on: boolean) {
    setDragPaint(on);
    try {
      localStorage.setItem('perlify.dragPaint', on ? '1' : '0');
    } catch {
      // Storage unavailable (private mode etc.) — the setting just won't persist.
    }
  }

  const usage = useMemo(() => beadUsage(flat), [flat]);
  const activeUsage = useMemo(() => beadUsage(grid), [grid]);
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
      doc: {
        base: draft.gridData,
        baseVisible: draft.baseVisible !== false,
        layers: draft.layers ?? [],
        pad: draft.boardPadding ?? NO_PADDING,
      },
    };
    setHistory([seed]);
    setPointer(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // The viewport's own box (it scrolls, so the canvas inside never resizes it).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewportSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isTablet, view]);

  useEffect(() => {
    if (!currentColor && paletteIds.length > 0) setCurrentColor(paletteIds[0]);
  }, [currentColor, paletteIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || doc.base.length === 0) return;
    const cols = doc.base[0].length;
    const rows = doc.base.length;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    // Exact (fractional) CSS size — the buffer rounds down, which would
    // throw ACTUAL SIZE (and tap hit-testing) off by a pixel.
    // (Swap views share this canvas but size it with CSS, so leave theirs alone.)
    canvas.style.width = view === 'edit' ? `${cols * cellSize}px` : '';
    canvas.style.height = view === 'edit' ? `${rows * cellSize}px` : '';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let outlineChanged: Set<string> | undefined;
    let isolate: { beadId: string; fadeToward: string; fadePct: number } | undefined;
    let displayGrid = flat;

    if (view === 'edit' && familyPreview && familyPreview.size > 0) {
      displayGrid = flatten(withActiveGrid(doc, activeLayerId, remapGrid(grid, familyPreview)));
    } else if (view === 'swap-find' && swapSourceId) {
      isolate = { beadId: swapSourceId, fadeToward: '#fff8e7', fadePct: 0.88 };
    } else if (view === 'swap-choose' && swapSourceId && swapTargetId) {
      displayGrid = flatten(withActiveGrid(doc, activeLayerId, swapColor(grid, swapSourceId, swapTargetId)));
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
      getBead: beadById,
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
    // isTablet: crossing the iPad breakpoint remounts the canvas (see EditorLayout).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, flat, cellSize, lastCell, view, swapSourceId, swapTargetId, isTablet, familyPreview]);

  if (!draft) return null;

  // Writes state and the `live` mirror together, so back-to-back calls
  // (drag-painting) see each other's results before React re-renders.
  function commit(newDoc: Doc, nextHistory: HistoryStep[], nextPointer: number) {
    live.current = { doc: newDoc, history: nextHistory, pointer: nextPointer };
    setHistory(nextHistory);
    setPointer(nextPointer);
    setDoc(newDoc);
  }

  function pushStep(newDoc: Doc, label: string, affectedCount: number, extra: Partial<HistoryStep> = {}) {
    const { history: h, pointer: p } = live.current;
    const truncated = h.slice(0, p + 1);
    const step: HistoryStep = { id: crypto.randomUUID(), label, affectedCount, doc: newDoc, ...extra };
    const next = [...truncated, step].slice(-MAX_HISTORY);
    commit(newDoc, next, next.length - 1);
  }

  function jumpTo(index: number) {
    activeBatchRef.current = null;
    const target = history[index].doc;
    setPointer(index);
    setDoc(target);
    // Undoing "add layer" (or redoing "delete layer") can remove the layer
    // that was selected — fall back to the photo layer rather than editing a ghost.
    if (activeLayerId !== BASE_ID && !target.layers.some((l) => l.id === activeLayerId)) {
      setActiveLayerId(BASE_ID);
    }
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
    // Measure from inside the canvas's border, not its outer edge — the
    // ~2px offset was enough to land a touch in the neighboring square.
    const col = Math.floor((e.clientX - rect.left - canvas.clientLeft) / cellSize);
    const row = Math.floor((e.clientY - rect.top - canvas.clientTop) / cellSize);
    if (row < 0 || row >= doc.base.length || col < 0 || col >= (doc.base[0]?.length ?? 0)) return null;
    return { row, col };
  }

  function applyToolAt(cell: { row: number; col: number }) {
    const { doc: d, history: h, pointer: p } = live.current;
    const activeId = activeIdRef.current;
    const layer = d.layers.find((l) => l.id === activeId);
    // Painting on a hidden layer would change something you can't see.
    if (layer ? !layer.visible : !d.baseVisible) return;
    const g = layer ? layer.grid : d.base;

    if (tool === 'paint' && currentColor) {
      const newGrid = withActiveGrid(d, activeId, paintCell(g, cell.row, cell.col, currentColor));
      const batchKey = `paint:${currentColor}`;
      if (activeBatchRef.current === batchKey && p === h.length - 1) {
        const count = h[p].affectedCount + 1;
        const updated = { ...h[p], doc: newGrid, affectedCount: count, label: `Painted ${count} bead${count === 1 ? '' : 's'}` };
        commit(newGrid, [...h.slice(0, -1), updated], p);
      } else {
        activeBatchRef.current = batchKey;
        const bead = beadById(currentColor);
        pushStep(newGrid, 'Painted 1 bead', 1, { swatch: bead?.hex });
      }
    } else if (tool === 'clear') {
      const newGrid = withActiveGrid(d, activeId, clearCell(g, cell.row, cell.col));
      const batchKey = 'clear';
      if (activeBatchRef.current === batchKey && p === h.length - 1) {
        const count = h[p].affectedCount + 1;
        const updated = { ...h[p], doc: newGrid, affectedCount: count, label: `Cleared ${count} bead${count === 1 ? '' : 's'}` };
        commit(newGrid, [...h.slice(0, -1), updated], p);
      } else {
        activeBatchRef.current = batchKey;
        pushStep(newGrid, 'Cleared 1 bead', 1);
      }
    }
  }

  function handleCanvasClick(e: ReactPointerEvent) {
    if (view !== 'edit') return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    setLastCell(cell);
    // Each drag stroke is its own history step (the cells it covers merge
    // into it), so one undo takes back one stroke, not everything painted.
    if (dragPaint) activeBatchRef.current = null;
    applyToolAt(cell);
    if (dragPaint) strokeCellRef.current = cell;
  }

  function endStroke() {
    strokeCellRef.current = null;
  }

  // Sliding a finger quickly can skip whole squares between two pointer
  // events, so fill in every cell along the straight line from the last
  // one painted to the one under the finger now.
  function continueStroke(e: ReactPointerEvent) {
    const from = strokeCellRef.current;
    const to = cellFromEvent(e);
    if (!from || !to || (from.row === to.row && from.col === to.col)) return;
    const steps = Math.max(Math.abs(to.row - from.row), Math.abs(to.col - from.col));
    for (let i = 1; i <= steps; i++) {
      const cell = {
        row: Math.round(from.row + ((to.row - from.row) * i) / steps),
        col: Math.round(from.col + ((to.col - from.col) * i) / steps),
      };
      applyToolAt(cell);
    }
    strokeCellRef.current = to;
    setLastCell(to);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (dragPaint && strokeCellRef.current && view === 'edit') continueStroke(e);
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
  function touchMid(touches: ReactTouchEvent['touches']) {
    return { x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 };
  }
  function onTouchStart(e: ReactTouchEvent) {
    if (e.touches.length === 2) {
      // A second finger means pinch/pan, not painting.
      endStroke();
      const mid = touchMid(e.touches);
      pinchState.current = { dist: touchDist(e.touches), cellSize, midX: mid.x, midY: mid.y };
    }
  }
  function onTouchMove(e: ReactTouchEvent) {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinchState.current.dist;
      // Pinching means "zoom", so it leaves actual-size mode (starting from the actual size).
      if (actualCellSize) setActualSize(false);
      setZoomCellSize(Math.min(Math.max(MAX_ZOOM_CELL, fitCellSize), Math.max(MIN_ZOOM_CELL, pinchState.current.cellSize * ratio)));
      // With drag-painting on, one finger belongs to the brush, so the
      // browser's own scrolling is off (see the canvas's touch-action) —
      // two fingers pan the zoomed canvas by hand instead.
      if (dragPaint && viewportRef.current) {
        const mid = touchMid(e.touches);
        viewportRef.current.scrollLeft -= mid.x - pinchState.current.midX;
        viewportRef.current.scrollTop -= mid.y - pinchState.current.midY;
        pinchState.current.midX = mid.x;
        pinchState.current.midY = mid.y;
      }
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
    const stats = gridStats(flat);
    pushStep(
      {
        ...doc,
        base: rotate90(doc.base),
        layers: doc.layers.map((l) => ({ ...l, grid: rotate90(l.grid) })),
        pad: rotatePadding(doc.pad),
      },
      'Rotated 90°',
      stats.beadCount,
    );
  }
  function handleFlip() {
    activeBatchRef.current = null;
    const stats = gridStats(flat);
    pushStep(
      {
        ...doc,
        base: flipHorizontal(doc.base),
        layers: doc.layers.map((l) => ({ ...l, grid: flipHorizontal(l.grid) })),
        pad: flipPadding(doc.pad),
      },
      'Flipped',
      stats.beadCount,
    );
  }

  // ---- Extend board ----
  // Adds/removes empty rows or columns on one side. Nothing is re-matched:
  // the photo and every painted bead keep their exact cells.
  function extendBoard(side: Side, delta: 1 | -1) {
    activeBatchRef.current = null;
    if (delta < 0 && doc.pad[side] <= 0) return;
    const vertical = side === 'top' || side === 'bottom';
    const lineLength = vertical ? (doc.base[0]?.length ?? 0) : doc.base.length;
    pushStep(
      {
        ...doc,
        base: resizeSide(doc.base, side, delta),
        layers: doc.layers.map((l) => ({ ...l, grid: resizeSide(l.grid, side, delta) })),
        pad: { ...doc.pad, [side]: doc.pad[side] + delta },
      },
      `${delta > 0 ? 'Added' : 'Removed'} a ${vertical ? 'row' : 'column'} ${delta > 0 ? 'on' : 'from'} ${side}`,
      lineLength,
    );
  }

  // ---- Layers ----
  function selectLayer(id: string) {
    activeBatchRef.current = null;
    setActiveLayerId(id);
  }

  function addLayer() {
    activeBatchRef.current = null;
    const rows = doc.base.length;
    const cols = doc.base[0]?.length ?? 0;
    let n = doc.layers.length + 1;
    while (doc.layers.some((l) => l.name === `Layer ${n}`)) n++;
    const layer: PatternLayer = {
      id: crypto.randomUUID(),
      name: `Layer ${n}`,
      visible: true,
      grid: Array.from({ length: rows }, () => Array<string | null>(cols).fill(null)),
    };
    pushStep({ ...doc, layers: [...doc.layers, layer] }, `Added "${layer.name}"`, 0);
    setActiveLayerId(layer.id);
  }

  function toggleLayer(id: string) {
    activeBatchRef.current = null;
    if (id === BASE_ID) {
      pushStep({ ...doc, baseVisible: !doc.baseVisible }, `${doc.baseVisible ? 'Hid' : 'Showed'} "Photo"`, 0);
      return;
    }
    const layer = doc.layers.find((l) => l.id === id);
    if (!layer) return;
    pushStep(
      { ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) },
      `${layer.visible ? 'Hid' : 'Showed'} "${layer.name}"`,
      0,
    );
  }

  function renameLayer(id: string) {
    const layer = doc.layers.find((l) => l.id === id);
    if (!layer) return;
    const name = window.prompt('Rename layer', layer.name);
    if (!name || !name.trim() || name.trim() === layer.name) return;
    activeBatchRef.current = null;
    pushStep(
      { ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)) },
      `Renamed "${layer.name}" to "${name.trim()}"`,
      0,
    );
  }

  function deleteLayer(id: string) {
    const layer = doc.layers.find((l) => l.id === id);
    if (!layer) return;
    const beads = gridStats(layer.grid).beadCount;
    if (!window.confirm(`Delete "${layer.name}"?${beads > 0 ? ` Its ${beads} bead${beads === 1 ? '' : 's'} will be removed.` : ''} You can undo this.`)) return;
    activeBatchRef.current = null;
    pushStep({ ...doc, layers: doc.layers.filter((l) => l.id !== id) }, `Deleted "${layer.name}"`, beads);
    if (activeLayerId === id) setActiveLayerId(BASE_ID);
  }

  function addFromCatalog(id: string) {
    setExtraPaletteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCurrentColor(id);
    setCatalogOpen(false);
    setTool('paint');
  }

  function openSwapFind(mode: 'swap' | 'merge' = 'swap') {
    activeBatchRef.current = null;
    setReplaceMode(mode);
    setSwapSourceId(null);
    setSwapTargetId(null);
    setView('swap-find');
  }

  function applySwap() {
    if (!swapSourceId || !swapTargetId) return;
    const affected = activeUsage.find((u) => u.beadId === swapSourceId)?.count ?? 0;
    const fromBead = beadById(swapSourceId);
    const toBead = beadById(swapTargetId);
    pushStep(
      withActiveGrid(doc, activeLayerId, swapColor(grid, swapSourceId, swapTargetId)),
      replaceMode === 'merge'
        ? `Merged ${fromBead?.name ?? 'color'} into ${toBead?.name ?? 'color'}`
        : `${fromBead?.name ?? 'Color'} → ${toBead?.name ?? 'color'}`,
      affected,
      {
        swatchFrom: fromBead?.hex,
        swatchTo: toBead?.hex,
        // Only swaps on the photo layer become persistent re-match rules;
        // a swap on a painted layer has nothing to re-apply against.
        ...(activeIsBase ? { swapFromId: swapSourceId, swapToId: swapTargetId } : {}),
      },
    );
    setView('edit');
    setSwapSourceId(null);
    setSwapTargetId(null);
  }

  // ---- Color families ----
  const families = familiesInUsage(activeUsage, beadById);
  const familyCollection = state.collections.find((c) => c.id === draft.collectionId);
  const palettePool: Bead[] =
    draft.paletteMode === 'collection' && familyCollection
      ? familyCollection.beads
      : CATALOG.map(({ id, name, hex }) => ({ id, name, hex }));
  const anyPool: Bead[] = (() => {
    const byId = new Map<string, Bead>();
    for (const b of [...CATALOG, ...state.collections.flatMap((c) => c.beads)]) {
      if (!byId.has(b.id)) byId.set(b.id, { id: b.id, name: b.name, hex: b.hex });
    }
    return [...byId.values()];
  })();

  function applyFamilyMap(map: Map<string, string>, label: string) {
    activeBatchRef.current = null;
    setFamilyPreview(null);
    const affected = grid.flat().filter((id) => id != null && map.has(id)).length;
    // On the photo layer these become re-match rules (like Swap) — but only
    // when no target is also a source, since rules re-apply one after another.
    const chained = [...map.values()].some((to) => map.has(to));
    const swaps = activeIsBase && !chained ? [...map].map(([from, to]) => ({ from, to })) : undefined;
    pushStep(withActiveGrid(doc, activeLayerId, remapGrid(grid, map)), label, affected, swaps ? { swaps } : {});
  }

  async function addFamilyColor(group: FamilyGroup, pool: Bead[]): Promise<string | null> {
    if (!activeIsBase) return 'Switch to the PHOTO layer to add colors — they come from the photo.';
    const transformed = history.slice(0, pointer + 1).some((s) => s.label.startsWith('Rotated') || s.label === 'Flipped');
    if (transformed) return 'Adding colors needs the photo in its original orientation — undo the rotate/flip first.';
    if (!draft?.sourceImage) return 'This pattern has no photo to take colors from.';
    if (!photoRef.current) {
      // onload, not img.decode(): decode() never settles while the page is
      // hidden (e.g. the app briefly backgrounded), which froze the buttons.
      const img = new Image();
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = draft.sourceImage;
      });
      if (!loaded) return 'Couldn’t load the photo.';
      photoRef.current = img;
    }
    const rows = doc.base.length;
    const cols = doc.base[0]?.length ?? 0;
    const area = photoArea({ boardConfig: { ...draft.boardConfig, widthPegs: cols, heightPegs: rows }, boardPadding: doc.pad });
    const photo = sampleAdjustedGrid({
      image: photoRef.current,
      cropRect: draft.cropRect,
      widthPegs: area.width,
      heightPegs: area.height,
      preprocess: draft.preprocessSettings,
      samplingMode: draft.samplingMode,
    });
    const ids = new Set(group.colors.map((c) => c.id));
    const cells: FamilyCell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = doc.base[r][c];
        const pr = r - area.padding.top;
        const pc = c - area.padding.left;
        if (id && ids.has(id) && photo[pr]?.[pc]) cells.push({ row: r, col: c, rgb: photo[pr][pc] });
      }
    }
    const result = pickAddition(cells, group.colors, pool);
    if (!result) return `None of those colors would improve the ${group.label.toLowerCase()} — nothing added.`;
    let changed = 0;
    const base = doc.base.map((row, r) =>
      row.map((id, c) => {
        const next = result.assignment.get(`${r},${c}`);
        if (next && next !== id) {
          changed++;
          return next;
        }
        return id;
      }),
    );
    activeBatchRef.current = null;
    setFamilyPreview(null);
    pushStep({ ...doc, base }, `Added ${result.added.name} to ${group.label.toLowerCase()}`, changed);
    return `Added ${result.added.name} — ${changed} beads re-split.`;
  }

  async function handleDone() {
    if (!draft) return;
    const finalWidth = doc.base[0]?.length ?? draft.boardConfig.widthPegs;
    const finalHeight = doc.base.length || draft.boardConfig.heightPegs;
    const boardConfig = { ...draft.boardConfig, widthPegs: finalWidth, heightPegs: finalHeight };
    // Swaps applied (and not since undone) this session get added to the
    // pattern's persistent colorSwaps list, so a later slider/palette
    // change on Adjust re-applies them instead of silently reverting them.
    const sessionSwaps = history
      .slice(0, pointer + 1)
      .flatMap((s) => (s.swapFromId && s.swapToId ? [{ from: s.swapFromId, to: s.swapToId }] : (s.swaps ?? [])));
    const colorSwaps = [...(draft.colorSwaps ?? []), ...sessionSwaps];
    const layered = { gridData: doc.base, layers: doc.layers, baseVisible: doc.baseVisible, boardPadding: doc.pad };
    const updated = { ...draft, ...layered, boardConfig, colorSwaps, updatedAt: Date.now() };
    // What's on the board now is the truth — don't let Adjust re-match over
    // it just because the board changed shape (extended, rotated).
    markGridCurrent(updated, state.collections);
    dispatch({ type: 'draft/update', patch: { ...layered, boardConfig, colorSwaps } });
    await savePattern(updated);
    dispatch({ type: 'library/upsert', pattern: updated });
    dispatch({ type: 'nav', screen: 'adjust' });
  }

  const currentColorBead = currentColor ? beadById(currentColor) : undefined;
  const currentColorCount = usage.find((u) => u.beadId === currentColor)?.count ?? 0;

  // ---- Swap-Find view ----
  if (view === 'swap-find') {
    const sourceBead = swapSourceId ? beadById(swapSourceId) : undefined;
    const sourceCount = swapSourceId ? activeUsage.find((u) => u.beadId === swapSourceId)?.count ?? 0 : 0;
    return (
      <div className="screen screen--cream edit__screen">
        <WizardBar
          left={
            <button type="button" onClick={() => setView('edit')}>
              CANCEL
            </button>
          }
          center={<span className="type-eyebrow">{replaceMode === 'merge' ? 'MERGE' : 'SWAP'} · 1 OF 2</span>}
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
          <div className="type-eyebrow">
            {replaceMode === 'merge' ? 'TAP THE COLOR TO MERGE AWAY' : 'TAP A COLOR TO FIND IT'}
          </div>
          <div className="edit__palette-grid">
            {activeUsage.map(({ beadId: id }) => {
              const bead = beadById(id);
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
    const sourceBead = swapSourceId ? beadById(swapSourceId) : undefined;
    const targetBead = swapTargetId ? beadById(swapTargetId) : undefined;
    const sourceCount = swapSourceId ? usage.find((u) => u.beadId === swapSourceId)?.count ?? 0 : 0;
    return (
      <div className="screen screen--cream edit__screen">
        <WizardBar
          left={
            <button type="button" onClick={() => setView('swap-find')}>
              BACK
            </button>
          }
          center={<span className="type-eyebrow">{replaceMode === 'merge' ? 'MERGE' : 'SWAP'} · 2 OF 2</span>}
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
            {replaceMode === 'merge'
              ? 'MERGE INTO — A COLOR ALREADY IN YOUR DESIGN'
              : `SWAP IN — FROM ${(state.collections.find((c) => c.id === draft.collectionId) ?? state.collections[0])?.name?.toUpperCase() ?? 'MY COLLECTION'}`}
          </div>
          <div className="edit__palette-grid">
            {(replaceMode === 'merge'
              ? usage.filter((u) => u.beadId !== swapSourceId).flatMap((u) => {
                  const bead = beadById(u.beadId);
                  return bead ? [bead] : [];
                })
              : (state.collections.find((c) => c.id === draft.collectionId)?.beads ?? state.collections[0]?.beads ?? [])
            ).map((bead) => (
              <button
                key={bead.id}
                type="button"
                className={`edit__swatch${bead.id === swapTargetId ? ' edit__swatch--selected' : ''}`}
                style={{ background: bead.hex }}
                onClick={() => setSwapTargetId(bead.id)}
              >
                <span>{beadById(bead.id)?.symbol ?? ''}</span>
              </button>
            ))}
          </div>
          <div className="edit__swap-actions">
            <PillButton variant="secondary" onClick={() => setView('edit')} style={{ width: 112 }}>
              CANCEL
            </PillButton>
            <PillButton onClick={applySwap} disabled={!swapTargetId} style={{ flex: 1 }}>
              {replaceMode === 'merge' ? 'APPLY MERGE' : 'APPLY SWAP'}
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
        <button type="button" className="edit__tool-pill" onClick={() => openSwapFind('swap')}>
          SWAP
        </button>
        <button type="button" className="edit__tool-pill" onClick={() => openSwapFind('merge')}>
          MERGE
        </button>
        <button type="button" className="edit__glyph-btn" onClick={handleRotate} aria-label="Rotate">
          ⟳
        </button>
        <button type="button" className="edit__glyph-btn" onClick={handleFlip} aria-label="Flip">
          ⇄
        </button>
      </div>

      <div
        ref={viewportRef}
        className="edit__viewport"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas
          ref={canvasRef}
          className="edit__canvas"
          // Drag-painting needs one-finger drags delivered to the canvas
          // instead of scrolling the page; taps-only mode leaves scrolling alone.
          style={dragPaint ? { touchAction: 'none' } : undefined}
          onPointerDown={handleCanvasClick}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={() => {
            setHoverPointer(null);
            endStroke();
          }}
        />
      </div>

      <ActualSizeBar board={draft.boardConfig} className="edit__actual-size" />

      {hoverPointer && (
        <div className="edit__hover-readout" style={{ left: hoverPointer.x + 16, top: hoverPointer.y - 10 }}>
          <span
            className="edit__hover-swatch"
            style={{ background: beadById(grid[hoverPointer.row]?.[hoverPointer.col] ?? '')?.hex ?? 'transparent' }}
          />
          {hoverPointer.row},{hoverPointer.col} →{' '}
          {beadById(grid[hoverPointer.row]?.[hoverPointer.col] ?? '')?.name.toUpperCase() ?? 'EMPTY'}
        </div>
      )}
    </div>
  );

  const panelContent = (
    <>
      <SegmentedControl
        size="compact"
        options={[
          { value: 'palette', label: 'PALETTE' },
          { value: 'colors', label: 'COLORS' },
          { value: 'board', label: 'BOARD' },
        ]}
        value={panelTab}
        onChange={(tab) => {
          setPanelTab(tab);
          setFamilyPreview(null);
        }}
      />

      {panelTab === 'palette' && (
        <>
        <div className="edit__drag-row">
          <div>
            <div className="type-row-label">PAINT BY DRAGGING</div>
            <div className="type-meta">
              {dragPaint ? 'Hold and slide across squares · 2 fingers to zoom/pan' : 'Off — tap squares one at a time'}
            </div>
          </div>
          <Toggle checked={dragPaint} onChange={updateDragPaint} />
        </div>

        <div className="edit__layers">
          <div className="edit__palette-header">
            <span className="type-eyebrow">LAYERS · {doc.layers.length + 1}</span>
            <button type="button" className="adjust__link" onClick={addLayer}>
              ADD LAYER +
            </button>
          </div>
          {[
            ...[...doc.layers].reverse().map((l) => ({ id: l.id, name: l.name, visible: l.visible, beads: gridStats(l.grid).beadCount })),
            { id: BASE_ID, name: 'PHOTO', visible: doc.baseVisible, beads: gridStats(doc.base).beadCount },
          ].map((row) => {
            const active = row.id === activeLayerId;
            return (
              <div key={row.id} className={`edit__layer-row${active ? ' edit__layer-row--active' : ''}`}>
                <button
                  type="button"
                  className="edit__layer-eye"
                  aria-label={`${row.visible ? 'Hide' : 'Show'} ${row.name}`}
                  aria-pressed={row.visible}
                  onClick={() => toggleLayer(row.id)}
                >
                  <EyeIcon open={row.visible} />
                </button>
                <button type="button" className="edit__layer-main" onClick={() => selectLayer(row.id)}>
                  <span className="edit__layer-name">{row.name}</span>
                  <span className="type-meta">{row.beads} beads</span>
                </button>
                {active && row.id !== BASE_ID && (
                  <>
                    <button type="button" className="adjust__link" onClick={() => renameLayer(row.id)}>
                      RENAME
                    </button>
                    <button type="button" className="adjust__link" onClick={() => deleteLayer(row.id)}>
                      DELETE
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {!activeVisible && (
            <p className="type-meta edit__layers-note">This layer is hidden — turn it on to paint on it.</p>
          )}
        </div>

        <div className="edit__palette-header">
          <span className="type-eyebrow">ACTIVE PALETTE · {paletteIds.length}</span>
          <button type="button" className="adjust__link" onClick={() => setCatalogOpen(true)}>
            CATALOG +
          </button>
        </div>
        <div className="edit__palette-grid">
          {paletteIds.map((id) => {
            const bead = beadById(id);
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
      )}

      {panelTab === 'colors' && (
        <>
        <ColorFamiliesPanel
          families={families}
          palettePool={palettePool}
          anyPool={anyPool}
          paletteName={draft.paletteMode === 'collection' && familyCollection ? familyCollection.name : 'the bead catalog'}
          onPreview={setFamilyPreview}
          onApply={applyFamilyMap}
          onAdd={addFamilyColor}
        />
        </>
      )}

      {panelTab === 'board' && (
        <>
        <div className="edit__extend">
          <div className="edit__palette-header">
            <span className="type-eyebrow">
              EXTEND BOARD · {doc.base[0]?.length ?? 0}×{doc.base.length}
            </span>
          </div>
          <div className="edit__extend-grid">
            {EXTEND_SIDES.map(({ side, label }) => (
              <div key={side} className="edit__extend-row">
                <span className="type-row-label edit__extend-label">{label}</span>
                <button
                  type="button"
                  className="edit__extend-btn"
                  disabled={doc.pad[side] <= 0}
                  onClick={() => extendBoard(side, -1)}
                  aria-label={`Remove a ${side === 'top' || side === 'bottom' ? 'row' : 'column'} from the ${side}`}
                >
                  −
                </button>
                <span className="type-numeric edit__extend-count">{doc.pad[side]}</span>
                <button
                  type="button"
                  className="edit__extend-btn"
                  onClick={() => extendBoard(side, 1)}
                  aria-label={`Add a ${side === 'top' || side === 'bottom' ? 'row' : 'column'} on the ${side}`}
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <p className="type-meta edit__extend-note">Adds empty rows or columns — your design and painted beads stay put.</p>
        </div>
        </>
      )}
    </>
  );

  return (
    <div className="screen screen--cream edit__screen edit__screen--main">
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
            {actualCellSize ? (
              <span className="type-eyebrow">ACTUAL SIZE</span>
            ) : zoomCellSize === null ? (
              <span className="type-eyebrow">FIT</span>
            ) : (
              <button type="button" className="edit__zoom-reset" onClick={() => setZoomCellSize(null)} aria-label="Fit to screen">
                {Math.round((cellSize / fitCellSize) * 100)}% · FIT
              </button>
            )}
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

      <EditorLayout stage={stage} panelContent={panelContent} pinnedStage />

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
                const g = history[pointer] ? flatten(history[pointer].doc) : flat;
                const cols = g[0]?.length ?? 1;
                const rows = g.length || 1;
                const cs = 145 / Math.max(cols, rows);
                el.width = cols * cs;
                el.height = rows * cs;
                const ctx = el.getContext('2d');
                if (ctx) renderGrid(ctx, { grid: g, cellSize: cs, getBead: beadById, gridlines: false, symbolOverlay: false, surface: 'light' });
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
