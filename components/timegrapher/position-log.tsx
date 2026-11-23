"use client";

import * as React from "react";
import {
  WATCH_POSITIONS,
  summarizePositions,
  type PositionReading,
  type WatchPositionCode,
} from "@/lib/timegrapher/stability";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ClipboardCopy, Printer, Trash2, Plus } from "lucide-react";

interface PositionLogProps {
  watchRef: string;
  onWatchRefChange: (val: string) => void;
  activePosition: WatchPositionCode;
  onSelectPosition: (pos: WatchPositionCode) => void;
  readings: Partial<Record<WatchPositionCode, PositionReading>>;
  canLogCurrent: boolean;
  onLogCurrent: () => void;
  onClearPosition: (pos: WatchPositionCode) => void;
  onClearAll: () => void;
  onCopySummary: () => void;
  onPrintSlip: () => void;
}

export function PositionLog({
  watchRef,
  onWatchRefChange,
  activePosition,
  onSelectPosition,
  readings,
  canLogCurrent,
  onLogCurrent,
  onClearPosition,
  onClearAll,
  onCopySummary,
  onPrintSlip,
}: PositionLogProps) {
  const summary = React.useMemo(() => summarizePositions(readings), [readings]);
  const activeMeta =
    WATCH_POSITIONS.find((p) => p.code === activePosition) ?? WATCH_POSITIONS[0];

  return (
    <aside
      aria-label="Six-position timing log"
      className="flex flex-col justify-between border-t border-border p-4 sm:p-5 lg:border-t-0 lg:border-l"
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Six-Position Timing Log
            </h2>
            <p className="text-xs text-muted-foreground">
              ISO 3159 positional delta &amp; mean rate
            </p>
          </div>
          {summary && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClearAll}
              aria-label="Clear all logged positions"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Watch reference / serial note */}
        <div>
          <label htmlFor="watch-reference-input" className="sr-only">
            Watch reference or serial note
          </label>
          <input
            id="watch-reference-input"
            type="text"
            value={watchRef}
            onChange={(e) => onWatchRefChange(e.target.value)}
            placeholder="Watch reference or caliber note…"
            className="h-9 w-full rounded-lg border border-input bg-scope-well px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 outline-none"
          />
        </div>

        {/* Capture button for active position */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs font-medium text-foreground">
              Active: {activeMeta.code} · {activeMeta.label}
            </div>
            <div className="text-xs leading-snug text-muted-foreground">
              {activeMeta.hint}
            </div>
          </div>
          <Button
            size="sm"
            disabled={!canLogCurrent}
            onClick={onLogCurrent}
            className="h-9 shrink-0 gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Log {activeMeta.code}</span>
          </Button>
        </div>

        {/* 6-row positional table */}
        <div className="divide-y divide-border rounded-lg border border-border">
          {WATCH_POSITIONS.map((pos) => {
            const entry = readings[pos.code];
            const selected = activePosition === pos.code;
            return (
              <div
                key={pos.code}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-xs transition-[background-color] duration-150 ease-out motion-reduce:transition-none ${
                  selected ? "bg-secondary/75" : "hover:bg-secondary/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectPosition(pos.code)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring outline-none"
                >
                  <span className="w-8 shrink-0 font-mono font-semibold text-foreground tabular-nums">
                    {pos.code}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {pos.label}
                  </span>
                </button>

                {entry ? (
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-semibold text-foreground">
                      <span className="font-mono">
                        {entry.rate >= 0 ? "+" : ""}
                        {entry.rate.toFixed(1)}
                      </span>{" "}
                      s/d
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {entry.amplitude !== null
                        ? `${Math.round(entry.amplitude)}°`
                        : "--"}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-mono">{entry.beatError.toFixed(1)}</span>ms
                    </span>
                    <button
                      type="button"
                      onClick={() => onClearPosition(pos.code)}
                      aria-label={`Remove ${pos.label} reading`}
                      className="ml-0.5 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <span className="font-mono text-muted-foreground/70 tabular-nums">
                    --
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary metrics */}
        {summary ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">
                Positional Summary ({summary.count}/6)
              </span>
              {summary.count >= 2 && (
                <Badge
                  variant={summary.coscPass ? "default" : "secondary"}
                  className={
                    summary.coscPass
                      ? "bg-signal-lock text-primary-foreground"
                      : ""
                  }
                >
                  {summary.coscPass && <Check className="size-3" />}
                  {summary.coscPass ? "Within -4/+6 s/d" : "Needs regulation"}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mean rate</span>
                <span className="font-semibold text-foreground">
                  <span className="font-mono">
                    {summary.meanRate >= 0 ? "+" : ""}
                    {summary.meanRate.toFixed(1)}
                  </span>{" "}
                  s/d
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Δ</span>
                <span className="font-semibold text-foreground">
                  <span className="font-mono">
                    {summary.maxPositionalDelta.toFixed(1)}
                  </span>{" "}
                  s/d
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mean amp</span>
                <span className="font-mono font-semibold text-foreground">
                  {summary.meanAmplitude !== null
                    ? `${Math.round(summary.meanAmplitude)}°`
                    : "--"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max beat</span>
                <span className="font-semibold text-foreground">
                  <span className="font-mono">
                    {summary.maxBeatError.toFixed(2)}
                  </span>{" "}
                  ms
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Wait for a reading to lock, then press{" "}
            <span className="font-medium text-foreground">Log {activeMeta.code}</span>{" "}
            (or key <span className="font-medium text-foreground">L</span>) to record
            positional variance across horizontal and vertical orientations.
          </p>
        )}
      </div>

      {/* Export actions */}
      {summary && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopySummary}
            className="h-9 flex-1 gap-1.5"
          >
            <ClipboardCopy className="size-3.5" />
            <span>Copy Slip</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onPrintSlip}
            className="h-9 flex-1 gap-1.5"
          >
            <Printer className="size-3.5" />
            <span>Print Slip</span>
          </Button>
        </div>
      )}
    </aside>
  );
}
