import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { CropRect } from '../../db/schema';
import './CropSheet.css';

interface CropSheetProps {
  sourceImage: string;
  cropRect: CropRect;
  /** widthPegs / heightPegs — the crop window's shape. */
  boardAspect: number;
  onApply: (cropRect: CropRect, rotatedSourceImage?: string) => void;
  onClose: () => void;
}

const STAGE_MAX = 320;

function isSentinelCrop(c: CropRect): boolean {
  return c.x === 0 && c.y === 0 && c.width === 1 && c.height === 1;
}

/**
 * Full-screen "frame your photo to the board" tool — pinch/pan/zoom/rotate.
 * Nothing here is automatic: the user decides the crop, and can reopen this
 * at any time from Adjust to change their mind.
 */
export function CropSheet({ sourceImage, cropRect, boardAspect, onApply, onClose }: CropSheetProps) {
  const [workingImage, setWorkingImage] = useState(sourceImage);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ x: number; y: number } | null>(null);
  const pinchState = useRef<{ dist: number; scale: number } | null>(null);
  const imgElRef = useRef<HTMLImageElement>(null);

  const cropBoxW = boardAspect >= 1 ? STAGE_MAX : STAGE_MAX * boardAspect;
  const cropBoxH = boardAspect >= 1 ? STAGE_MAX / boardAspect : STAGE_MAX;

  const baseScale = imageSize ? Math.max(cropBoxW / imageSize.width, cropBoxH / imageSize.height) : 1;
  const displayedW = imageSize ? imageSize.width * baseScale * scale : 0;
  const displayedH = imageSize ? imageSize.height * baseScale * scale : 0;

  // baseScale ("cover") always touches the box on the tighter dimension
  // while overflowing the other — a photo and board with mismatched
  // aspect ratios can need to shrink well past that before the looser
  // dimension also drops below the box (revealing padding there too).
  // A fixed zoom-out floor isn't always low enough to reach that point,
  // so derive it from how far this particular photo/board pairing needs.
  const containRelScale = imageSize
    ? Math.min(cropBoxW / imageSize.width, cropBoxH / imageSize.height) / baseScale
    : 1;
  const MIN_SCALE = imageSize ? Math.min(0.25, containRelScale * 0.5) : 0.25;

  function clampOffset(o: { x: number; y: number }, dW: number, dH: number) {
    const maxX = Math.max(0, (dW - cropBoxW) / 2);
    const maxY = Math.max(0, (dH - cropBoxH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  }

  // Start from wherever the existing crop already was, so reopening this
  // tool to nudge the framing doesn't reset everything.
  useEffect(() => {
    if (!imageSize) return;
    if (isSentinelCrop(cropRect)) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const s = Math.min(4, Math.max(MIN_SCALE, cropBoxW / cropRect.width / (imageSize.width * baseScale)));
    const dw = imageSize.width * baseScale * s;
    const dh = imageSize.height * baseScale * s;
    setScale(s);
    setOffset(
      clampOffset(
        { x: dw / 2 - cropBoxW / 2 - cropRect.x * dw, y: dh / 2 - cropBoxH / 2 - cropRect.y * dh },
        dw,
        dh,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSize]);

  function resetFraming() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
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
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(e: ReactPointerEvent) {
    dragState.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!dragState.current || !imageSize) return;
    const next = { x: e.clientX - dragState.current.x, y: e.clientY - dragState.current.y };
    setOffset(clampOffset(next, displayedW, displayedH));
  }
  function onPointerUp() {
    dragState.current = null;
  }

  function touchDist(touches: ReactTouchEvent['touches']) {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function onTouchStart(e: ReactTouchEvent) {
    if (e.touches.length === 2) pinchState.current = { dist: touchDist(e.touches), scale };
  }
  function onTouchMove(e: ReactTouchEvent) {
    if (e.touches.length === 2 && pinchState.current && imageSize) {
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinchState.current.dist;
      const nextScale = Math.min(4, Math.max(MIN_SCALE, pinchState.current.scale * ratio));
      setScale(nextScale);
      const dW = imageSize.width * baseScale * nextScale;
      const dH = imageSize.height * baseScale * nextScale;
      setOffset((o) => clampOffset(o, dW, dH));
    }
  }
  function onTouchEnd(e: ReactTouchEvent) {
    if (e.touches.length < 2) pinchState.current = null;
  }
  function onWheel(e: ReactWheelEvent) {
    if (!imageSize) return;
    e.preventDefault();
    const nextScale = Math.min(4, Math.max(MIN_SCALE, scale - e.deltaY * 0.002));
    setScale(nextScale);
    const dW = imageSize.width * baseScale * nextScale;
    const dH = imageSize.height * baseScale * nextScale;
    setOffset((o) => clampOffset(o, dW, dH));
  }

  function handleDone() {
    if (!imageSize) return;
    const relX = displayedW / 2 - cropBoxW / 2 - offset.x;
    const relY = displayedH / 2 - cropBoxH / 2 - offset.y;
    const newCropRect: CropRect = {
      x: relX / displayedW,
      y: relY / displayedH,
      width: cropBoxW / displayedW,
      height: cropBoxH / displayedH,
    };
    onApply(newCropRect, workingImage !== sourceImage ? workingImage : undefined);
  }

  return (
    <div className="crop-sheet">
      <div className="crop-sheet__bar">
        <button type="button" onClick={onClose}>
          CANCEL
        </button>
        <span className="type-eyebrow">FRAME PHOTO</span>
        <button type="button" className="crop-sheet__done" onClick={handleDone}>
          DONE
        </button>
      </div>

      <div
        className="crop-sheet__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        <img
          ref={imgElRef}
          src={workingImage}
          alt=""
          draggable={false}
          className="crop-sheet__image"
          style={{
            width: displayedW || 'auto',
            height: displayedH || 'auto',
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
          }}
          onLoad={(e) => {
            if (!imageSize) {
              const img = e.currentTarget;
              setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
        />
        <div className="crop-sheet__scrim" />
        <div className="crop-sheet__window" style={{ width: cropBoxW, height: cropBoxH }}>
          <div className="crop-sheet__thirds" />
          <span className="crop-sheet__bracket crop-sheet__bracket--tl" />
          <span className="crop-sheet__bracket crop-sheet__bracket--tr" />
          <span className="crop-sheet__bracket crop-sheet__bracket--bl" />
          <span className="crop-sheet__bracket crop-sheet__bracket--br" />
        </div>
      </div>

      <div className="crop-sheet__controls">
        <button type="button" className="crop-sheet__control-btn" onClick={rotate}>
          ⟳ ROTATE
        </button>
        <button type="button" className="crop-sheet__control-btn" onClick={resetFraming}>
          RESET
        </button>
      </div>
      <p className="type-body crop-sheet__caption">Pinch or scroll to zoom, drag to reposition. Zoom out past the edge to pad with white space.</p>
    </div>
  );
}
