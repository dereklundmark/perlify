import { useSyncExternalStore } from 'react';

// "Actual size" needs to know how many CSS pixels make a real millimetre on
// this screen. Browsers don't expose that (CSS "1in" is always 96px, which is
// only true on a nominal desktop monitor), so we start from a per-device
// guess and let the user calibrate against a bank card. Stored per device:
// an iPad and an iPhone need different values.

const PX_PER_MM_KEY = 'perlify.screenPxPerMm';
const ACTUAL_SIZE_KEY = 'perlify.actualSize';

/** ISO/IEC 7810 ID-1 — every bank/credit/ID card. */
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 53.98;

function isAppleTouchDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS Safari reports itself as a Mac; touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Best guess before calibration. Apple's CSS px density is fixed per device
 * class: iPad 264 ppi @2x ≈ 132 px/in, iPad mini & iPhones ≈ 163 px/in
 * (326 @2x, 460-ish @3x). Everything else: the CSS nominal 96 px/in.
 */
export function guessPxPerMm(): number {
  if (typeof window === 'undefined') return 96 / 25.4;
  if (isAppleTouchDevice()) {
    const shortSide = Math.min(window.screen.width, window.screen.height);
    const isPhone = shortSide < 500;
    const isIpadMini = !isPhone && shortSide <= 768;
    return (isPhone || isIpadMini ? 163 : 132) / 25.4;
  }
  return 96 / 25.4;
}

function readNumber(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked — the setting just lasts for this session.
  }
}

interface ScreenScaleState {
  pxPerMm: number;
  calibrated: boolean;
  actualSize: boolean;
}

function load(): ScreenScaleState {
  const saved = readNumber(PX_PER_MM_KEY);
  let actualSize = false;
  try {
    actualSize = localStorage.getItem(ACTUAL_SIZE_KEY) === '1';
  } catch {
    // default off
  }
  return { pxPerMm: saved ?? guessPxPerMm(), calibrated: saved !== null, actualSize };
}

let state: ScreenScaleState = load();
const listeners = new Set<() => void>();

function set(patch: Partial<ScreenScaleState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The screen scale plus the shared ACTUAL SIZE switch — one value across every screen that shows it. */
export function useScreenScale(): ScreenScaleState {
  return useSyncExternalStore(subscribe, () => state);
}

export function setActualSize(on: boolean): void {
  write(ACTUAL_SIZE_KEY, on ? '1' : null);
  set({ actualSize: on });
}

export function saveCalibration(pxPerMm: number): void {
  write(PX_PER_MM_KEY, String(pxPerMm));
  set({ pxPerMm, calibrated: true });
}

export function resetCalibration(): void {
  write(PX_PER_MM_KEY, null);
  set({ pxPerMm: guessPxPerMm(), calibrated: false });
}
