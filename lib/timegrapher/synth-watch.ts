/*
    Isochron — Synthetic Swiss Lever Escapement Acoustic Generator
    Generates physically accurate 48 kHz mono PCM samples (unlock, impulse,
    and drop transients on pallet-fork carrier frequencies) for real-time
    demonstration and automated WebAssembly DSP verification.
    Licensed under GPL-2.0-only.
*/

export interface SynthWatchParams {
  sampleRate?: number;
  bph: number; // e.g. 28800
  liftAngle: number; // e.g. 52
  rateSecondsPerDay: number; // e.g. +2.4
  amplitudeDegrees: number; // e.g. 286
  beatErrorMs: number; // e.g. 0.3
  noiseFloor?: number; // e.g. 0.0025
}

export interface SynthScenario {
  id: string;
  label: string;
  presetId: string;
  params: SynthWatchParams;
}

export const SYNTH_SCENARIOS: SynthScenario[] = [
  {
    id: "chronometer-28800",
    label: "Cal. 3135 Chronometer (+2.4 s/d · 288°)",
    presetId: "rolex-3135",
    params: {
      bph: 28800,
      liftAngle: 52,
      rateSecondsPerDay: 2.4,
      amplitudeDegrees: 288,
      beatErrorMs: 0.2,
      noiseFloor: 0.002,
    },
  },
  {
    id: "nh35-desk",
    label: "Seiko NH35 Field Watch (-6.5 s/d · 262°)",
    presetId: "seiko-nh35",
    params: {
      bph: 21600,
      liftAngle: 53,
      rateSecondsPerDay: -6.5,
      amplitudeDegrees: 262,
      beatErrorMs: 0.5,
      noiseFloor: 0.0025,
    },
  },
  {
    id: "vintage-18000",
    label: "Unitas 6497 Out-of-Beat (+11.0 s/d · 1.4 ms)",
    presetId: "eta-6497-1",
    params: {
      bph: 18000,
      liftAngle: 44,
      rateSecondsPerDay: 11.0,
      amplitudeDegrees: 248,
      beatErrorMs: 1.4,
      noiseFloor: 0.003,
    },
  },
  {
    id: "hibeat-36000",
    label: "El Primero 36,000 BPH (+1.2 s/d · 295°)",
    presetId: "zenith-400",
    params: {
      bph: 36000,
      liftAngle: 53,
      rateSecondsPerDay: 1.2,
      amplitudeDegrees: 295,
      beatErrorMs: 0.15,
      noiseFloor: 0.002,
    },
  },
];

function addDampedBurst(
  out: Float32Array,
  centerSample: number,
  sampleRate: number,
  gain: number,
  freqHz: number,
  decayMs: number,
): void {
  const start = Math.max(0, Math.floor(centerSample));
  const durationSamples = Math.min(
    out.length - start,
    Math.ceil((decayMs * 5.5 * sampleRate) / 1000),
  );
  if (durationSamples <= 0) return;

  const tau = (decayMs / 1000) * sampleRate;
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  const attackSamples = Math.max(2, Math.round(0.00018 * sampleRate));

  for (let i = 0; i < durationSamples; i++) {
    const attack = i < attackSamples ? i / attackSamples : 1;
    const env = attack * Math.exp(-i / tau);
    const carrier =
      0.72 * Math.sin(omega * i) + 0.28 * Math.sin(omega * 1.43 * i + 0.4);
    out[start + i] += gain * env * carrier;
  }
}

/**
 * Synthesizes `durationSeconds` of mono PCM representing a mechanical Swiss
 * lever escapement. Unlock-to-drop spacing follows exact harmonic balance
 * motion (`pulseSeconds = (period / pi) * asin(liftAngle / (2 * amplitude))`)
 * so `vacaboja/tg`'s `compute_amplitude` recovers `amplitudeDegrees`.
 */
export function synthesizeWatchBuffer(
  durationSeconds: number,
  params: SynthWatchParams,
): Float32Array {
  const sr = params.sampleRate ?? 48000;
  const totalSamples = Math.floor(durationSeconds * sr);
  const out = new Float32Array(totalSamples);

  const rateFactor = 1 + params.rateSecondsPerDay / 86_400;
  const nominalBeatSeconds = 3600 / params.bph;
  const actualBeatSeconds = nominalBeatSeconds / rateFactor;
  const fullPeriodSeconds = actualBeatSeconds * 2;
  const beatErrorSeconds = params.beatErrorMs / 1000;

  const clampedAmp = Math.max(params.liftAngle * 0.6, Math.min(345, params.amplitudeDegrees));
  const pulseSeconds =
    (fullPeriodSeconds / Math.PI) *
    Math.asin(params.liftAngle / (2 * clampedAmp));

  // Deterministic LCG background floor so FFT noise estimation behaves naturally
  let seed = 0x51f15e;
  const noiseGain = params.noiseFloor ?? 0.0022;
  for (let i = 0; i < totalSamples; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = (seed / 0xffffffff) * 2 - 1;
    out[i] = white * noiseGain;
  }

  // Generate alternating Tick (even) and Tock (odd) escapement complexes
  let cycle = 0;
  while (true) {
    const baseCycleStart = 0.06 + cycle * fullPeriodSeconds;
    if (baseCycleStart - 0.05 > durationSeconds) break;

    const tickDropSec = baseCycleStart;
    // In tg_algo.c: be = period/2 - |toc - tic + tic_pulse - toc_pulse|
    // Shifting tock drop by beatErrorSeconds creates exact beat error in ms
    const tockDropSec = baseCycleStart + actualBeatSeconds - beatErrorSeconds;

    const drops = [
      { t: tickDropSec, gainScale: 0.76 },
      { t: tockDropSec, gainScale: 0.73 },
    ];

    for (const d of drops) {
      if (d.t < 0.015 || d.t >= durationSeconds - 0.005) continue;
      const dropSample = d.t * sr;
      const unlockSample = (d.t - pulseSeconds) * sr;
      const impulseSample = (d.t - pulseSeconds * 0.52) * sr;

      // 1. Unlock sub-peak (roller jewel striking pallet fork horn)
      addDampedBurst(out, unlockSample, sr, 0.16 * d.gainScale, 6200, 0.26);
      // 2. Impulse sub-peak (escape tooth sliding across pallet impulse plane)
      addDampedBurst(out, impulseSample, sr, 0.09 * d.gainScale, 5400, 0.24);
      // 3. Drop / lock peak (next tooth locking solidly against pallet stone)
      addDampedBurst(out, dropSample, sr, 0.92 * d.gainScale, 7600, 0.34);
    }

    cycle++;
  }

  for (let i = 0; i < totalSamples; i++) {
    if (out[i] > 0.98) out[i] = 0.98;
    else if (out[i] < -0.98) out[i] = -0.98;
  }

  return out;
}

/**
 * Streams a loop-free continuous synthetic mechanical watch signal in real-time
 * chunks (`chunkSamples = 2048` at `48 kHz`) so the UI scope, settling bar, and
 * `tg-core.wasm` worker run identically to live microphone capture.
 */
export class LiveSynthWatchStream {
  private timer: ReturnType<typeof setInterval> | null = null;
  private prebuilt: Float32Array;
  private cursor = 0;
  readonly sampleRate: number;

  constructor(
    params: SynthWatchParams,
    private readonly onChunk: (chunk: Float32Array) => void,
  ) {
    this.sampleRate = params.sampleRate ?? 48000;
    // 36 seconds of continuous non-repeating phase-coherent beats; wraps on exact full period
    const rateFactor = 1 + params.rateSecondsPerDay / 86_400;
    const fullPeriodSamples = ((7200 / params.bph) / rateFactor) * this.sampleRate;
    const exactCycles = Math.max(40, Math.round((36 * this.sampleRate) / fullPeriodSamples));
    const exactDuration = (exactCycles * fullPeriodSamples) / this.sampleRate;
    this.prebuilt = synthesizeWatchBuffer(exactDuration, {
      ...params,
      sampleRate: this.sampleRate,
    });
  }

  start(): void {
    if (this.timer !== null) return;
    const chunkSize = 2048;
    const intervalMs = (chunkSize / this.sampleRate) * 1000;
    let lastTick = performance.now();

    this.timer = setInterval(() => {
      const now = performance.now();
      const elapsedSec = Math.min(0.25, (now - lastTick) / 1000);
      lastTick = now;
      const needed = Math.max(chunkSize, Math.round(elapsedSec * this.sampleRate));

      let remaining = needed;
      while (remaining > 0) {
        const take = Math.min(chunkSize, remaining);
        const out = new Float32Array(take);
        for (let i = 0; i < take; i++) {
          out[i] = this.prebuilt[this.cursor];
          this.cursor = (this.cursor + 1) % this.prebuilt.length;
        }
        this.onChunk(out);
        remaining -= take;
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
