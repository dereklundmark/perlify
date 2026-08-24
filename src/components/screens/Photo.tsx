import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { CropRect } from '../../db/schema';
import './Photo.css';

const STAGE_SIZE = 340;
const MAX_SOURCE_DIM = 1600;

function downsizeToDataUrl(file: File, maxDim: number): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: w, height: h });
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Photo comes before board setup now, so there's no peg aspect to lock the
 * crop to yet — this starts as a plain square working frame. The Adjust
 * screen reflows it (see lib/crop.ts) once a board size is chosen.
 */
export function Photo() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ x: number; y: number } | null>(null);
  const pinchState = useRef<{ dist: number; scale: number } | null>(null);

  if (!draft) return null;

  const cropBoxW = STAGE_SIZE;
  const cropBoxH = STAGE_SIZE;

  const baseScale = imageSize ? Math.max(cropBoxW / imageSize.width, cropBoxH / imageSize.height) : 1;
  const displayedW = imageSize ? imageSize.width * baseScale * scale : 0;
  const displayedH = imageSize ? imageSize.height * baseScale * scale : 0;

  function clampOffset(o: { x: number; y: number }, dW: number, dH: number) {
    const maxX = Math.max(0, (dW - cropBoxW) / 2);
    const maxY = Math.max(0, (dH - cropBoxH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const { dataUrl, width, height } = await downsizeToDataUrl(file, MAX_SOURCE_DIM);
    setImageSize({ width, height });
    setScale(1);
    setOffset({ x: 0, y: 0 });
    dispatch({ type: 'draft/update', patch: { sourceImage: dataUrl } });
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
    if (e.touches.length === 2) {
      pinchState.current = { dist: touchDist(e.touches), scale };
    }
  }
  function onTouchMove(e: ReactTouchEvent) {
    if (e.touches.length === 2 && pinchState.current && imageSize) {
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinchState.current.dist;
      const nextScale = Math.min(4, Math.max(1, pinchState.current.scale * ratio));
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
    const nextScale = Math.min(4, Math.max(1, scale - e.deltaY * 0.002));
    setScale(nextScale);
    const dW = imageSize.width * baseScale * nextScale;
    const dH = imageSize.height * baseScale * nextScale;
    setOffset((o) => clampOffset(o, dW, dH));
  }

  function confirmCrop() {
    if (!imageSize) return;
    const relX = displayedW / 2 - cropBoxW / 2 - offset.x;
    const relY = displayedH / 2 - cropBoxH / 2 - offset.y;
    const cropRect: CropRect = {
      x: clamp01(relX / displayedW, cropBoxW / displayedW),
      y: clamp01(relY / displayedH, cropBoxH / displayedH),
      width: cropBoxW / displayedW,
      height: cropBoxH / displayedH,
    };
    dispatch({ type: 'draft/update', patch: { cropRect } });
    dispatch({ type: 'nav', screen: 'adjust' });
  }

  const hasImage = !!draft.sourceImage && !!imageSize;

  return (
    <div className="screen screen--cream">
      <WizardBar
        step={1}
        left={
          <button type="button" onClick={() => dispatch({ type: 'draft/discard' })}>
            Back
          </button>
        }
        right={
          <button type="button" className="photo__perlify-btn" disabled={!hasImage} onClick={confirmCrop}>
            PERLIFY
          </button>
        }
      />

      <div className="screen__body photo__body">
        <div
          className="photo__stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
        >
          {draft.sourceImage && (
            <img
              src={draft.sourceImage}
              alt=""
              draggable={false}
              className="photo__image"
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
          )}
          <div className="photo__scrim" />
          <div className="photo__crop-window" style={{ width: cropBoxW, height: cropBoxH }}>
            <div className="photo__thirds" />
          </div>
          {['tl', 'tr', 'bl', 'br'].map((corner) => (
            <span key={corner} className={`photo__bracket photo__bracket--${corner}`} />
          ))}
          {!draft.sourceImage && <div className="photo__placeholder type-body">Choose a photo to begin</div>}
        </div>

        <SegmentedControl
          options={[
            { value: 'roll', label: 'CAMERA ROLL' },
            { value: 'camera', label: 'TAKE PHOTO' },
          ]}
          value="roll"
          onChange={(v) => (v === 'roll' ? libraryInputRef.current?.click() : cameraInputRef.current?.click())}
        />

        <p className="type-body photo__caption">
          Nothing leaves the phone — you'll size this to your board next.
        </p>
      </div>

      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

function clamp01(v: number, size: number): number {
  return Math.min(Math.max(0, v), 1 - size);
}
