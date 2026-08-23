import { jsPDF } from 'jspdf';
import type { Pattern } from '../db/schema';
import { catalogBeadById } from './catalog';
import { beadUsage, gridStats } from './grid';
import { renderGrid } from './renderGrid';
import { shareOrDownloadBlob } from './save';

const PAGE_W_MM = 210; // A4
const PAGE_H_MM = 297;
const MARGIN_MM = 15;
const PRINT_CELL_PX = 24; // render resolution before scaling into the page

function renderGridPng(pattern: Pattern): { dataUrl: string; widthPx: number; heightPx: number } {
  const cols = pattern.boardConfig.widthPegs;
  const rows = pattern.boardConfig.heightPegs;
  const widthPx = cols * PRINT_CELL_PX;
  const heightPx = rows * PRINT_CELL_PX;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  renderGrid(ctx, {
    grid: pattern.gridData,
    cellSize: PRINT_CELL_PX,
    getBead: catalogBeadById,
    gridlines: pattern.gridlines,
    symbolOverlay: pattern.symbolOverlay,
    surface: 'light',
    background: '#ffffff',
  });

  return { dataUrl: canvas.toDataURL('image/png'), widthPx, heightPx };
}

export function buildPatternPdf(pattern: Pattern): Blob {
  const stats = gridStats(pattern.gridData);
  const usage = beadUsage(pattern.gridData);
  const maxCount = usage[0]?.count ?? 1;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const contentW = PAGE_W_MM - MARGIN_MM * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pattern.name || 'Untitled pattern', MARGIN_MM, MARGIN_MM);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  const meta = `${pattern.boardConfig.widthPegs} x ${pattern.boardConfig.heightPegs} pegs · ${
    pattern.boardConfig.beadType === 'regular' ? 'Midi' : 'Mini'
  } · ${stats.beadCount} beads · ${stats.colorCount} colors`;
  doc.text(meta, MARGIN_MM, MARGIN_MM + 6);

  const { dataUrl, widthPx, heightPx } = renderGridPng(pattern);
  const aspect = heightPx / widthPx;
  let imgW = contentW;
  let imgH = imgW * aspect;
  const maxImgH = 150; // leave room for the legend beneath on page 1
  if (imgH > maxImgH) {
    imgH = maxImgH;
    imgW = imgH / aspect;
  }
  const imgX = MARGIN_MM + (contentW - imgW) / 2;
  const imgY = MARGIN_MM + 12;
  doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH);

  let y = imgY + imgH + 10;

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

  return doc.output('blob');
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function exportPatternPdf(pattern: Pattern): Promise<void> {
  const blob = buildPatternPdf(pattern);
  const safeName = pattern.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pattern';
  await shareOrDownloadBlob(blob, `${safeName}.pdf`);
}
