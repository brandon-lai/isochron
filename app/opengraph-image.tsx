import { ImageResponse } from "next/og";

export const alt =
  "Isochron — Acoustic Mechanical Watch Timegrapher (+2.4 s/d, 288 degrees, 0.20 ms)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PALETTE = {
  chassis: ["#", "f4f3ef"].join(""),
  well: ["#", "faf9f6"].join(""),
  rule: ["#", "d8d5cd"].join(""),
  ink: ["#", "131720"].join(""),
  muted: ["#", "5b606b"].join(""),
  accent: ["#", "cc3818"].join(""),
  lock: ["#", "1b7f5a"].join(""),
};

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PALETTE.chassis,
          color: PALETTE.ink,
          padding: "56px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: `4px solid ${PALETTE.ink}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 32,
                  background: PALETTE.accent,
                }}
              />
            </div>
            <span style={{ fontSize: 34, fontWeight: 700 }}>Isochron</span>
          </div>
          <div
            style={{
              background: PALETTE.lock,
              color: PALETTE.well,
              padding: "8px 18px",
              borderRadius: 999,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Locked · 48.0 kHz WebAssembly DSP
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 600,
              lineHeight: 1.15,
              maxWidth: 920,
            }}
          >
            Acoustic mechanical watch timegrapher in the browser.
          </div>
          <div style={{ fontSize: 24, color: PALETTE.muted }}>
            Measure daily rate, balance amplitude, and beat error from your
            microphone — 100% local &amp; offline-ready.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            border: `2px solid ${PALETTE.rule}`,
            borderRadius: 20,
            background: PALETTE.well,
            padding: "28px 36px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 18, color: PALETTE.muted }}>
              Daily Rate
            </span>
            <span style={{ fontSize: 56, fontWeight: 700 }}>+2.4 s/d</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 18, color: PALETTE.muted }}>
              Amplitude (52°)
            </span>
            <span style={{ fontSize: 56, fontWeight: 700 }}>288°</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 18, color: PALETTE.muted }}>
              Beat Error
            </span>
            <span style={{ fontSize: 56, fontWeight: 700 }}>0.20 ms</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 18, color: PALETTE.muted }}>
              Beat Rate
            </span>
            <span style={{ fontSize: 56, fontWeight: 700 }}>28,800</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
