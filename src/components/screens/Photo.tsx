import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { SegmentedControl } from '../ui/SegmentedControl';
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
 * Just picking a photo now — no forced crop here. The whole photo is kept
 * as-is; framing it to the board (pan/zoom/rotate) happens in Adjust, once
 * a board shape actually exists to frame it against. See CropSheet.
 */
export function Photo() {
  const { state, dispatch } = useApp();
  const draft = state.draft;
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

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
    </div>
  );
}
