/*
    Isochron — Settling Confidence & Six-Position ISO 3159 Summary
    Licensed under GPL-2.0-only.
*/

export type LockPhase = "idle" | "listening" | "settling" | "locked";

export interface StabilitySample {
  atSeconds: number;
  rate: number;
  amplitude: number;
  beatError: number;
  signalQuality: number;
}

export interface StabilitySummary {
  phase: LockPhase;
  spreadSecondsPerDay: number | null;
  progress: number; // 0..1 toward settled lock
  settledSeconds: number;
}

const WINDOW_SECONDS = 12;
const MIN_LOCK_SECONDS = 7;
const LOCK_SPREAD_THRESHOLD = 1.4; // s/d peak-to-peak across trailing window

export function evaluateStability(
  history: StabilitySample[],
  isRunning: boolean,
  secondsCaptured: number,
): StabilitySummary {
  if (!isRunning && history.length === 0) {
    return {
      phase: "idle",
      spreadSecondsPerDay: null,
      progress: 0,
      settledSeconds: 0,
    };
  }

  if (history.length < 3 || secondsCaptured < 3.5) {
    return {
      phase: "listening",
      spreadSecondsPerDay: null,
      progress: Math.min(0.35, secondsCaptured / 10),
      settledSeconds: secondsCaptured,
    };
  }

  const latestAt = history[history.length - 1].atSeconds;
  const recent = history.filter((s) => latestAt - s.atSeconds <= WINDOW_SECONDS);
  if (recent.length < 3) {
    return {
      phase: "settling",
      spreadSecondsPerDay: null,
      progress: Math.min(0.65, secondsCaptured / 12),
      settledSeconds: secondsCaptured,
    };
  }

  let minRate = Infinity;
  let maxRate = -Infinity;
  for (const s of recent) {
    if (s.rate < minRate) minRate = s.rate;
    if (s.rate > maxRate) maxRate = s.rate;
  }
  const spread = maxRate - minRate;
  const spanSeconds = recent[recent.length - 1].atSeconds - recent[0].atSeconds;
  const timeProgress = Math.min(1, secondsCaptured / MIN_LOCK_SECONDS);
  const spreadProgress = spread <= LOCK_SPREAD_THRESHOLD
    ? 1
    : Math.max(0.25, 1 - (spread - LOCK_SPREAD_THRESHOLD) / 8);

  const locked =
    secondsCaptured >= MIN_LOCK_SECONDS &&
    spanSeconds >= 4.5 &&
    spread <= LOCK_SPREAD_THRESHOLD;

  return {
    phase: locked ? "locked" : "settling",
    spreadSecondsPerDay: spread,
    progress: locked ? 1 : Math.min(0.94, timeProgress * 0.65 + spreadProgress * 0.35),
    settledSeconds: secondsCaptured,
  };
}

export type WatchPositionCode = "DU" | "DD" | "CU" | "CD" | "12U" | "12D";

export interface WatchPositionMeta {
  code: WatchPositionCode;
  label: string;
  plane: "Horizontal" | "Vertical";
  hint: string;
}

export const WATCH_POSITIONS: WatchPositionMeta[] = [
  { code: "DU", label: "Dial Up", plane: "Horizontal", hint: "Flat on desk, crystal facing up" },
  { code: "DD", label: "Dial Down", plane: "Horizontal", hint: "Flat on pad, caseback facing up" },
  { code: "CU", label: "Crown Up (9H)", plane: "Vertical", hint: "On edge, 3 o'clock crown pointing up" },
  { code: "CD", label: "Crown Down (3H)", plane: "Vertical", hint: "On edge, crown resting downward" },
  { code: "12U", label: "12 Up (12H)", plane: "Vertical", hint: "Standing upright as on a desk stand" },
  { code: "12D", label: "12 Down (6H)", plane: "Vertical", hint: "Standing inverted, 6 o'clock up" },
];

export interface PositionReading {
  position: WatchPositionCode;
  rate: number;
  amplitude: number | null;
  beatError: number;
  bph: number;
  liftAngle: number;
  spread: number | null;
  capturedAt: string;
}

export interface SixPositionSummary {
  count: number;
  meanRate: number;
  maxPositionalDelta: number;
  meanAmplitude: number | null;
  horizontalVerticalDelta: number | null;
  maxBeatError: number;
  coscPass: boolean; // Mean -4..+6 s/d and max beat error <= 0.8 ms and delta <= 10 s/d
}

export function summarizePositions(
  readings: Partial<Record<WatchPositionCode, PositionReading>>,
): SixPositionSummary | null {
  const list = Object.values(readings).filter(
    (r): r is PositionReading => Boolean(r),
  );
  if (list.length === 0) return null;

  const rates = list.map((r) => r.rate);
  const meanRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const maxPositionalDelta = Math.max(...rates) - Math.min(...rates);
  const amps = list
    .map((r) => r.amplitude)
    .filter((a): a is number => a !== null && a > 0);
  const meanAmplitude =
    amps.length > 0 ? amps.reduce((a, b) => a + b, 0) / amps.length : null;
  const maxBeatError = Math.max(...list.map((r) => r.beatError));

  const horiz = [readings.DU, readings.DD].filter(
    (r): r is PositionReading => Boolean(r),
  );
  const vert = [readings.CU, readings.CD, readings["12U"], readings["12D"]].filter(
    (r): r is PositionReading => Boolean(r),
  );
  const horizontalVerticalDelta =
    horiz.length > 0 && vert.length > 0
      ? horiz.reduce((a, b) => a + b.rate, 0) / horiz.length -
        vert.reduce((a, b) => a + b.rate, 0) / vert.length
      : null;

  const coscPass =
    list.length >= 2 &&
    meanRate >= -4 &&
    meanRate <= 6 &&
    maxPositionalDelta <= 10 &&
    maxBeatError <= 0.8;

  return {
    count: list.length,
    meanRate,
    maxPositionalDelta,
    meanAmplitude,
    horizontalVerticalDelta,
    maxBeatError,
    coscPass,
  };
}
