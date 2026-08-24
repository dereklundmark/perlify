import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import './PhotoCropSheet.css';

interface PhotoCropSheetProps {
  sourceImage: string;
  onApply: (newSourceImage: string) => void;
  onClose: () => void;
}

interface CropBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type HandleId = 't' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br';

const HANDLE_IDS: HandleId[] = ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'];
const STAGE_MAX_W = 340;
const STAGE_MAX_H = 460;
const MIN_FRAC = 0.08;
const FULL_CROP: CropBox = { x1: 0, y1: 0, x2: 1, y2: 1 };

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * Plain "trim this photo" tool — drag any edge (one boundary) or corner
 * (two boundaries) of the crop rectangle over a static, fully-visible
 * image. No pan/zoom and no board-shape awareness; that happens later,
 * in PegboardCropSheet, once a board size actually exists to fit into.
 */
export function PhotoCropSheet({ sourceImage, onApply, onClose }: PhotoCropSheetProps) {
  const [workingImage, setWorkingImage] = useState(sourceImage);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<CropBox>(FULL_CROP);
  const imgElRef = useRef<HTMLImageElement>(null);
  const activeHandle = useRef<HandleId | null>(null);
  const dragStart = useRef<{ x: number; y: number; crop: CropBox } | null>(null);

  const fitScale = imageSize ? Math.min(STAGE_MAX_W / imageSize.width, STAGE_MAX_H / imageSize.height, 1) : 0;
  const dispW = imageSize ? imageSize.width * fitScale : 0;
  const dispH = imageSize ? imageSize.height * fitScale : 0;

  const rectLeft = crop.x1 * dispW;
  const rectTop = crop.y1 * dispH;
  const rectRight = crop.x2 * dispW;
  const rectBottom = crop.y2 * dispH;
  const rectW = rectRight - rectLeft;
  const rectH = rectBottom - rectTop;

  function startDrag(handle: HandleId, clientX: number, clientY: number) {
    activeHandle.current = handle;
    dragStart.current = { x: clientX, y: clientY, crop };
  }

  function updateDrag(clientX: number, clientY: number) {
    const handle = activeHandle.current;
    const start = dragStart.current;
    if (!handle || !start || !dispW || !dispH) return;
    const dx = (clientX - start.x) / dispW;
    const dy = (clientY - start.y) / dispH;
    const next = { ...start.crop };
    if (handle.includes('l')) next.x1 = clamp(start.crop.x1 + dx, 0, start.crop.x2 - MIN_FRAC);
    if (handle.includes('r')) next.x2 = clamp(start.crop.x2 + dx, start.crop.x1 + MIN_FRAC, 1);
    if (handle.includes('t')) next.y1 = clamp(start.crop.y1 + dy, 0, start.crop.y2 - MIN_FRAC);
    if (handle.includes('b')) next.y2 = clamp(start.crop.y2 + dy, start.crop.y1 + MIN_FRAC, 1);
    setCrop(next);
  }

  function endDrag() {
    activeHandle.current = null;
    dragStart.current = null;
  }

  function makeHandleTouchStart(handle: HandleId) {
    return (e: ReactTouchEvent) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0];
      startDrag(handle, t.clientX, t.clientY);
    };
  }
  function makeHandleMouseDown(handle: HandleId) {
    return (e: ReactMouseEvent) => {
      e.stopPropagation();
      startDrag(handle, e.clientX, e.clientY);
    };
  }
  function onStageTouchMove(e: ReactTouchEvent) {
    if (!activeHandle.current || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    updateDrag(t.clientX, t.clientY);
  }
  function onStageTouchEnd() {
    endDrag();
  }
  function onStageMouseMove(e: ReactMouseEvent) {
    if (!activeHandle.current) return;
    updateDrag(e.clientX, e.clientY);
  }
  function onStageMouseUp() {
    endDrag();
  }

  function rotate() {
    const img = imgElRef.current;
    if (!img || !imageSize) return;
    const canvas = document.createElement('canvas');
    canvas.width = imageSize.height;
    canvas.height = imageSize.width;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -imageSize.width / 2, -imageSize.height / 2);
    setWorkingImage(canvas.toDataURL('image/jpeg', 0.92));
    setImageSize({ width: imageSize.height, height: imageSize.width });
    setCrop(FULL_CROP);
  }

  function handleDone() {
    const img = imgElRef.current;
    if (!img || !imageSize) return;
    const sx = crop.x1 * imageSize.width;
    const sy = crop.y1 * imageSize.height;
    const sw = (crop.x2 - crop.x1) * imageSize.width;
    const sh = (crop.y2 - crop.y1) * imageSize.height;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onApply(canvas.toDataURL('image/jpeg', 0.9));
  }

  const handlePositions: Record<HandleId, { x: number; y: number }> = {
    tl: { x: rectLeft, y: rectTop },
    tr: { x: rectRight, y: rectTop },
    bl: { x: rectLeft, y: rectBottom },
    br: { x: rectRight, y: rectBottom },
    t: { x: rectLeft + rectW / 2, y: rectTop },
    b: { x: rectLeft + rectW / 2, y: rectBottom },
    l: { x: rectLeft, y: rectTop + rectH / 2 },
    r: { x: rectRight, y: rectTop + rectH / 2 },
  };

  return (
    <div className="photo-crop">
      <div className="photo-crop__bar">
        <button type="button" onClick={onClose}>
          CANCEL
        </button>
        <span className="type-eyebrow">TRIM PHOTO</span>
        <button type="button" className="photo-crop__done" onClick={handleDone}>
          DONE
        </button>
      </div>

      <div
        className="photo-crop__stage"
        onTouchMove={onStageTouchMove}
        onTouchEnd={onStageTouchEnd}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onMouseLeave={onStageMouseUp}
      >
        <div className="photo-crop__frame" style={{ width: dispW, height: dispH }}>
          <img
            ref={imgElRef}
            src={workingImage}
            alt=""
            draggable={false}
            className="photo-crop__image"
            style={{ width: dispW, height: dispH }}
            onLoad={(e) => {
              const img = e.currentTarget;
              setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
            }}
          />

          <div className="photo-crop__scrim" style={{ left: 0, top: 0, width: '100%', height: rectTop }} />
          <div
            className="photo-crop__scrim"
            style={{ left: 0, top: rectBottom, width: '100%', height: dispH - rectBottom }}
          />
          <div className="photo-crop__scrim" style={{ left: 0, top: rectTop, width: rectLeft, height: rectH }} />
          <div
            className="photo-crop__scrim"
            style={{ left: rectRight, top: rectTop, width: dispW - rectRight, height: rectH }}
          />

          <div className="photo-crop__rect" style={{ left: rectLeft, top: rectTop, width: rectW, height: rectH }} />

          {HANDLE_IDS.map((id) => (
            <div
              key={id}
              className={`photo-crop__handle photo-crop__handle--${id.length === 1 ? 'edge' : 'corner'} photo-crop__handle--${id}`}
              style={{ left: handlePositions[id].x, top: handlePositions[id].y }}
              onTouchStart={makeHandleTouchStart(id)}
              onMouseDown={makeHandleMouseDown(id)}
            />
          ))}
        </div>
      </div>

      <div className="photo-crop__controls">
        <button type="button" className="photo-crop__control-btn" onClick={rotate}>
          ⟳ ROTATE
        </button>
        <button type="button" className="photo-crop__control-btn" onClick={() => setCrop(FULL_CROP)}>
          RESET
        </button>
      </div>
      <p className="type-body photo-crop__caption">Drag any edge or corner to trim the photo.</p>
    </div>
  );
}
