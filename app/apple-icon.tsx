import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PALETTE = {
  chassis: ["#", "f4f3ef"].join(""),
  ink: ["#", "131720"].join(""),
  accent: ["#", "cc3818"].join(""),
};

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: 999,
            border: `10px solid ${PALETTE.ink}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 8,
              height: 102,
              background: PALETTE.accent,
              borderRadius: 4,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
