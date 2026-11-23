/*
    Isochron — Raw Unprocessed Microphone Capture, Signal Audit & WAV I/O
    Licensed under GPL-2.0-only.
*/

export interface SignalPathAudit {
  deviceLabel: string;
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean | null;
  noiseSuppression: boolean | null;
  autoGainControl: boolean | null;
  cleanRawPath: boolean;
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export async function listAudioInputs(): Promise<AudioInputDevice[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "audioinput")
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${idx + 1}`,
      }));
  } catch {
    return [];
  }
}

export class RawMicSession {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private fallbackNode: ScriptProcessorNode | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private gain = 1;
  private recordedChunks: Float32Array[] = [];
  private recordedFrames = 0;
  private readonly maxRecordSeconds = 30;

  audit: SignalPathAudit | null = null;

  setGain(multiplier: number): void {
    this.gain = Math.max(0.5, Math.min(12, multiplier));
  }

  async start(options: {
    deviceId?: string;
    gain?: number;
    onSamples: (samples: Float32Array, peak: number, rms: number, clipped: boolean) => void;
  }): Promise<SignalPathAudit> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access requires HTTPS or localhost.");
    }

    this.gain = options.gain ?? 1;
    this.recordedChunks = [];
    this.recordedFrames = 0;

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: { ideal: false },
      noiseSuppression: { ideal: false },
      autoGainControl: { ideal: false },
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 },
    };
    if (options.deviceId && options.deviceId !== "default") {
      audioConstraints.deviceId = { exact: options.deviceId };
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });

    const track = this.stream.getAudioTracks()[0];
    const settings = track?.getSettings?.() ?? {};

    this.ctx = new AudioContext({ latencyHint: "interactive" });
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    const sampleRate = this.ctx.sampleRate;
    const ec = typeof settings.echoCancellation === "boolean" ? settings.echoCancellation : null;
    const ns = typeof settings.noiseSuppression === "boolean" ? settings.noiseSuppression : null;
    const agc = typeof settings.autoGainControl === "boolean" ? settings.autoGainControl : null;

    this.audit = {
      deviceLabel: track?.label || "System Microphone",
      sampleRate,
      channelCount: settings.channelCount ?? 1,
      echoCancellation: ec,
      noiseSuppression: ns,
      autoGainControl: agc,
      cleanRawPath: ec !== true && ns !== true && agc !== true,
    };

    this.source = this.ctx.createMediaStreamSource(this.stream);

    const handleRawBlock = (raw: Float32Array) => {
      const scaled = new Float32Array(raw.length);
      let peak = 0;
      let sumSq = 0;
      let clipped = false;
      const g = this.gain;

      for (let i = 0; i < raw.length; i++) {
        const rawAbs = Math.abs(raw[i]);
        if (rawAbs >= 0.995) clipped = true;
        let v = raw[i] * g;
        if (v > 0.995) {
          v = 0.995;
          clipped = true;
        } else if (v < -0.995) {
          v = -0.995;
          clipped = true;
        }
        scaled[i] = v;
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
        sumSq += v * v;
      }

      const rms = Math.sqrt(sumSq / Math.max(1, scaled.length));

      // Keep rolling 30-second WAV export ring
      this.recordedChunks.push(scaled);
      this.recordedFrames += scaled.length;
      const maxFrames = sampleRate * this.maxRecordSeconds;
      while (this.recordedFrames > maxFrames && this.recordedChunks.length > 1) {
        const dropped = this.recordedChunks.shift()!;
        this.recordedFrames -= dropped.length;
      }

      options.onSamples(scaled, peak, rms, clipped);
    };

    try {
      await this.ctx.audioWorklet.addModule("/workers/capture-worklet.js");
      this.worklet = new AudioWorkletNode(this.ctx, "capture-processor");
      this.worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
        handleRawBlock(e.data);
      };
      this.source.connect(this.worklet);
    } catch {
      // Fallback for older WebKit builds where AudioWorklet inside standalone mode stalls
      const proc = this.ctx.createScriptProcessor(2048, 1, 1);
      proc.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0);
        handleRawBlock(new Float32Array(input));
      };
      this.source.connect(proc);
      proc.connect(this.ctx.destination);
      this.fallbackNode = proc;
    }

    await this.acquireWakeLock();
    return this.audit;
  }

  exportWav(): Blob | null {
    if (!this.ctx || this.recordedFrames === 0) return null;
    const merged = new Float32Array(this.recordedFrames);
    let offset = 0;
    for (const c of this.recordedChunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return encodeWavBlob(merged, this.ctx.sampleRate);
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      if ("wakeLock" in navigator && navigator.wakeLock?.request) {
        this.wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Non-fatal in headless or battery-saver browsers
    }
  }

  async stop(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      // ignore
    }
    this.wakeLock = null;

    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.disconnect();
      this.worklet = null;
    }
    if (this.fallbackNode) {
      this.fallbackNode.onaudioprocess = null;
      this.fallbackNode.disconnect();
      this.fallbackNode = null;
    }
    this.source?.disconnect();
    this.source = null;

    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
    }
  }
}

export function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function decodeAudioFile(
  file: File,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const length = audioBuffer.length;
    const channels = audioBuffer.numberOfChannels;
    const mono = new Float32Array(length);

    if (channels === 1) {
      mono.set(audioBuffer.getChannelData(0));
    } else {
      for (let ch = 0; ch < channels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          mono[i] += data[i] / channels;
        }
      }
    }

    return {
      samples: mono,
      sampleRate: audioBuffer.sampleRate,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}
