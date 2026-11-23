import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

const productionHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "isochron.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${productionHost}`),
  title: {
    default: "Isochron — Acoustic Mechanical Watch Timegrapher",
    template: "%s · Isochron",
  },
  description:
    "Measure mechanical watch daily rate (s/d), balance amplitude (°), and beat error (ms) directly from your microphone using local WebAssembly DSP.",
  applicationName: "Isochron",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Isochron",
  },
  openGraph: {
    title: "Isochron — Acoustic Mechanical Watch Timegrapher",
    description:
      "Browser & offline PWA watch chronoscope powered by vacaboja/tg + FFTW3f WebAssembly DSP.",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Isochron acoustic mechanical watch timegrapher readout showing +2.4 s/d, 288 degrees amplitude, and 0.20 ms beat error",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Isochron — Acoustic Mechanical Watch Timegrapher",
    description:
      "Measure watch rate, amplitude, and beat error from your microphone with local WebAssembly DSP.",
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        fontSans.variable,
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-left" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
