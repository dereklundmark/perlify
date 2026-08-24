import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { PhotoCropSheet } from './PhotoCropSheet';
import './Photo.css';

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
 * Picking a photo, then trimming it (PhotoCropSheet) — a plain edge/corner
 * crop, no board-shape awareness. Fitting the trimmed photo to the board's
 * actual aspect ratio happens later, on Board Setup (PegboardCropSheet),
 * once a board size exists to fit into.
 */
export function Photo() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [photoCropOpen, setPhotoCropOpen] = useState(false);

  if (!draft) return null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    try {
      const { dataUrl } = await downsizeToDataUrl(file, MAX_SOURCE_DIM);
      dispatch({
        type: 'draft/update',
        patch: { sourceImage: dataUrl, cropRect: { x: 0, y: 0, width: 1, height: 1 } },
      });
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    setPhotoCropOpen(true);
  }

  function applyPhotoCrop(newSourceImage: string) {
    dispatch({
      type: 'draft/update',
      patch: { sourceImage: newSourceImage, cropRect: { x: 0, y: 0, width: 1, height: 1 } },
    });
    setPhotoCropOpen(false);
    dispatch({ type: 'nav', screen: 'adjust' });
  }

  const hasImage = !!draft.sourceImage;

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
          <button type="button" className="photo__perlify-btn" disabled={!hasImage || loading} onClick={confirm}>
            {loading ? 'LOADING…' : 'PERLIFY'}
          </button>
        }
      />

      <div className="screen__body photo__body">
        <div className="photo__stage">
          {draft.sourceImage && <img src={draft.sourceImage} alt="" className="photo__image" />}
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

      {photoCropOpen && draft.sourceImage && (
        <PhotoCropSheet
          sourceImage={draft.sourceImage}
          onApply={applyPhotoCrop}
          onClose={() => setPhotoCropOpen(false)}
        />
      )}
    </div>
  );
}
