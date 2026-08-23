import { useEffect, useRef } from 'react';
import type { GridData } from '../lib/grid';
import { catalogBeadById } from '../lib/catalog';
import { renderGrid } from '../lib/renderGrid';

interface PatternThumbnailProps {
  grid: GridData;
  size?: number;
}

export function PatternThumbnail({ grid, size = 160 }: PatternThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cols = grid[0]?.length ?? 1;
    const rows = grid.length || 1;
    const cellSize = size / Math.max(cols, rows);
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderGrid(ctx, {
      grid,
      cellSize,
      getBead: catalogBeadById,
      gridlines: false,
      symbolOverlay: false,
      surface: 'light',
      background: '#fffdf8',
    });
  }, [grid, size]);

  return <canvas ref={canvasRef} className="pattern-thumbnail" />;
}
