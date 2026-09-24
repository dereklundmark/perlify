import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { WizardBar } from '../ui/WizardBar';
import { PillButton } from '../ui/PillButton';
import { PhotoCropSheet } from './PhotoCropSheet';
import { computeDefaultBoardSize } from '../../lib/board';
import { cartoonify, preloadCartoonifyModel } from '../../lib/cartoonify';
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
  const [loading, setLoading] = useState(false);
  const [photoCropOpen, setPhotoCropOpen] = useState(false);
  const [cartoonifying, setCartoonifying] = useState(false);
  const [cartoonifyError, setCartoonifyError] = useState<string | null>(null);
  const [preCartoonImage, setPreCartoonImage] = useState<string | null>(null);

  // Warm up the model download as soon as this screen opens, so the first
  // CARTOONIFY tap doesn't have to wait for the ~16MB model on top of the
  // actual transform.
  useEffect(() => {
    preloadCartoonifyModel();
  }, []);

  if (!draft) return null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setPreCartoonImage(null);
    setCartoonifyError(null);
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

  async function handleCartoonify() {
    if (!draft?.sourceImage || cartoonifying) return;
    setCartoonifying(true);
    setCartoonifyError(null);
    try {
      const result = await cartoonify(draft.sourceImage);
      setPreCartoonImage(draft.sourceImage);
      dispatch({ type: 'draft/update', patch: { sourceImage: result } });
    } catch {
      setCartoonifyError('Could not cartoonify this photo — try a different one.');
    } finally {
      setCartoonifying(false);
    }
  }

  function handleRevertCartoonify() {
    if (!preCartoonImage) return;
    dispatch({ type: 'draft/update', patch: { sourceImage: preCartoonImage } });
    setPreCartoonImage(null);
  }

  function confirm() {
    setPhotoCropOpen(true);
  }

  function applyPhotoCrop(newSourceImage: string) {
    if (!draft) return;
    const img = new Image();
    img.onload = () => {
      // No fixed default board shape — size it to match the trimmed
      // photo's own aspect ratio, so the Adjust screen's live preview
      // never opens visibly squished before a real board size is chosen
      // on Board Setup.
      const { widthPegs, heightPegs } = computeDefaultBoardSize(img.naturalWidth / img.naturalHeight);
      dispatch({
        type: 'draft/update',
        patch: {
          sourceImage: newSourceImage,
          cropRect: { x: 0, y: 0, width: 1, height: 1 },
          boardConfig: { ...draft.boardConfig, widthPegs, heightPegs },
        },
      });
      setPhotoCropOpen(false);
      dispatch({ type: 'nav', screen: 'board' });
    };
    img.src = newSourceImage;
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

        <PillButton
          type="button"
          variant="secondary"
          style={{ width: '100%' }}
          onClick={() => libraryInputRef.current?.click()}
        >
          SELECT IMAGE
        </PillButton>

        {hasImage && (
          <PillButton
            type="button"
            variant="secondary"
            size="sm"
            style={{ alignSelf: 'center' }}
            disabled={cartoonifying}
            onClick={preCartoonImage ? handleRevertCartoonify : handleCartoonify}
          >
            {cartoonifying ? 'CARTOONIFYING…' : preCartoonImage ? '↺ REVERT TO ORIGINAL' : '✨ CARTOONIFY'}
          </PillButton>
        )}
        {cartoonifyError && <p className="type-body photo__cartoonify-error">{cartoonifyError}</p>}
      </div>

      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
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
