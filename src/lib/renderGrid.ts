import { relativeLuminance, hexToRgb, rgbToHex, type RGB } from './color';
import type { GridData } from './grid';

export interface BeadLookupEntry {
  hex: string;
  symbol?: string;
}

export interface RenderGridOptions {
  grid: GridData;
  cellSize: number;
  getBead: (beadId: string) => BeadLookupEntry | undefined;
  gridlines: boolean;
  symbolOverlay: boolean;
  /** Which surface the grid sits on — almost always 'light' now (the grid always sits in a white/cream frame); 'dark' remains for the few contexts that still go dark. */
  surface: 'dark' | 'light';
  heavyLineEvery?: number;
  background?: string;
  /** Interlocked physical boards this pattern spans — draws a seam line at each interior boundary. */
  boardsWide?: number;
  boardsHigh?: number;
  seamLines?: boolean;
  /** Swap-Find "isolate" mode: one color at full strength, everything else faded toward a background color. */
  isolate?: { beadId: string; fadeToward: string; fadePct: number };
  /** Bead ids to outline in red (Swap-Choose's live preview of changed cells). */
  outlineChanged?: Set<string>;
}

const SYMBOL_LUMINANCE_THRESHOLD = 0.55;

function mix(hex: string, toward: string, pct: number): RGB {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  return {
    r: a.r + (b.r - a.r) * pct,
    g: a.g + (b.g - a.g) * pct,
    b: a.b + (b.b - a.b) * pct,
  };
}

/**
 * Bead rendering recipe per perlify-design-handoff/README.md "Assets":
 * flat color square; a soft dark circle as the bead hole once cells are
 * large enough to read one; gridlines with a heavier rule every 10 cells;
 * an optional symbol glyph colored for contrast against its own bead.
 */
export function renderGrid(ctx: CanvasRenderingContext2D, options: RenderGridOptions): void {
  const { grid, cellSize, getBead, gridlines, symbolOverlay, surface, background, isolate, outlineChanged } = options;
  const heavyEvery = options.heavyLineEvery ?? 10;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const width = cols * cellSize;
  const height = rows * cellSize;

  ctx.clearRect(0, 0, width, height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  const emptyStroke = surface === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(18,16,12,0.17)';
  const holeFill = 'rgba(0,0,0,0.14)';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const beadId = grid[row][col];
      const x = col * cellSize;
      const y = row * cellSize;

      if (beadId === null) {
        const r = cellSize * 0.32;
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, r, 0, Math.PI * 2);
        ctx.strokeStyle = emptyStroke;
        ctx.lineWidth = 1;
        ctx.stroke();
        continue;
      }

      const bead = getBead(beadId);
      if (!bead) continue;

      let fillHex = bead.hex;
      if (isolate && beadId !== isolate.beadId) {
        const { r, g, b } = mix(bead.hex, isolate.fadeToward, isolate.fadePct);
        fillHex = rgbToHex({ r, g, b });
      }

      ctx.fillStyle = fillHex;
      ctx.fillRect(x, y, cellSize, cellSize);

      if (cellSize >= 9) {
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = holeFill;
        ctx.fill();
      }

      if (outlineChanged?.has(`${row},${col}`)) {
        ctx.strokeStyle = '#e8533f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, y + 0.75, cellSize - 1.5, cellSize - 1.5);
      }

      if (symbolOverlay && bead.symbol) {
        const luminance = relativeLuminance(hexToRgb(fillHex));
        ctx.fillStyle = luminance > SYMBOL_LUMINANCE_THRESHOLD ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.85)';
        ctx.font = `600 ${Math.round(cellSize * 0.56)}px Archivo, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bead.symbol, x + cellSize / 2, y + cellSize / 2 + cellSize * 0.02);
      }
    }
  }

  if (gridlines) {
    const lightColor = 'rgba(0,0,0,0.13)';
    const darkColor = 'rgba(255,255,255,0.13)';
    const lightHeavy = 'rgba(0,0,0,0.32)';
    const darkHeavy = 'rgba(255,255,255,0.32)';
    const normal = surface === 'dark' ? darkColor : lightColor;
    const heavy = surface === 'dark' ? darkHeavy : lightHeavy;

    for (let col = 0; col <= cols; col++) {
      const x = col * cellSize;
      ctx.strokeStyle = col % heavyEvery === 0 ? heavy : normal;
      ctx.lineWidth = col % heavyEvery === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      const y = row * cellSize;
      ctx.strokeStyle = row % heavyEvery === 0 ? heavy : normal;
      ctx.lineWidth = row % heavyEvery === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  const boardsWide = options.boardsWide ?? 1;
  const boardsHigh = options.boardsHigh ?? 1;
  if (options.seamLines && (boardsWide > 1 || boardsHigh > 1)) {
    ctx.strokeStyle = surface === 'dark' ? '#ffffff' : '#12100c';
    ctx.lineWidth = 3;
    for (let b = 1; b < boardsWide; b++) {
      const x = Math.round((cols / boardsWide) * b * cellSize);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let b = 1; b < boardsHigh; b++) {
      const y = Math.round((rows / boardsHigh) * b * cellSize);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
}
