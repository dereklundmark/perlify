// Bead-pitch / peg-count math. Values per perlify-design-handoff/README.md
// (screen 1b) and perler-app-readme.md §B:
//   Regular/Midi: ~5.0mm pitch -> ~5.08 pegs/in -> ~2.0 pegs/cm
//   Mini:         ~2.6mm pitch -> ~9.77 pegs/in -> ~3.85 pegs/cm
// pegs/in = 25.4 / pitchMm; pegs/cm = 10 / pitchMm (consistent with both
// published figures above, so pitch is the single source of truth).

export type BeadType = 'regular' | 'mini';
export type BoardUnit = 'in' | 'cm' | 'pegs';

export const STANDARD_PITCH_MM: Record<BeadType, number> = {
  regular: 5.0,
  mini: 2.6,
};

export function pitchMm(beadType: BeadType, pegsPerInchOverride?: number): number {
  if (pegsPerInchOverride && pegsPerInchOverride > 0) {
    return 25.4 / pegsPerInchOverride;
  }
  return STANDARD_PITCH_MM[beadType];
}

export function pegsPerInch(beadType: BeadType, pegsPerInchOverride?: number): number {
  return pegsPerInchOverride && pegsPerInchOverride > 0
    ? pegsPerInchOverride
    : 25.4 / STANDARD_PITCH_MM[beadType];
}

export function pegsPerCm(beadType: BeadType, pegsPerInchOverride?: number): number {
  return pegsPerInch(beadType, pegsPerInchOverride) / 2.54;
}

export function unitToPegs(
  value: number,
  unit: BoardUnit,
  beadType: BeadType,
  pegsPerInchOverride?: number,
): number {
  if (unit === 'pegs') return Math.round(value);
  const ppin = pegsPerInch(beadType, pegsPerInchOverride);
  const inches = unit === 'in' ? value : value / 2.54;
  return Math.round(inches * ppin);
}

export function pegsToUnit(
  pegs: number,
  unit: BoardUnit,
  beadType: BeadType,
  pegsPerInchOverride?: number,
): number {
  if (unit === 'pegs') return pegs;
  const ppin = pegsPerInch(beadType, pegsPerInchOverride);
  const inches = pegs / ppin;
  return unit === 'in' ? inches : inches * 2.54;
}

export interface CalibrationResult {
  pitchMm: number;
  pegsPerIn: number;
  pegsPerCm: number;
  percentOffStandard: number;
}

/** Measured across 10 spacings, per the 3b calibrate sheet. */
export function calibrateFromMeasurement(measuredMm: number, beadType: BeadType): CalibrationResult {
  const measuredPitch = measuredMm / 10;
  const standard = STANDARD_PITCH_MM[beadType];
  return {
    pitchMm: measuredPitch,
    pegsPerIn: 25.4 / measuredPitch,
    pegsPerCm: 10 / measuredPitch,
    percentOffStandard: ((measuredPitch - standard) / standard) * 100,
  };
}

/** Warn (don't block) beyond +/-15% of the standard pitch for the selected bead size. */
export function isCalibrationSuspicious(measuredMm: number, beadType: BeadType): boolean {
  const { percentOffStandard } = calibrateFromMeasurement(measuredMm, beadType);
  return Math.abs(percentOffStandard) > 15;
}

const DEFAULT_BOARD_CELLS = 29 * 29;
const MIN_DEFAULT_PEGS = 4;

/**
 * A starting board shape matching the photo's own aspect ratio, so the
 * Adjust screen's live preview never opens visibly squished before the
 * user has chosen a real board size on Board Setup. Preserves roughly the
 * same total peg count as the old fixed 29x29 default (so detail level
 * doesn't change), just distributed to match the photo's proportions.
 */
export function computeDefaultBoardSize(imageAspect: number): { widthPegs: number; heightPegs: number } {
  const heightPegs = Math.max(MIN_DEFAULT_PEGS, Math.round(Math.sqrt(DEFAULT_BOARD_CELLS / imageAspect)));
  const widthPegs = Math.max(MIN_DEFAULT_PEGS, Math.round(Math.sqrt(DEFAULT_BOARD_CELLS * imageAspect)));
  return { widthPegs, heightPegs };
}
