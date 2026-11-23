/*
    Isochron — WebAssembly Timegrapher Worker Client
    Coordinates live sample streaming, beat-ribbon deduplication, folded
    waveform snapshots, 1 Hz quartz crystal checks, and offline file analysis.
    Licensed under GPL-2.0-only.
*/

export interface TgMeasurement {
  rate: number;
  amplitude: number;
  beatError: number;
  detectedBph: number;
  signalQuality: number;
  valid: boolean;
}

export interface TgWaveform {
  tic: Float32Array;
  toc: Float32Array;
  msBefore: number;
  msAfter: number;
  periodSeconds: number;
  ticPulseMs: number | null;
  tocPulseMs: number | null;
}

export interface TgBeatDot {
  timeSeconds: number;
  isTick: boolean;
}

export interface TgCalibrationStatus {
  collected: number;
  needed: number;
  signal: number;
  state: number;
  driftSecondsPerDay: number;
  secondsCaptured: number;
}

export interface TgResultPayload {
  measurement: TgMeasurement;
  waveform: TgWaveform | null;
  beats: TgBeatDot[];
  secondsCaptured: number;
  fileName?: string;
}

const MAX_RIBBON_BEATS = 900;

export class TimegrapherEngine {
  private worker: Worker | null = null;
  private beatRibbon: TgBeatDot[] = [];
  private latestBeatTime = -1;

  onResult: ((payload: TgResultPayload) => void) | null = null;
  onOfflineResult: ((payload: TgResultPayload) => void) | null = null;
  onCalibration: ((cal: TgCalibrationStatus) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker("/workers/tg-worker.js", { type: "module" });
      this.worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.type === "result") {
          const times = msg.beats.times as Float64Array;
          const isTick = msg.beats.isTick as Uint8Array;
          for (let i = 0; i < times.length; i++) {
            const t = times[i];
            if (t > this.latestBeatTime + 0.008) {
              this.latestBeatTime = t;
              this.beatRibbon.push({
                timeSeconds: t,
                isTick: isTick[i] === 1,
              });
            }
          }
          if (this.beatRibbon.length > MAX_RIBBON_BEATS) {
            this.beatRibbon.splice(0, this.beatRibbon.length - MAX_RIBBON_BEATS);
          }

          this.onResult?.({
            measurement: msg.measurement,
            waveform: msg.waveform,
            beats: this.beatRibbon.slice(),
            secondsCaptured: msg.secondsCaptured,
          });
        } else if (msg.type === "offline-result") {
          const times = msg.beats.times as Float64Array;
          const isTick = msg.beats.isTick as Uint8Array;
          const offlineBeats: TgBeatDot[] = [];
          for (let i = 0; i < times.length; i++) {
            offlineBeats.push({
              timeSeconds: times[i],
              isTick: isTick[i] === 1,
            });
          }
          this.beatRibbon = offlineBeats.slice(-MAX_RIBBON_BEATS);
          this.latestBeatTime =
            offlineBeats.length > 0
              ? offlineBeats[offlineBeats.length - 1].timeSeconds
              : -1;

          this.onOfflineResult?.({
            measurement: msg.measurement,
            waveform: msg.waveform,
            beats: this.beatRibbon.slice(),
            secondsCaptured: msg.secondsCaptured,
            fileName: msg.fileName,
          });
        } else if (msg.type === "calibration") {
          this.onCalibration?.({
            ...msg.calibration,
            secondsCaptured: msg.secondsCaptured,
          });
        } else if (msg.type === "error") {
          this.onError?.(msg.message);
        }
      };
    }
    return this.worker;
  }

  init(sampleRate: number, bph: number, liftAngle: number): void {
    this.beatRibbon = [];
    this.latestBeatTime = -1;
    this.ensureWorker().postMessage({
      type: "init",
      sampleRate,
      bph,
      liftAngle,
    });
  }

  pushSamples(samples: Float32Array): void {
    if (!this.worker) return;
    const copy = new Float32Array(samples);
    this.worker.postMessage({ type: "push", samples: copy }, [copy.buffer]);
  }

  resetTrace(): void {
    this.beatRibbon = [];
    this.latestBeatTime = -1;
    this.worker?.postMessage({ type: "reset" });
  }

  startQuartzCalibration(): void {
    this.ensureWorker().postMessage({ type: "calibrate-start" });
  }

  stopQuartzCalibration(): void {
    this.worker?.postMessage({ type: "calibrate-stop" });
  }

  analyzeBuffer(options: {
    samples: Float32Array;
    sampleRate: number;
    bph: number;
    liftAngle: number;
    fileName?: string;
  }): void {
    this.beatRibbon = [];
    this.latestBeatTime = -1;
    const copy = new Float32Array(options.samples);
    this.ensureWorker().postMessage(
      {
        type: "analyze-buffer",
        samples: copy,
        sampleRate: options.sampleRate,
        bph: options.bph,
        liftAngle: options.liftAngle,
        fileName: options.fileName,
      },
      [copy.buffer],
    );
  }

  destroy(): void {
    if (this.worker) {
      this.worker.postMessage({ type: "destroy" });
      this.worker.terminate();
      this.worker = null;
    }
    this.beatRibbon = [];
    this.latestBeatTime = -1;
  }
}
