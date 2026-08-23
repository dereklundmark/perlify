import { jsPDF } from 'jspdf';
import type { Pattern } from '../db/schema';
import { catalogBeadById } from './catalog';
import { beadUsage, gridStats } from './grid';
import type { GridData } from './grid';
import { renderGrid } from './renderGrid';
import { shareOrDownloadBlob } from './save';

const PAGE_W_MM = 210; // A4
const PAGE_H_MM = 297;
const MARGIN_MM = 15;
const PRINT_CELL_PX = 24; // render resolution before scaling into the page
const CONTENT_W = PAGE_W_MM - MARGIN_MM * 2;

function renderGridPng(
  grid: GridData,
  opts: { gridlines: boolean; symbolOverlay: boolean },
): { dataUrl: string; widthPx: number; heightPx: number } {
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  const widthPx = cols * PRINT_CELL_PX;
  const heightPx = rows * PRINT_CELL_PX;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  renderGrid(ctx, {
    grid,
    cellSize: PRINT_CELL_PX,
    getBead: catalogBeadById,
    gridlines: opts.gridlines,
    symbolOverlay: opts.symbolOverlay,
    surface: 'light',
    background: '#ffffff',
  });

  return { dataUrl: canvas.toDataURL('image/png'), widthPx, heightPx };
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Draws the grid image + a self-paginating bead legend for `grid`, starting a fresh page first. */
function drawBoardPage(
  doc: jsPDF,
  grid: GridData,
  pattern: Pattern,
  title: string,
  metaLine: string,
): void {
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(title, MARGIN_MM, MARGIN_MM);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(metaLine, MARGIN_MM, MARGIN_MM + 6);

  const { dataUrl, widthPx, heightPx } = renderGridPng(grid, {
    gridlines: pattern.gridlines,
    symbolOverlay: pattern.symbolOverlay,
  });
  const aspect = heightPx / widthPx;
  let imgW = CONTENT_W;
  let imgH = imgW * aspect;
  const maxImgH = 150;
  if (imgH > maxImgH) {
    imgH = maxImgH;
    imgW = imgH / aspect;
  }
  const imgX = MARGIN_MM + (CONTENT_W - imgW) / 2;
  const imgY = MARGIN_MM + 12;
  doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH);

  drawLegend(doc, grid, imgY + imgH + 10);
}

/** Self-paginating bead legend (swatch, symbol, name, proportion bar, count) for `grid`. */
function drawLegend(doc: jsPDF, grid: GridData, startY: number): void {
  const stats = gridStats(grid);
  const usage = beadUsage(grid);
  const maxCount = usage[0]?.count ?? 1;
  let y = startY;

  const addLegendHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text('BEAD LEGEND', MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `${stats.beadCount} TOTAL${stats.emptyCount ? ` · ${stats.emptyCount} EMPTY` : ''}`,
      PAGE_W_MM - MARGIN_MM,
      y,
      { align: 'right' },
    );
    y += 6;
  };
  addLegendHeader();

  const rowH = 6.5;
  const swatchSize = 4;
  const barMaxW = 22;

  for (const { beadId, count } of usage) {
    if (y > PAGE_H_MM - MARGIN_MM) {
      doc.addPage();
      y = MARGIN_MM;
      addLegendHeader();
    }

    const bead = catalogBeadById(beadId);
    const [r, g, b] = hexToRgbTuple(bead?.hex ?? '#999999');

    doc.setFillColor(r, g, b);
    doc.setDrawColor(210);
    doc.rect(MARGIN_MM, y - swatchSize + 1.5, swatchSize, swatchSize, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(bead?.symbol ?? '?', MARGIN_MM + swatchSize + 4, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(20);
    doc.text(bead?.name ?? beadId, MARGIN_MM + swatchSize + 12, y);

    const barX = PAGE_W_MM - MARGIN_MM - barMaxW - 14;
    const barW = Math.max(1, (count / maxCount) * barMaxW);
    doc.setFillColor(230, 230, 230);
    doc.rect(barX, y - 2.4, barMaxW, 2, 'F');
    doc.setFillColor(150, 150, 150);
    doc.rect(barX, y - 2.4, barW, 2, 'F');

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text(String(count), PAGE_W_MM - MARGIN_MM, y, { align: 'right' });

    y += rowH;
  }
}

/** Slices `grid` to just the region covered by board (bx, by) in a boardsWide x boardsHigh layout. */
function boardSlice(grid: GridData, boardsWide: number, boardsHigh: number, bx: number, by: number): GridData {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const rowStart = Math.round((rows / boardsHigh) * by);
  const rowEnd = Math.round((rows / boardsHigh) * (by + 1));
  const colStart = Math.round((cols / boardsWide) * bx);
  const colEnd = Math.round((cols / boardsWide) * (bx + 1));
  return grid.slice(rowStart, rowEnd).map((row) => row.slice(colStart, colEnd));
}

export function buildPatternPdf(pattern: Pattern): Blob {
  const { boardsWide, boardsHigh } = pattern.boardConfig;
  const multiBoard = boardsWide * boardsHigh > 1;
  const stats = gridStats(pattern.gridData);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const metaLine = `${pattern.boardConfig.widthPegs} x ${pattern.boardConfig.heightPegs} pegs · ${
    pattern.boardConfig.beadType === 'regular' ? 'Midi' : 'Mini'
  } · ${stats.beadCount} beads · ${stats.colorCount} colors${multiBoard ? ` · ${boardsWide * boardsHigh} boards` : ''}`;

  // Overview page: full grid + combined legend.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(pattern.name || 'Untitled pattern', MARGIN_MM, MARGIN_MM);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(metaLine, MARGIN_MM, MARGIN_MM + 6);

  const { dataUrl, widthPx, heightPx } = renderGridPng(pattern.gridData, {
    gridlines: pattern.gridlines,
    symbolOverlay: pattern.symbolOverlay,
  });
  const aspect = heightPx / widthPx;
  let imgW = CONTENT_W;
  let imgH = imgW * aspect;
  const maxImgH = 150;
  if (imgH > maxImgH) {
    imgH = maxImgH;
    imgW = imgH / aspect;
  }
  const imgX = MARGIN_MM + (CONTENT_W - imgW) / 2;
  const imgY = MARGIN_MM + 12;
  doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH);
  drawLegend(doc, pattern.gridData, imgY + imgH + 10);

  // One page per physical board, each with its own legend, per the handoff's
  // "beads per board are counted separately" / "split PDF per board".
  if (multiBoard) {
    let boardNum = 1;
    for (let by = 0; by < boardsHigh; by++) {
      for (let bx = 0; bx < boardsWide; bx++) {
        const slice = boardSlice(pattern.gridData, boardsWide, boardsHigh, bx, by);
        const sliceStats = gridStats(slice);
        drawBoardPage(
          doc,
          slice,
          pattern,
          `Board ${boardNum} of ${boardsWide * boardsHigh}`,
          `${slice[0]?.length ?? 0} x ${slice.length} pegs · ${sliceStats.beadCount} beads`,
        );
        boardNum++;
      }
    }
  }

  return doc.output('blob');
}

export async function exportPatternPdf(pattern: Pattern): Promise<void> {
  const blob = buildPatternPdf(pattern);
  const safeName = pattern.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pattern';
  await shareOrDownloadBlob(blob, `${safeName}.pdf`);
}
