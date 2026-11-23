import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Isochron — Acoustic Watch Timegrapher",
    short_name: "Isochron",
    description:
      "Offline-capable acoustic mechanical watch timegrapher measuring rate, amplitude, and beat error via WebAssembly DSP.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f3ef",
    theme_color: "#f4f3ef",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
