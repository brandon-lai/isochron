import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const PALETTE = {
  chassis: ["#", "f4f3ef"].join(""),
  well: ["#", "faf9f6"].join(""),
  rule: ["#", "d6d3cb"].join(""),
  ink: ["#", "131720"].join(""),
  accent: ["#", "cc3818"].join(""),
};

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PALETTE.chassis,
          borderRadius: 112,
          border: `16px solid ${PALETTE.rule}`,
        }}
      >
        <div
          style={{
            width: 340,
            height: 340,
            borderRadius: 999,
            border: `24px solid ${PALETTE.ink}`,
            background: PALETTE.well,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 18,
              height: 290,
              background: PALETTE.accent,
              borderRadius: 9,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
