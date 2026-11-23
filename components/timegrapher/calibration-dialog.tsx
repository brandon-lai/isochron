"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AudioInputDevice,
  SignalPathAudit,
} from "@/lib/timegrapher/audio-capture";
import type { TgCalibrationStatus } from "@/lib/timegrapher/engine";

interface CalibrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: AudioInputDevice[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  audit: SignalPathAudit | null;
  driftSecondsPerDay: number;
  onDriftChange: (drift: number) => void;
  calibrationStatus: TgCalibrationStatus | null;
  isCalibratingQuartz: boolean;
  isMicListening: boolean;
  onStartQuartzCheck: () => void;
  onStopQuartzCheck: () => void;
}

export function CalibrationDialog({
  open,
  onOpenChange,
  devices,
  selectedDeviceId,
  onSelectDevice,
  audit,
  driftSecondsPerDay,
  onDriftChange,
  calibrationStatus,
  isCalibratingQuartz,
  isMicListening,
  onStartQuartzCheck,
  onStopQuartzCheck,
}: CalibrationDialogProps) {
  const ppm = (driftSecondsPerDay / 0.0864).toFixed(1);
  const selectedDeviceLabel =
    selectedDeviceId === "default"
      ? "System default microphone"
      : (devices.find((d) => d.deviceId === selectedDeviceId)?.label ??
        "System default microphone");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Sensor &amp; Crystal Calibration
          </DialogTitle>
          <DialogDescription>
            Verify raw microphone routing and compensate for your device&apos;s
            audio crystal offset (1 ppm = 0.0864 s/d).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Input selection */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="mic-device-select"
              className="text-xs font-medium text-muted-foreground"
            >
              Audio input source
            </label>
            <Select
              value={selectedDeviceId}
              onValueChange={(val) => {
                if (val) onSelectDevice(val);
              }}
            >
              <SelectTrigger id="mic-device-select" className="h-10 w-full">
                <SelectValue>{selectedDeviceLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">System default microphone</SelectItem>
                {devices
                  .filter((d) => d.deviceId && d.deviceId !== "default")
                  .map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Browser DSP signal path audit */}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Browser DSP Signal Path Audit
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {audit ? `${audit.sampleRate.toLocaleString()} Hz` : "Start mic to inspect"}
              </span>
            </div>

            {audit ? (
              <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                <div className="rounded-lg border border-border px-2.5 py-2">
                  <div className="text-muted-foreground">Auto Gain</div>
                  <div className="mt-0.5 font-semibold text-foreground">
                    {audit.autoGainControl === false
                      ? "Disabled (OK)"
                      : audit.autoGainControl === true
                        ? "Forced On"
                        : "Unreported"}
                  </div>
                </div>
                <div className="rounded-lg border border-border px-2.5 py-2">
                  <div className="text-muted-foreground">Noise Supp.</div>
                  <div className="mt-0.5 font-semibold text-foreground">
                    {audit.noiseSuppression === false
                      ? "Disabled (OK)"
                      : audit.noiseSuppression === true
                        ? "Forced On"
                        : "Unreported"}
                  </div>
                </div>
                <div className="rounded-lg border border-border px-2.5 py-2">
                  <div className="text-muted-foreground">Echo Cancel</div>
                  <div className="mt-0.5 font-semibold text-foreground">
                    {audit.echoCancellation === false
                      ? "Disabled (OK)"
                      : audit.echoCancellation === true
                        ? "Forced On"
                        : "Unreported"}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Isochron requests raw mono PCM with echo cancellation, noise
                suppression, and automatic gain disabled so OS voice filters do
                not erase 6 to 10 kHz escapement impulses.
              </p>
            )}
          </div>

          {/* Clock crystal trim */}
          <div className="flex flex-col gap-2.5 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Audio Crystal Trim
              </span>
              <span className="font-mono text-xs text-foreground tabular-nums">
                {driftSecondsPerDay >= 0 ? "+" : ""}
                {driftSecondsPerDay.toFixed(2)} s/d ({ppm} ppm)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 font-mono tabular-nums"
                onClick={() =>
                  onDriftChange(
                    Math.max(-25, Number((driftSecondsPerDay - 0.5).toFixed(2))),
                  )
                }
              >
                -0.5 s/d
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 font-mono tabular-nums"
                onClick={() =>
                  onDriftChange(
                    Math.max(-25, Number((driftSecondsPerDay - 0.1).toFixed(2))),
                  )
                }
              >
                -0.1
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 font-mono tabular-nums"
                onClick={() => onDriftChange(0)}
              >
                0.00
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 font-mono tabular-nums"
                onClick={() =>
                  onDriftChange(
                    Math.min(25, Number((driftSecondsPerDay + 0.1).toFixed(2))),
                  )
                }
              >
                +0.1
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 font-mono tabular-nums"
                onClick={() =>
                  onDriftChange(
                    Math.min(25, Number((driftSecondsPerDay + 0.5).toFixed(2))),
                  )
                }
              >
                +0.5 s/d
              </Button>
            </div>

            {/* 1 Hz Quartz reference check */}
            <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-foreground">
                    1 Hz Quartz Reference Check
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Hold a ticking 1 Hz quartz watch against the mic to measure
                    soundcard crystal error directly.
                  </div>
                </div>
                {isCalibratingQuartz ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onStopQuartzCheck}
                    className="h-9 shrink-0"
                  >
                    Stop Check
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isMicListening}
                    onClick={onStartQuartzCheck}
                    className="h-9 shrink-0"
                  >
                    {isMicListening ? "Run 1 Hz Check" : "Start Mic First"}
                  </Button>
                )}
              </div>

              {isCalibratingQuartz && calibrationStatus && (
                <div className="flex items-center justify-between border-t border-border pt-2 text-xs tabular-nums">
                  <span>
                    Pulses:{" "}
                    <span className="font-mono">
                      {calibrationStatus.collected} / {calibrationStatus.needed}
                    </span>
                  </span>
                  <span>
                    Measured:{" "}
                    <span className="font-mono">
                      {Number.isFinite(calibrationStatus.driftSecondsPerDay)
                        ? `${calibrationStatus.driftSecondsPerDay >= 0 ? "+" : ""}${calibrationStatus.driftSecondsPerDay.toFixed(2)}`
                        : "--"}
                    </span>{" "}
                    s/d
                  </span>
                  {calibrationStatus.collected >= 10 &&
                    Math.abs(calibrationStatus.driftSecondsPerDay) <= 25 && (
                      <Button
                        size="xs"
                        onClick={() => {
                          onDriftChange(
                            Number(
                              calibrationStatus.driftSecondsPerDay.toFixed(2),
                            ),
                          );
                          onStopQuartzCheck();
                        }}
                      >
                        Apply
                      </Button>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
