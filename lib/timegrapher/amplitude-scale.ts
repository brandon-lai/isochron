/*
    Isochron — Escapement Lift-Angle & Crystal Drift Arithmetic
    Licensed under GPL-2.0-only.
*/

export const SECONDS_PER_DAY = 86_400;

/**
 * Milliseconds before the drop peak where an unlock impulse corresponding to
 * `amplitude` (degrees) occurs for a balance swinging with `liftAngle` and
 * full oscillation `periodSeconds` (two beats).
 */
export function amplitudeMsBefore(
  liftAngle: number,
  amplitude: number,
  periodSeconds: number,
): number | null {
  if (!(periodSeconds > 0) || !(liftAngle > 0) || 2 * amplitude < liftAngle) {
    return null;
  }
  return ((periodSeconds * Math.asin(liftAngle / (2 * amplitude))) / Math.PI) * 1000;
}

/**
 * Inverse of `amplitudeMsBefore`: given a detected unlock-to-drop interval
 * `msBefore` (milliseconds), returns the implied balance amplitude in degrees.
 */
export function msBeforeToAmplitude(
  liftAngle: number,
  msBefore: number,
  periodSeconds: number,
): number | null {
  if (!(periodSeconds > 0) || !(msBefore > 0) || !(liftAngle > 0)) return null;
  const s = Math.sin((Math.PI * (msBefore / 1000)) / periodSeconds);
  if (!(s > 0)) return null;
  const amplitude = liftAngle / (2 * s);
  return amplitude >= 100 && amplitude <= 360 ? amplitude : null;
}

/**
 * Applies a soundcard crystal drift calibration (`driftSecondsPerDay`, where positive
 * means the audio clock runs faster than nominal wall time) to the nominal sample rate
 * passed into `tg_init`.
 */
export function correctedSampleRate(
  nominalSampleRate: number,
  driftSecondsPerDay: number,
): number {
  return Math.round(
    nominalSampleRate * (1 + driftSecondsPerDay / SECONDS_PER_DAY),
  );
}
