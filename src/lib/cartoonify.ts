// Client-side "cartoonify" using AnimeGAN (Hayao style), ported from
// TonyLianLong/AnimeGAN.js's generate.js. Runs entirely on-device via
// TensorFlow.js (WebGL) — the photo is never uploaded anywhere. Model files
// are self-hosted under public/animegan-model (see that folder's README).
//
// Non-commercial license only (TachibanaYoshino/AnimeGAN) — fine for
// Perlify's personal/family use, but would need the author's permission
// before any commercial use.
import * as tf from '@tensorflow/tfjs';

const MODEL_URL = `${import.meta.env.BASE_URL}animegan-model/model.json`;
// Longest side fed to the model. Inference cost scales with pixel count, and
// this keeps it fast/memory-safe on phones — the bead-matching pipeline
// downsamples far past this anyway, so there's no quality loss that matters.
const INFERENCE_MAX_DIM = 640;

let modelPromise: Promise<tf.GraphModel> | null = null;
let mirrorPadRegistered = false;

/**
 * The published model uses "reflect" padding, which tfjs's converter can't
 * run natively — the original web build works around this by registering a
 * custom MirrorPad op (slicing off the edge row/col and concatenating it
 * back on, since every pad width in this model is 0 or 1). Ported as-is to
 * match the model's known-good behavior.
 */
function registerMirrorPad() {
  if (mirrorPadRegistered) return;
  mirrorPadRegistered = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tf.registerOp('MirrorPad', (node: any) => {
    return tf.tidy(() => {
      const padTensor = node.inputs[1] as tf.Tensor;
      const padArr = padTensor.arraySync() as number[][];
      let input = node.inputs[0] as tf.Tensor4D;

      for (let i = 0; i < 4; i++) {
        const [padBefore, padAfter] = padArr[i];
        if (padBefore > 1 || padAfter > 1) {
          throw new Error(`Only padding of length <= 1 is supported. Got: ${JSON.stringify(padArr)}`);
        }
        if (padBefore === 0 && padAfter === 0) continue;

        const beginBefore = [0, 0, 0, 0];
        const sizeBefore = [-1, -1, -1, -1];
        sizeBefore[i] = padBefore;
        const edgeBefore = input.slice(beginBefore as [number, number, number, number], sizeBefore as [
          number,
          number,
          number,
          number,
        ]);

        const beginAfter = [0, 0, 0, 0];
        beginAfter[i] = input.shape[i] - padAfter;
        const sizeAfter = [-1, -1, -1, -1];
        sizeAfter[i] = padAfter;
        const edgeAfter = input.slice(beginAfter as [number, number, number, number], sizeAfter as [
          number,
          number,
          number,
          number,
        ]);

        input = tf.concat([edgeBefore, input, edgeAfter], i) as tf.Tensor4D;
      }
      return input;
    });
  });
}

function loadModel(): Promise<tf.GraphModel> {
  registerMirrorPad();
  if (!modelPromise) {
    modelPromise = tf.loadGraphModel(MODEL_URL);
  }
  return modelPromise;
}

/** Fire-and-forget warmup so the ~16MB model is already loading by the time the user taps CARTOONIFY. */
export function preloadCartoonifyModel(): void {
  loadModel().catch(() => {
    // Swallowed — the real call site (cartoonify()) will surface the error when the user actually tries it.
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Runs the source image through AnimeGAN and returns a new data URL. Never mutates the input. */
export async function cartoonify(sourceImage: string): Promise<string> {
  const [model, img] = await Promise.all([loadModel(), loadImage(sourceImage)]);

  const imgTensor = tf.browser.fromPixels(img);
  const [h, w] = imgTensor.shape;
  const longSide = Math.max(h, w);
  const scaleFactor = longSide / INFERENCE_MAX_DIM;
  const scaledSize: [number, number] = scaleFactor > 1 ? [Math.round(h / scaleFactor), Math.round(w / scaleFactor)] : [h, w];

  const inputTensor = tf.tidy(() => tf.image.resizeBilinear(imgTensor, scaledSize).expandDims(0).div(255) as tf.Tensor4D);
  imgTensor.dispose();

  // execute() (not executeAsync()) is safe here — unlike the reference
  // implementation, registerMirrorPad above runs synchronously (arraySync,
  // no awaited ops), so the graph has no async control flow for tfjs to
  // worry about; it says as much when run with executeAsync().
  const generated = model.execute({ test: inputTensor }) as tf.Tensor4D;
  inputTensor.dispose();

  const normalized = tf.tidy(() => generated.squeeze([0]).add(1).div(2) as tf.Tensor3D);
  generated.dispose();

  const canvas = document.createElement('canvas');
  canvas.width = scaledSize[1];
  canvas.height = scaledSize[0];
  await tf.browser.toPixels(normalized, canvas);
  normalized.dispose();

  return canvas.toDataURL('image/jpeg', 0.92);
}
