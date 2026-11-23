"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Mic,
  Square,
  Play,
  Upload,
  SlidersHorizontal,
  Sun,
  Moon,
  Download,
  Minus,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import {
  MOVEMENT_PRESETS,
  STANDARD_BPH_OPTIONS,
  findPreset,
} from "@/lib/timegrapher/movements";
import { correctedSampleRate } from "@/lib/timegrapher/amplitude-scale";
import {
  WATCH_POSITIONS,
  evaluateStability,
  summarizePositions,
  type PositionReading,
  type StabilitySample,
  type WatchPositionCode,
} from "@/lib/timegrapher/stability";
import {
  LiveSynthWatchStream,
  SYNTH_SCENARIOS,
} from "@/lib/timegrapher/synth-watch";
import {
  RawMicSession,
  decodeAudioFile,
  encodeWavBlob,
  listAudioInputs,
  type AudioInputDevice,
  type SignalPathAudit,
} from "@/lib/timegrapher/audio-capture";
import {
  TimegrapherEngine,
  type TgBeatDot,
  type TgCalibrationStatus,
  type TgMeasurement,
  type TgWaveform,
} from "@/lib/timegrapher/engine";
import { AcousticScope, type ScopeViewMode } from "./acoustic-scope";
import { PositionLog } from "./position-log";
import { CalibrationDialog } from "./calibration-dialog";

const STORAGE_KEYS = {
  preset: "isochron.preset.v1",
  drift: "isochron.drift.v1",
  watchRef: "isochron.watchRef.v1",
  positions: "isochron.positions.v1",
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function IsochronApp() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Movement & calibration settings
  const [presetId, setPresetId] = React.useState<string>("rolex-3135");
  const [bphOverride, setBphOverride] = React.useState<number>(28800);
  const [liftAngle, setLiftAngle] = React.useState<number>(52);
  const [driftSecondsPerDay, setDriftSecondsPerDay] = React.useState<number>(0);
  const [gain, setGain] = React.useState<number>(1.5);

  // Active capture state
  const [sourceKind, setSourceKind] = React.useState<
    "idle" | "mic" | "demo" | "file"
  >("idle");
  const [demoScenarioId, setDemoScenarioId] =
    React.useState<string>("chronometer-28800");
  const [scopeMode, setScopeMode] = React.useState<ScopeViewMode>("trace");
  const [activeFileName, setActiveFileName] = React.useState<string | null>(
    null,
  );

  // DSP outputs
  const [measurement, setMeasurement] = React.useState<TgMeasurement | null>(
    null,
  );
  const [waveform, setWaveform] = React.useState<TgWaveform | null>(null);
  const [beats, setBeats] = React.useState<TgBeatDot[]>([]);
  const [secondsCaptured, setSecondsCaptured] = React.useState<number>(0);
  const [stabilityHistory, setStabilityHistory] = React.useState<
    StabilitySample[]
  >([]);

  // Raw sensor monitor
  const [rawFrame, setRawFrame] = React.useState<Float32Array | null>(null);
  const [peakLevel, setPeakLevel] = React.useState<number>(0);
  const [rmsLevel, setRmsLevel] = React.useState<number>(0);
  const [clipped, setClipped] = React.useState<boolean>(false);

  // Calibration & devices
  const [calOpen, setCalOpen] = React.useState(false);
  const [devices, setDevices] = React.useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] =
    React.useState<string>("default");
  const [audit, setAudit] = React.useState<SignalPathAudit | null>(null);
  const [calibrationStatus, setCalibrationStatus] =
    React.useState<TgCalibrationStatus | null>(null);
  const [isCalibratingQuartz, setIsCalibratingQuartz] = React.useState(false);

  // 6-position inspection state
  const [watchRef, setWatchRef] = React.useState<string>("");
  const [activePosition, setActivePosition] =
    React.useState<WatchPositionCode>("DU");
  const [readings, setReadings] = React.useState<
    Partial<Record<WatchPositionCode, PositionReading>>
  >({});

  // PWA install prompt
  const [installPrompt, setInstallPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);

  const engineRef = React.useRef<TimegrapherEngine | null>(null);
  const micRef = React.useRef<RawMicSession | null>(null);
  const synthRef = React.useRef<LiveSynthWatchStream | null>(null);
  const demoWavSamplesRef = React.useRef<Float32Array[]>([]);
  const sensorRingRef = React.useRef<Float32Array>(new Float32Array(16384));
  const peakHoldRef = React.useRef<number>(0);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastUiFrameAtRef = React.useRef<number>(0);

  const pushSensorMonitor = React.useCallback(
    (chunk: Float32Array, isClip = false) => {
      const ring = sensorRingRef.current;
      if (chunk.length >= ring.length) {
        ring.set(chunk.subarray(chunk.length - ring.length));
      } else {
        ring.copyWithin(0, chunk.length);
        ring.set(chunk, ring.length - chunk.length);
      }

      const now = performance.now();
      if (now - lastUiFrameAtRef.current > 65) {
        lastUiFrameAtRef.current = now;
        let windowPeak = 0;
        let sq = 0;
        for (let i = 0; i < ring.length; i++) {
          const v = ring[i];
          const a = v < 0 ? -v : v;
          if (a > windowPeak) windowPeak = a;
          sq += v * v;
        }
        peakHoldRef.current = Math.max(windowPeak, peakHoldRef.current * 0.9);
        setRawFrame(ring.slice());
        setPeakLevel(peakHoldRef.current);
        setRmsLevel(Math.sqrt(sq / ring.length));
        setClipped(isClip || windowPeak >= 0.995);
      }
    },
    [],
  );

  // Hydrate persisted bench state + register offline Service Worker
  React.useEffect(() => {
    setMounted(true);
    try {
      const savedPreset = localStorage.getItem(STORAGE_KEYS.preset);
      if (savedPreset) {
        const p = findPreset(savedPreset);
        setPresetId(p.id);
        setBphOverride(p.bph ?? 0);
        setLiftAngle(p.liftAngle);
      }
      const savedDrift = localStorage.getItem(STORAGE_KEYS.drift);
      if (savedDrift !== null && !Number.isNaN(Number(savedDrift))) {
        setDriftSecondsPerDay(Number(savedDrift));
      }
      const savedRef = localStorage.getItem(STORAGE_KEYS.watchRef);
      if (savedRef) setWatchRef(savedRef);
      const savedPos = localStorage.getItem(STORAGE_KEYS.positions);
      if (savedPos) {
        setReadings(JSON.parse(savedPos));
      }
    } catch {
      // Private mode safe
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    listAudioInputs().then(setDevices);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  // Setup WASM Engine callbacks
  React.useEffect(() => {
    const engine = new TimegrapherEngine();
    engine.onResult = (payload) => {
      setMeasurement(payload.measurement);
      setWaveform(payload.waveform);
      setBeats(payload.beats);
      setSecondsCaptured(payload.secondsCaptured);

      if (payload.measurement.valid) {
        setStabilityHistory((prev) => {
          const next = [
            ...prev,
            {
              atSeconds: payload.secondsCaptured,
              rate: payload.measurement.rate,
              amplitude: payload.measurement.amplitude,
              beatError: payload.measurement.beatError,
              signalQuality: payload.measurement.signalQuality,
            },
          ];
          return next.slice(-60);
        });
      }
    };

    engine.onOfflineResult = (payload) => {
      setMeasurement(payload.measurement);
      setWaveform(payload.waveform);
      setBeats(payload.beats);
      setSecondsCaptured(payload.secondsCaptured);
      setActiveFileName(payload.fileName ?? "Recording");
      if (payload.measurement.valid) {
        setStabilityHistory([
          {
            atSeconds: Math.max(0, payload.secondsCaptured - 8),
            rate: payload.measurement.rate,
            amplitude: payload.measurement.amplitude,
            beatError: payload.measurement.beatError,
            signalQuality: payload.measurement.signalQuality,
          },
          {
            atSeconds: Math.max(0, payload.secondsCaptured - 4),
            rate: payload.measurement.rate,
            amplitude: payload.measurement.amplitude,
            beatError: payload.measurement.beatError,
            signalQuality: payload.measurement.signalQuality,
          },
          {
            atSeconds: payload.secondsCaptured,
            rate: payload.measurement.rate,
            amplitude: payload.measurement.amplitude,
            beatError: payload.measurement.beatError,
            signalQuality: payload.measurement.signalQuality,
          },
        ]);
        toast.success(`Analyzed ${payload.fileName ?? "recording"}`);
      } else {
        toast.error("No steady watch escapement found in that recording.");
      }
    };

    engine.onCalibration = (cal) => {
      setCalibrationStatus(cal);
    };

    engine.onError = (msg) => {
      toast.error(msg);
    };

    engineRef.current = engine;
    return () => {
      synthRef.current?.stop();
      micRef.current?.stop();
      engine.destroy();
    };
  }, []);

  const stopActiveCapture = React.useCallback(async () => {
    synthRef.current?.stop();
    synthRef.current = null;
    if (micRef.current) {
      await micRef.current.stop();
      micRef.current = null;
    }
    setIsCalibratingQuartz(false);
    setSourceKind("idle");
    sensorRingRef.current.fill(0);
    peakHoldRef.current = 0;
    setRawFrame(null);
    setPeakLevel(0);
    setRmsLevel(0);
    setClipped(false);
  }, []);

  const startMicrophone = React.useCallback(async () => {
    await stopActiveCapture();
    setActiveFileName(null);
    setStabilityHistory([]);
    setMeasurement(null);
    setWaveform(null);
    setBeats([]);
    setSecondsCaptured(0);

    const mic = new RawMicSession();
    micRef.current = mic;
    try {
      const sigAudit = await mic.start({
        deviceId: selectedDeviceId,
        gain,
        onSamples: (samples, _peak, _rms, isClip) => {
          engineRef.current?.pushSamples(samples);
          pushSensorMonitor(samples, isClip);
        },
      });

      setAudit(sigAudit);
      listAudioInputs().then(setDevices);
      const effSr = correctedSampleRate(
        sigAudit.sampleRate,
        driftSecondsPerDay,
      );
      engineRef.current?.init(effSr, bphOverride, liftAngle);
      setSourceKind("mic");
    } catch (err) {
      micRef.current = null;
      toast.error(
        err instanceof Error
          ? err.message
          : "Microphone permission was declined.",
      );
    }
  }, [
    stopActiveCapture,
    selectedDeviceId,
    gain,
    driftSecondsPerDay,
    bphOverride,
    liftAngle,
    pushSensorMonitor,
  ]);

  const startLiveDemo = React.useCallback(
    async (scenarioId = demoScenarioId) => {
      await stopActiveCapture();
      const scenario =
        SYNTH_SCENARIOS.find((s) => s.id === scenarioId) ?? SYNTH_SCENARIOS[0];
      setDemoScenarioId(scenario.id);
      setPresetId(scenario.presetId);
      setBphOverride(scenario.params.bph);
      setLiftAngle(scenario.params.liftAngle);
      setActiveFileName(null);
      setStabilityHistory([]);
      setMeasurement(null);
      setWaveform(null);
      setBeats([]);
      setSecondsCaptured(0);
      demoWavSamplesRef.current = [];

      const sr = 48000;
      engineRef.current?.init(
        sr,
        scenario.params.bph,
        scenario.params.liftAngle,
      );

      const stream = new LiveSynthWatchStream(scenario.params, (chunk) => {
        engineRef.current?.pushSamples(chunk);
        demoWavSamplesRef.current.push(chunk);
        if (demoWavSamplesRef.current.length > 700) {
          demoWavSamplesRef.current.shift();
        }
        pushSensorMonitor(chunk, false);
      });

      synthRef.current = stream;
      stream.start();
      setSourceKind("demo");
    },
    [demoScenarioId, stopActiveCapture, pushSensorMonitor],
  );

  // Re-init live engine cleanly if BPH, Lift Angle, or Crystal Drift changes mid-session
  const applyMovementConfig = React.useCallback(
    (nextBph: number, nextLift: number, nextDrift = driftSecondsPerDay) => {
      if (sourceKind === "mic" && audit) {
        setStabilityHistory([]);
        engineRef.current?.init(
          correctedSampleRate(audit.sampleRate, nextDrift),
          nextBph,
          nextLift,
        );
      } else if (sourceKind === "demo") {
        setStabilityHistory([]);
        engineRef.current?.init(48000, nextBph, nextLift);
      }
    },
    [sourceKind, audit, driftSecondsPerDay],
  );

  const handlePresetSelect = (nextId: string) => {
    const p = findPreset(nextId);
    setPresetId(p.id);
    const nextBph = p.bph ?? 0;
    setBphOverride(nextBph);
    setLiftAngle(p.liftAngle);
    try {
      localStorage.setItem(STORAGE_KEYS.preset, p.id);
    } catch {}
    applyMovementConfig(nextBph, p.liftAngle);
  };

  const handleBphChange = (nextBph: number) => {
    setBphOverride(nextBph);
    applyMovementConfig(nextBph, liftAngle);
  };

  const handleLiftAngleStep = (delta: number) => {
    const next = Math.max(28, Math.min(64, liftAngle + delta));
    setLiftAngle(next);
    applyMovementConfig(bphOverride, next);
  };

  const handleDriftChange = (nextDrift: number) => {
    setDriftSecondsPerDay(nextDrift);
    try {
      localStorage.setItem(STORAGE_KEYS.drift, String(nextDrift));
    } catch {}
    applyMovementConfig(bphOverride, liftAngle, nextDrift);
  };

  const handleGainChange = (nextGain: number) => {
    setGain(nextGain);
    micRef.current?.setGain(nextGain);
  };

  const handleResetTrace = React.useCallback(() => {
    engineRef.current?.resetTrace();
    setBeats([]);
    setWaveform(null);
    setMeasurement(null);
    setStabilityHistory([]);
    setSecondsCaptured(0);
  }, []);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    await stopActiveCapture();
    try {
      const decoded = await decodeAudioFile(file);
      setSourceKind("file");
      const preview = decoded.samples.subarray(
        0,
        Math.min(decoded.samples.length, 16384),
      );
      lastUiFrameAtRef.current = 0;
      pushSensorMonitor(preview, false);
      engineRef.current?.analyzeBuffer({
        samples: decoded.samples,
        sampleRate: correctedSampleRate(decoded.sampleRate, driftSecondsPerDay),
        bph: bphOverride,
        liftAngle,
        fileName: file.name,
      });
    } catch {
      toast.error("Could not decode that audio file.");
    }
  };

  const handleExportWav = () => {
    let blob: Blob | null = null;
    if (sourceKind === "mic" && micRef.current) {
      blob = micRef.current.exportWav();
    } else if (demoWavSamplesRef.current.length > 0) {
      const total = demoWavSamplesRef.current.reduce((a, b) => a + b.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of demoWavSamplesRef.current) {
        merged.set(c, off);
        off += c.length;
      }
      blob = encodeWavBlob(merged, 48000);
    }
    if (!blob) {
      toast.error("Capture a few seconds of audio first.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `isochron-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const stability = React.useMemo(
    () =>
      evaluateStability(
        stabilityHistory,
        sourceKind === "mic" || sourceKind === "demo",
        secondsCaptured,
      ),
    [stabilityHistory, sourceKind, secondsCaptured],
  );

  const validReading = Boolean(measurement?.valid);
  const activePreset = findPreset(presetId);

  const handleLogCurrentPosition = React.useCallback(() => {
    if (!measurement || !measurement.valid) return;
    const entry: PositionReading = {
      position: activePosition,
      rate: measurement.rate,
      amplitude:
        measurement.amplitude >= 90 && measurement.amplitude <= 360
          ? measurement.amplitude
          : null,
      beatError: measurement.beatError,
      bph: measurement.detectedBph || bphOverride || 28800,
      liftAngle,
      spread: stability.spreadSecondsPerDay,
      capturedAt: new Date().toISOString(),
    };

    setReadings((prev) => {
      const updated = { ...prev, [activePosition]: entry };
      try {
        localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify(updated));
      } catch {}

      // Advance to next unlogged position
      const idx = WATCH_POSITIONS.findIndex((p) => p.code === activePosition);
      for (let step = 1; step <= WATCH_POSITIONS.length; step++) {
        const candidate =
          WATCH_POSITIONS[(idx + step) % WATCH_POSITIONS.length].code;
        if (!updated[candidate]) {
          setActivePosition(candidate);
          break;
        }
      }
      return updated;
    });
    toast.success(
      `Logged ${activePosition}: ${measurement.rate >= 0 ? "+" : ""}${measurement.rate.toFixed(1)} s/d`,
    );
  }, [
    measurement,
    activePosition,
    bphOverride,
    liftAngle,
    stability.spreadSecondsPerDay,
  ]);

  const handleCopySummary = async () => {
    const summary = summarizePositions(readings);
    if (!summary) return;
    const lines = [
      `Isochron Timing Slip${watchRef ? ` — ${watchRef}` : ""}`,
      `Caliber: ${activePreset.maker} ${activePreset.caliber} (${liftAngle}° lift)`,
      `Date: ${new Date().toLocaleString()}`,
      `---`,
      ...WATCH_POSITIONS.filter((p) => readings[p.code]).map((p) => {
        const r = readings[p.code]!;
        return `${p.code.padEnd(4)} (${p.label.padEnd(14)}): ${r.rate >= 0 ? "+" : ""}${r.rate.toFixed(1)} s/d | ${r.amplitude ? `${Math.round(r.amplitude)}°` : "—"} | ${r.beatError.toFixed(2)} ms`;
      }),
      `---`,
      `Mean Rate: ${summary.meanRate >= 0 ? "+" : ""}${summary.meanRate.toFixed(1)} s/d`,
      `Max Positional Delta: ${summary.maxPositionalDelta.toFixed(1)} s/d`,
      `Max Beat Error: ${summary.maxBeatError.toFixed(2)} ms`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copied timing slip to clipboard");
  };

  // Instrument hotkeys (Space = Listen/Stop, R = Clear Trace, L = Log Position)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.closest("[role='dialog']"))
      ) {
        return;
      }

      if (e.code === "Space" && target?.tagName !== "BUTTON") {
        e.preventDefault();
        if (sourceKind === "mic" || sourceKind === "demo") {
          stopActiveCapture();
        } else {
          startMicrophone();
        }
      } else if (e.key.toLowerCase() === "r") {
        handleResetTrace();
      } else if (e.key.toLowerCase() === "l" && validReading) {
        handleLogCurrentPosition();
      } else if (e.key.toLowerCase() === "d") {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    sourceKind,
    stopActiveCapture,
    startMicrophone,
    handleResetTrace,
    validReading,
    handleLogCurrentPosition,
    resolvedTheme,
    setTheme,
  ]);

  const isStreaming = sourceKind === "mic" || sourceKind === "demo";
  const displayBph =
    measurement && measurement.detectedBph > 0
      ? measurement.detectedBph
      : bphOverride;

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* Top Instrument Header */}
      <header className="no-print border-b border-border">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-scope-well text-foreground">
              <svg
                viewBox="0 0 24 24"
                className="size-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="8.5" />
                <line x1="12" y1="3.5" x2="12" y2="20.5" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  Isochron
                </h1>
                <LockStatusChip
                  phase={stability.phase}
                  spread={stability.spreadSecondsPerDay}
                  sourceKind={sourceKind}
                  fileName={activeFileName}
                />
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Acoustic mechanical watch chronoscope
              </p>
            </div>
          </div>

          {/* Primary Instrument Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {isStreaming ? (
              <Button
                variant="destructive"
                onClick={stopActiveCapture}
                className="h-9 gap-2 px-3.5"
              >
                <Square className="size-3.5 fill-current" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                onClick={startMicrophone}
                className="h-9 gap-2 px-3.5"
              >
                <Mic className="size-4" />
                <span>Listen</span>
              </Button>
            )}

            {/* Demo Watch Selector + Trigger */}
            <div className="inline-flex items-center">
              <Button
                variant={sourceKind === "demo" ? "default" : "secondary"}
                onClick={() => startLiveDemo(demoScenarioId)}
                className="h-9 gap-1.5 rounded-r-none border-r border-border/60 px-3"
              >
                <Play className="size-3.5" />
                <span>Demo</span>
              </Button>
              <Select
                value={demoScenarioId}
                onValueChange={(val) => {
                  if (val) startLiveDemo(val);
                }}
              >
                <SelectTrigger
                  aria-label="Choose synthetic reference watch caliber"
                  className="h-9 w-[34px] justify-center rounded-l-none px-1.5"
                >
                  <span className="sr-only">Select demo watch</span>
                </SelectTrigger>
                <SelectContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
                  {SYNTH_SCENARIOS.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.flac,.m4a,.mp3,.ogg"
              onChange={handleImportFile}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 gap-1.5"
            >
              <Upload className="size-3.5" />
              <span className="sm:hidden">File</span>
              <span className="hidden sm:inline">Audio File</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalOpen(true)}
              aria-label="Open sensor and crystal calibration"
              className="h-9 gap-1.5"
            >
              <SlidersHorizontal className="size-3.5" />
              <span>Calibrate</span>
              {driftSecondsPerDay !== 0 && (
                <span className="font-mono text-xs text-primary tabular-nums">
                  {driftSecondsPerDay > 0 ? "+" : ""}
                  {driftSecondsPerDay.toFixed(1)}
                </span>
              )}
            </Button>

            {installPrompt && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await installPrompt.prompt();
                  setInstallPrompt(null);
                }}
                className="h-9 gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Install App</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle light and dark appearance"
              className="size-9"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Thin settling progress hairline */}
        <div
          aria-hidden="true"
          className="h-0.5 w-full overflow-hidden bg-border/50"
        >
          <div
            className={`h-full w-full origin-left transition-transform duration-200 ease-out motion-reduce:transition-none ${
              stability.phase === "locked"
                ? "bg-signal-lock"
                : isStreaming
                  ? "bg-primary"
                  : "bg-transparent"
            }`}
            style={{
              transform: `scaleX(${stability.progress.toFixed(3)})`,
            }}
          />
        </div>
      </header>

      {/* Main Instrument Chassis */}
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col">
        {/* Hero 4-Metric Readout Strip */}
        <section
          aria-label="Live horological timing metrics"
          className="grid grid-cols-2 border-b border-border lg:grid-cols-4"
        >
          {/* 1. Daily Rate */}
          <div className="col-span-2 flex flex-col justify-between border-b border-border p-4 sm:col-span-1 sm:border-r sm:p-5 lg:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Daily Rate
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {stability.spreadSecondsPerDay !== null
                  ? `±${(stability.spreadSecondsPerDay / 2).toFixed(1)} s/d spread`
                  : "Seconds / day"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                data-testid="metric-rate"
                className="font-mono text-[clamp(1.85rem,3.3vw,2.75rem)] leading-none font-semibold tracking-tight text-foreground tabular-nums"
              >
                {validReading && measurement
                  ? `${measurement.rate >= 0 ? "+" : ""}${measurement.rate.toFixed(1)}`
                  : "--"}
              </span>
              <span className="text-sm text-muted-foreground">
                s/d
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {validReading && measurement
                ? Math.abs(measurement.rate) <= 5
                  ? "Chronometer-grade daily drift"
                  : measurement.rate > 0
                    ? "Running fast relative to nominal"
                    : "Running slow relative to nominal"
                : "Awaiting steady escapement lock"}
            </div>
          </div>

          {/* 2. Balance Amplitude */}
          <div className="col-span-1 flex flex-col justify-between border-r border-b border-border p-4 sm:border-r-0 sm:p-5 lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Amplitude
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {liftAngle}° lift angle
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                data-testid="metric-amplitude"
                className="font-mono text-[clamp(1.85rem,3.3vw,2.75rem)] leading-none font-semibold tracking-tight text-foreground tabular-nums"
              >
                {validReading &&
                measurement &&
                measurement.amplitude >= 90 &&
                measurement.amplitude <= 360
                  ? Math.round(measurement.amplitude)
                  : "--"}
              </span>
              <span className="text-base text-muted-foreground">
                deg
              </span>
            </div>
            <div className="mt-2 text-xs leading-snug text-muted-foreground">
              {activePreset.notes
                ? activePreset.notes
                : validReading && measurement && measurement.amplitude >= 250
                  ? "Healthy mainspring arc (250° to 310°)"
                  : "Derived from pallet impulse arc"}
            </div>
          </div>

          {/* 3. Beat Error */}
          <div className="col-span-1 flex flex-col justify-between border-b border-border p-4 sm:border-r sm:border-b-0 sm:p-5 lg:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Beat Error
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                Target ≤ 0.8 ms
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                data-testid="metric-beat-error"
                className="font-mono text-[clamp(1.85rem,3.3vw,2.75rem)] leading-none font-semibold tracking-tight text-foreground tabular-nums"
              >
                {validReading && measurement
                  ? measurement.beatError.toFixed(2)
                  : "--"}
              </span>
              <span className="text-sm text-muted-foreground">
                ms
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {validReading && measurement
                ? measurement.beatError <= 0.6
                  ? "Centered tick/tock symmetry"
                  : "Asymmetric collet / stud alignment"
                : "Tick-to-tock half-cycle delta"}
            </div>
          </div>

          {/* 4. Caliber, BPH & Lift Angle */}
          <div className="col-span-2 flex flex-col justify-between gap-2 p-4 sm:col-span-1 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Beat Rate &amp; Caliber
              </span>
              <span
                data-testid="metric-bph"
                className="text-xs font-semibold text-foreground tabular-nums"
              >
                {displayBph > 0
                  ? `${displayBph.toLocaleString()} BPH (${(displayBph / 7200).toFixed(2)} Hz)`
                  : "Auto BPH"}
              </span>
            </div>

            <div className="no-print flex flex-col gap-2">
              <Select
                value={presetId}
                onValueChange={(val) => {
                  if (val) handlePresetSelect(val);
                }}
              >
                <SelectTrigger
                  aria-label="Select watch movement caliber preset"
                  className="h-9 w-full text-xs"
                >
                  <SelectValue>
                    {`${activePreset.maker} ${activePreset.caliber} (${activePreset.liftAngle}°)`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-80 w-72 max-w-[calc(100vw-2rem)]">
                  {MOVEMENT_PRESETS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.maker} {m.caliber} ({m.liftAngle}°)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex min-w-0 items-center justify-between gap-1.5">
                <Select
                  value={String(bphOverride)}
                  onValueChange={(v) => handleBphChange(Number(v))}
                >
                  <SelectTrigger
                    aria-label="Override beat rate BPH"
                    className="h-8 min-w-0 flex-1 px-2 text-xs tabular-nums"
                  >
                    <SelectValue>
                      {bphOverride === 0
                        ? "Auto-detect BPH"
                        : `${bphOverride.toLocaleString()} BPH`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_BPH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div
                  role="group"
                  aria-label="Adjust escapement lift angle"
                  className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border bg-scope-well px-0.5"
                >
                  <button
                    type="button"
                    onClick={() => handleLiftAngleStep(-1)}
                    aria-label="Decrease lift angle by 1 degree"
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="px-1 font-mono text-xs font-medium text-foreground tabular-nums">
                    {liftAngle}°
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLiftAngleStep(1)}
                    aria-label="Increase lift angle by 1 degree"
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Split Workspace: Scope + 6-Position Log */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
          <div className="no-print">
            <AcousticScope
              mode={scopeMode}
              onModeChange={setScopeMode}
              isListening={isStreaming}
              sourceKind={sourceKind}
              beats={beats}
              waveform={waveform}
              rawFrame={rawFrame}
              peakLevel={peakLevel}
              rmsLevel={rmsLevel}
              clipped={clipped}
              nominalBph={bphOverride}
              detectedBph={measurement?.detectedBph ?? 0}
              liftAngle={liftAngle}
              gain={gain}
              onGainChange={handleGainChange}
              audit={audit}
              onResetTrace={handleResetTrace}
              onExportWav={handleExportWav}
              canExportWav={
                (sourceKind === "mic" && secondsCaptured > 1) ||
                demoWavSamplesRef.current.length > 5
              }
              onStartMic={startMicrophone}
              onStartDemo={() => startLiveDemo("chronometer-28800")}
            />
          </div>

          <PositionLog
            watchRef={watchRef}
            onWatchRefChange={(val) => {
              setWatchRef(val);
              try {
                localStorage.setItem(STORAGE_KEYS.watchRef, val);
              } catch {}
            }}
            activePosition={activePosition}
            onSelectPosition={setActivePosition}
            readings={readings}
            canLogCurrent={validReading}
            onLogCurrent={handleLogCurrentPosition}
            onClearPosition={(pos) => {
              setReadings((prev) => {
                const next = { ...prev };
                delete next[pos];
                try {
                  localStorage.setItem(
                    STORAGE_KEYS.positions,
                    JSON.stringify(next),
                  );
                } catch {}
                return next;
              });
            }}
            onClearAll={() => {
              setReadings({});
              try {
                localStorage.removeItem(STORAGE_KEYS.positions);
              } catch {}
            }}
            onCopySummary={handleCopySummary}
            onPrintSlip={() => window.print()}
          />
        </div>
      </main>

      {/* Slim Instrument Footer with Shortcuts & Mandatory GPLv2 Source Link */}
      <footer className="no-print border-t border-border">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          <div className="hidden items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-1">
              <Kbd>Space</Kbd> Listen / Stop
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>L</Kbd> Log Position
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>R</Kbd> Clear Trace
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>D</Kbd> Theme
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>
              All acoustic DSP runs locally in WebAssembly. Zero audio leaves
              your device.
            </span>
            <a
              href="https://github.com/brandon-lai/isochron"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline decoration-border hover:decoration-foreground sm:border-l sm:border-border sm:pl-3"
            >
              Open source (GPLv2): Source &amp; C DSP
            </a>
          </div>
        </div>
      </footer>

      <CalibrationDialog
        open={calOpen}
        onOpenChange={setCalOpen}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={setSelectedDeviceId}
        audit={audit}
        driftSecondsPerDay={driftSecondsPerDay}
        onDriftChange={handleDriftChange}
        calibrationStatus={calibrationStatus}
        isCalibratingQuartz={isCalibratingQuartz}
        isMicListening={sourceKind === "mic"}
        onStartQuartzCheck={() => {
          setIsCalibratingQuartz(true);
          engineRef.current?.startQuartzCalibration();
        }}
        onStopQuartzCheck={() => {
          setIsCalibratingQuartz(false);
          engineRef.current?.stopQuartzCalibration();
        }}
      />
    </div>
  );
}

function LockStatusChip({
  phase,
  spread,
  sourceKind,
  fileName,
}: {
  phase: "idle" | "listening" | "settling" | "locked";
  spread: number | null;
  sourceKind: "idle" | "mic" | "demo" | "file";
  fileName: string | null;
}) {
  if (sourceKind === "file") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground tabular-nums">
        <span className="size-1.5 rounded-full bg-signal-lock" />
        <span className="max-w-[180px] truncate">{fileName ?? "File"}</span>
      </span>
    );
  }

  if (phase === "locked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-lock px-2.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums">
        <span className="size-1.5 rounded-full bg-primary-foreground" />
        <span>
          Locked
          {spread !== null ? ` (±${(spread / 2).toFixed(1)}s)` : ""}
        </span>
      </span>
    );
  }

  if (phase === "settling") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-amber px-2.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums">
        <span className="size-1.5 rounded-full bg-primary-foreground" />
        <span>Settling</span>
      </span>
    );
  }

  if (phase === "listening") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums">
        <span className="size-1.5 rounded-full bg-primary-foreground" />
        <span>{sourceKind === "demo" ? "Demo Live" : "Listening"}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground tabular-nums">
      <span className="size-1.5 rounded-full bg-muted-foreground" />
      <span>Ready</span>
    </span>
  );
}
