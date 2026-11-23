"use client";

import * as React from "react";
import { amplitudeMsBefore } from "@/lib/timegrapher/amplitude-scale";
import type { TgBeatDot, TgWaveform } from "@/lib/timegrapher/engine";
import type { SignalPathAudit } from "@/lib/timegrapher/audio-capture";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, Download, Play, Mic } from "lucide-react";

export type ScopeViewMode = "trace" | "beat" | "sensor";
export type TraceZoomSpan = 20 | 60 | 180; // ms horizontal span across ribbon

interface AcousticScopeProps {
  mode: ScopeViewMode;
  onModeChange: (mode: ScopeViewMode) => void;
  isListening: boolean;
  sourceKind: "idle" | "mic" | "demo" | "file";
  beats: TgBeatDot[];
  waveform: TgWaveform | null;
  rawFrame: Float32Array | null;
  peakLevel: number;
  rmsLevel: number;
  clipped: boolean;
  nominalBph: number;
  detectedBph: number;
  liftAngle: number;
  gain: number;
  onGainChange: (gain: number) => void;
  audit: SignalPathAudit | null;
  onResetTrace: () => void;
  onExportWav: () => void;
  canExportWav: boolean;
  onStartMic: () => void;
  onStartDemo: () => void;
}

const DEGREE_RULER_TICKS = [330, 300, 270, 240, 210, 180, 150];

export function AcousticScope({
  mode,
  onModeChange,
  isListening,
  sourceKind,
  beats,
  waveform,
  rawFrame,
  peakLevel,
  rmsLevel,
  clipped,
  nominalBph,
  detectedBph,
  liftAngle,
  gain,
  onGainChange,
  audit,
  onResetTrace,
  onExportWav,
  canExportWav,
  onStartMic,
  onStartDemo,
}: AcousticScopeProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [zoomMs, setZoomMs] = React.useState<TraceZoomSpan>(20);
  const [size, setSize] = React.useState({ width: 760, height: 400 });

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(size.width * dpr));
    canvas.height = Math.max(1, Math.floor(size.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    const wellBg = token("--scope-well");
    const hairline = token("--border");
    const ink = token("--foreground");
    const muted = token("--muted-foreground");
    const vermilion = token("--primary");
    const cobalt = token("--trace-toc");
    const emerald = token("--signal-lock");
    const amber = token("--signal-amber");
    const monoFont = styles.getPropertyValue("--font-mono").trim() || "monospace";

    const w = size.width;
    const h = size.height;

    ctx.fillStyle = wellBg;
    ctx.fillRect(0, 0, w, h);

    if (mode === "trace") {
      drawPaperTrace(ctx, {
        w,
        h,
        beats,
        bph: detectedBph > 0 ? detectedBph : nominalBph > 0 ? nominalBph : 28800,
        zoomMs,
        hairline,
        muted,
        vermilion,
        cobalt,
        monoFont,
      });
    } else if (mode === "beat") {
      drawEscapementBeat(ctx, {
        w,
        h,
        waveform,
        liftAngle,
        hairline,
        ink,
        muted,
        vermilion,
        cobalt,
        emerald,
        monoFont,
      });
    } else {
      drawRawSensor(ctx, {
        w,
        h,
        rawFrame,
        peakLevel,
        rmsLevel,
        clipped,
        hairline,
        muted,
        vermilion,
        emerald,
        amber,
        monoFont,
      });
    }
  }, [
    mode,
    size,
    beats,
    waveform,
    rawFrame,
    peakLevel,
    rmsLevel,
    clipped,
    nominalBph,
    detectedBph,
    liftAngle,
    zoomMs,
  ]);

  const showEmptyOverlay =
    sourceKind === "idle" && beats.length === 0 && !waveform && mode === "trace";

  return (
    <section
      aria-label="Acoustic chronoscope"
      className="flex flex-col gap-3 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={mode}
          onValueChange={(val) => onModeChange(val as ScopeViewMode)}
        >
          <TabsList className="h-9">
            <TabsTrigger value="trace" className="px-3 text-xs sm:text-sm">
              Paper Trace
            </TabsTrigger>
            <TabsTrigger value="beat" className="px-3 text-xs sm:text-sm">
              Escapement Beat
            </TabsTrigger>
            <TabsTrigger value="sensor" className="px-3 text-xs sm:text-sm">
              Raw Sensor
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-1.5">
          {mode === "trace" && (
            <div
              role="group"
              aria-label="Trace horizontal span"
              className="inline-flex items-center rounded-lg border border-border bg-secondary/60 p-0.5"
            >
              {([20, 60, 180] as const).map((span) => {
                const active = zoomMs === span;
                return (
                  <button
                    key={span}
                    type="button"
                    onClick={() => setZoomMs(span)}
                    className={`rounded-md px-2 py-1 text-xs tabular-nums transition-[color,background-color] duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring outline-none ${
                      active
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ±<span className="font-mono">{span / 2}</span> ms
                  </button>
                );
              })}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onResetTrace}
            aria-label="Clear trace buffer"
            className="h-9 gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Clear</span>
          </Button>

          {canExportWav && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportWav}
              aria-label="Download captured WAV audio"
              className="h-9 gap-1.5"
            >
              <Download className="size-3.5" />
              <span>WAV</span>
            </Button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[340px] w-full overflow-hidden rounded-xl border border-border bg-scope-well sm:h-[410px]"
      >
        <canvas
          ref={canvasRef}
          className="block size-full"
          role="img"
          aria-label={
            mode === "trace"
              ? "Rising paper-strip beat trace showing rate slope and beat error separation"
              : mode === "beat"
                ? "Epoch-folded tick and tock escapement impulse waveform with amplitude degree scale"
                : "Raw microphone sensor oscilloscope and peak headroom monitor"
          }
        />

        {showEmptyOverlay && (
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <div className="max-w-md rounded-xl border border-border bg-background p-5 shadow-xs">
              <h2 className="text-base font-semibold text-foreground">
                Couple the watch crown to your microphone
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                In a quiet room, rest the watch crown or caseback directly
                against your phone&apos;s bottom microphone (or clip on a piezo
                pickup). Rate and beat error settle in about eight seconds.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Button
                  onClick={onStartMic}
                  className="h-10 gap-2 px-4"
                >
                  <Mic className="size-4" />
                  <span>Start Microphone</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={onStartDemo}
                  className="h-10 gap-2 px-3.5"
                >
                  <Play className="size-3.5" />
                  <span>Run Cal. 3135 Live Demo</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contextual legend / sensor strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            <span>Tick impulse</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-trace-toc" />
            <span>Tock impulse</span>
          </span>
          {mode === "trace" && (
            <span className="sm:border-l sm:border-border sm:pl-3">
              Right slope: fast (+s/d), left slope: slow (-s/d), twin-column gap: beat error
            </span>
          )}
          {mode === "beat" && (
            <span className="sm:border-l sm:border-border sm:pl-3">
              Top scale maps pallet impulse interval to balance amplitude at {liftAngle}° lift
            </span>
          )}
          {mode === "sensor" && (
            <span className="sm:border-l sm:border-border sm:pl-3">
              340 ms rolling acoustic envelope (~3 escapement beats)
            </span>
          )}
        </div>

        {(mode === "sensor" || sourceKind === "mic") && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                Gain <span className="font-mono">{gain.toFixed(1)}</span>x
              </span>
              <div className="w-24">
                <Slider
                  aria-label="Digital input pre-gain"
                  min={1}
                  max={8}
                  step={0.5}
                  value={[gain]}
                  onValueChange={(val) => {
                    const next = Array.isArray(val) ? val[0] : val;
                    if (typeof next === "number") onGainChange(next);
                  }}
                />
              </div>
            </div>
            {audit && (
              <span className="border-l border-border pl-3 tabular-nums">
                <span className="font-mono">{(audit.sampleRate / 1000).toFixed(1)}</span> kHz,{" "}
                {audit.cleanRawPath ? "Raw DSP clean" : "OS filter active"}
              </span>
            )}
          </div>
        )}

        {isListening && sourceKind === "demo" && (
          <span className="text-foreground/80 tabular-nums">
            <span className="font-mono">48.0</span> kHz synthetic Swiss lever stream
          </span>
        )}
      </div>
    </section>
  );
}

function drawPaperTrace(
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    h: number;
    beats: TgBeatDot[];
    bph: number;
    zoomMs: number;
    hairline: string;
    muted: string;
    vermilion: string;
    cobalt: string;
    monoFont: string;
  },
) {
  const { w, h, beats, bph, zoomMs, hairline, muted, vermilion, cobalt, monoFont } =
    opts;
  const padTop = 26;
  const padBottom = 18;
  const plotH = Math.max(40, h - padTop - padBottom);
  const windowSeconds = 24;

  // Vertical ms gridlines
  ctx.strokeStyle = hairline;
  ctx.lineWidth = 1;
  const gridCols = 8;
  for (let i = 1; i < gridCols; i++) {
    const x = Math.round((w * i) / gridCols) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, h - padBottom);
    ctx.stroke();
  }

  // Horizontal time rules every 4 seconds
  for (let s = 0; s <= windowSeconds; s += 4) {
    const y = Math.round(padTop + (s / windowSeconds) * plotH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Reference slope guides from bottom center: -10 s/d, 0 s/d, +10 s/d
  const centerX = w / 2;
  const bottomY = h - padBottom;
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = hairline;
  for (const refRate of [-10, 0, 10]) {
    // At +R s/d, over T seconds, watch beats arrive earlier by T * (R / 86400) sec = T * R / 86.4 ms
    // Convention on Witschi strips: fast (+s/d) slopes right as paper feeds downward (newest at top)
    const driftMsAtTop = (windowSeconds * refRate) / 86.4;
    const topX = centerX + (driftMsAtTop / zoomMs) * w;
    ctx.beginPath();
    ctx.moveTo(centerX, bottomY);
    ctx.lineTo(topX, padTop);
    ctx.stroke();

    ctx.fillStyle = muted;
    ctx.font = `500 11px ${monoFont}`;
    ctx.textAlign = "center";
    const clampedX = Math.max(28, Math.min(w - 28, topX));
    if (refRate === 0 || Math.abs(clampedX - centerX) >= 54) {
      const label =
        refRate === 0 ? "0 s/d" : `${refRate > 0 ? "+" : ""}${refRate} s/d`;
      ctx.fillText(label, clampedX, 16);
    }
  }
  ctx.restore();

  if (beats.length < 2) return;

  const nominalBeatSec = 3600 / bph;
  const latestT = beats[beats.length - 1].timeSeconds;
  const minT = Math.max(0, latestT - windowSeconds);

  // Anchor horizontal center on earliest visible beat's phase modulo nominalBeatSec
  const visible = beats.filter((b) => b.timeSeconds >= minT);
  if (visible.length === 0) return;

  const anchor = visible[0];
  const anchorIndex = Math.round(anchor.timeSeconds / nominalBeatSec);

  for (const b of visible) {
    const beatIdx = Math.round(b.timeSeconds / nominalBeatSec);
    // Expected arrival if watch had 0.0 s/d rate relative to anchor:
    const expectedSec =
      anchor.timeSeconds + (beatIdx - anchorIndex) * nominalBeatSec;
    // Fast watch arrives earlier -> expectedSec - b.timeSeconds > 0 -> shifts right (+x)
    let residualMs = (expectedSec - b.timeSeconds) * 1000;

    // Wrap cleanly across screen width so high-rate watches keep wrapping like a real Witschi drum
    const halfSpan = zoomMs / 2;
    residualMs =
      ((((residualMs + halfSpan) % zoomMs) + zoomMs) % zoomMs) - halfSpan;

    const x = centerX + (residualMs / zoomMs) * (w - 32);
    const age = latestT - b.timeSeconds;
    const y = padTop + (age / windowSeconds) * plotH;

    ctx.fillStyle = b.isTick ? vermilion : cobalt;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEscapementBeat(
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    h: number;
    waveform: TgWaveform | null;
    liftAngle: number;
    hairline: string;
    ink: string;
    muted: string;
    vermilion: string;
    cobalt: string;
    emerald: string;
    monoFont: string;
  },
) {
  const {
    w,
    h,
    waveform,
    liftAngle,
    hairline,
    muted,
    vermilion,
    cobalt,
    emerald,
    monoFont,
  } = opts;
  const padTop = 36;
  const padBottom = 26;
  const padX = 20;
  const plotW = Math.max(40, w - padX * 2);
  const plotH = Math.max(40, h - padTop - padBottom);

  ctx.strokeStyle = hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, padTop + 0.5);
  ctx.lineTo(w - padX, padTop + 0.5);
  ctx.moveTo(padX, h - padBottom + 0.5);
  ctx.lineTo(w - padX, h - padBottom + 0.5);
  ctx.stroke();

  if (!waveform || waveform.tic.length < 4) {
    ctx.fillStyle = muted;
    ctx.font = `500 12px ${monoFont}`;
    ctx.textAlign = "center";
    ctx.fillText(
      "Awaiting escapement lock to fold Tick & Tock impulse envelopes…",
      w / 2,
      h / 2,
    );
    return;
  }

  const totalMs = waveform.msBefore + waveform.msAfter;
  const xForMs = (msFromDrop: number) =>
    padX + ((msFromDrop + waveform.msBefore) / totalMs) * plotW;

  // Drop peak vertical hairline at 0.0 ms
  const dropX = xForMs(0);
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = hairline;
  ctx.beginPath();
  ctx.moveTo(dropX, padTop);
  ctx.lineTo(dropX, h - padBottom);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = muted;
  ctx.font = `500 10px ${monoFont}`;
  ctx.textAlign = "center";
  ctx.fillText("0 ms (Lock)", dropX, h - 8);

  // Nonlinear amplitude degree ruler along top edge (collision-checked right-to-left)
  let lastLabelLeftX = dropX - 10;
  for (const deg of DEGREE_RULER_TICKS) {
    const msBefore = amplitudeMsBefore(
      liftAngle,
      deg,
      waveform.periodSeconds,
    );
    if (msBefore === null || msBefore > waveform.msBefore) continue;
    const x = xForMs(-msBefore);
    if (x < padX + 18 || x > dropX - 20) continue;

    ctx.strokeStyle = hairline;
    ctx.beginPath();
    ctx.moveTo(x, padTop - 6);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();

    if (lastLabelLeftX - x >= 36) {
      ctx.fillStyle = muted;
      ctx.textAlign = "center";
      ctx.fillText(`${deg}°`, x, 20);
      lastLabelLeftX = x;
    }
  }

  // Normalize waveform height across tic and toc
  let peak = 1e-6;
  for (let i = 0; i < waveform.tic.length; i++) {
    if (waveform.tic[i] > peak) peak = waveform.tic[i];
    if (waveform.toc[i] > peak) peak = waveform.toc[i];
  }

  const midY = padTop + plotH * 0.48;
  const halfH = plotH * 0.42;

  const drawEnvelope = (arr: Float32Array, color: string, sign: 1 | -1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = padX + (i / (arr.length - 1)) * plotW;
      const norm = Math.min(1, Math.max(0, arr[i] / peak));
      const y = midY - sign * norm * halfH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // Baseline dividing upper Tick envelope and mirrored lower Tock envelope
  ctx.strokeStyle = hairline;
  ctx.beginPath();
  ctx.moveTo(padX, midY + 0.5);
  ctx.lineTo(w - padX, midY + 0.5);
  ctx.stroke();

  drawEnvelope(waveform.tic, vermilion, 1);
  drawEnvelope(waveform.toc, cobalt, -1);

  // Detected unlock impulse cursors
  if (waveform.ticPulseMs !== null) {
    const ux = xForMs(-waveform.ticPulseMs);
    ctx.strokeStyle = emerald;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ux, padTop + 4);
    ctx.lineTo(ux, midY);
    ctx.stroke();
    ctx.fillStyle = emerald;
    const placeLeft = ux > padX + 135;
    ctx.textAlign = placeLeft ? "right" : "left";
    ctx.fillText(
      `Unlock -${waveform.ticPulseMs.toFixed(2)} ms`,
      placeLeft ? ux - 8 : Math.min(w - 130, ux + 8),
      padTop + 22,
    );
  }
  if (waveform.tocPulseMs !== null) {
    const ux = xForMs(-waveform.tocPulseMs);
    ctx.strokeStyle = emerald;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ux, midY);
    ctx.lineTo(ux, h - padBottom - 4);
    ctx.stroke();
  }
}

function drawRawSensor(
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    h: number;
    rawFrame: Float32Array | null;
    peakLevel: number;
    rmsLevel: number;
    clipped: boolean;
    hairline: string;
    muted: string;
    vermilion: string;
    emerald: string;
    amber: string;
    monoFont: string;
  },
) {
  const {
    w,
    h,
    rawFrame,
    peakLevel,
    rmsLevel,
    clipped,
    hairline,
    muted,
    vermilion,
    emerald,
    amber,
    monoFont,
  } = opts;

  const padX = 20;
  const meterH = 32;
  const waveTop = 22;
  const waveH = Math.max(60, h - waveTop - meterH - 28);
  const midY = waveTop + waveH / 2;

  ctx.strokeStyle = hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, midY + 0.5);
  ctx.lineTo(w - padX, midY + 0.5);
  ctx.stroke();

  if (rawFrame && rawFrame.length > 0) {
    const plotW = Math.max(40, Math.floor(w - padX * 2));
    ctx.strokeStyle = clipped ? vermilion : emerald;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    // Min/max envelope per pixel column so sub-millisecond escapement spikes never alias out
    for (let px = 0; px < plotW; px++) {
      const start = Math.floor((px / plotW) * rawFrame.length);
      const end = Math.max(
        start + 1,
        Math.floor(((px + 1) / plotW) * rawFrame.length),
      );
      let lo = rawFrame[start];
      let hi = rawFrame[start];
      for (let i = start + 1; i < end && i < rawFrame.length; i++) {
        const v = rawFrame[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const x = padX + px + 0.5;
      const yTop = midY - Math.min(1, Math.max(-1, hi)) * (waveH * 0.45);
      const yBot = midY - Math.min(1, Math.max(-1, lo)) * (waveH * 0.45);
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, Math.abs(yBot - yTop) < 1 ? yTop + 1 : yBot);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = muted;
    ctx.font = `500 12px ${monoFont}`;
    ctx.textAlign = "center";
    ctx.fillText("Microphone idle — start listening to inspect raw transients", w / 2, midY - 8);
  }

  // Bottom headroom bar
  const barY = h - meterH - 8;
  const barW = w - padX * 2;
  ctx.strokeStyle = hairline;
  ctx.strokeRect(padX + 0.5, barY + 0.5, barW - 1, 14);

  const fillW = Math.min(1, peakLevel) * (barW - 2);
  ctx.fillStyle = clipped
    ? vermilion
    : peakLevel >= 0.12
      ? emerald
      : amber;
  ctx.fillRect(padX + 1, barY + 1, fillW, 12);

  ctx.fillStyle = muted;
  ctx.font = `500 11px ${monoFont}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `Peak ${(peakLevel * 100).toFixed(0)}% · RMS ${(rmsLevel * 100).toFixed(1)}%${
      clipped ? " · CLIPPING — lower gain" : peakLevel > 0 && peakLevel < 0.08 ? " · Signal low — couple watch closer or raise gain" : ""
    }`,
    padX,
    barY + 28,
  );
}
