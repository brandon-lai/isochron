---
version: alpha
name: isochron
description: Minimalist acoustic mechanical watch timegrapher inspired by Dieter Rams' Braun T1000 aluminum instruments and Witschi paper-strip chronoscopes.
colors:
  primary: "oklch(0.545 0.205 29)"
  primary-ink: "oklch(0.982 0.004 85)"
  secondary: "oklch(0.928 0.006 85)"
  signal-lock: "oklch(0.515 0.142 156)"
  signal-amber: "oklch(0.505 0.125 68)"
  trace-toc: "oklch(0.495 0.135 248)"
  paper-chassis: "oklch(0.966 0.005 85)"
  scope-well: "oklch(0.986 0.004 85)"
  ink-primary: "oklch(0.182 0.008 255)"
  ink-muted: "oklch(0.445 0.010 255)"
  hairline: "oklch(0.868 0.007 85)"
  input-edge: "oklch(0.785 0.009 85)"
  dark-chassis: "oklch(0.152 0.007 255)"
  dark-well: "oklch(0.186 0.008 255)"
  dark-ink: "oklch(0.946 0.006 85)"
  dark-primary: "oklch(0.655 0.195 29)"
typography:
  metric-hero:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: -0.03em
    fontFeature: "'tnum' 1, 'zero' 1"
  metric-md:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1, 'zero' 1"
  mono-spec:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0em
    fontFeature: "'tnum' 1"
  title-instrument:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.24
    letterSpacing: -0.018em
  section-title:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.32
    letterSpacing: -0.01em
  body-sm:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  caption-xs:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0em
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  full: 999px
spacing:
  2xs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  instrument-chassis:
    backgroundColor: "{colors.paper-chassis}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body-sm}"
    padding: "{spacing.lg}"
  scope-bay:
    backgroundColor: "{colors.scope-well}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.mono-spec}"
    rounded: "{rounded.lg}"
    padding: "{spacing.base}"
  metric-readout:
    backgroundColor: "{colors.paper-chassis}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.metric-hero}"
    padding: "{spacing.md}"
  capture-trigger:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.section-title}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  mode-pill:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption-xs}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  lock-pill:
    backgroundColor: "{colors.signal-lock}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.caption-xs}"
    rounded: "{rounded.xs}"
    padding: "{spacing.2xs}"
  settling-pill:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.caption-xs}"
    rounded: "{rounded.xs}"
    padding: "{spacing.2xs}"
  tock-series:
    backgroundColor: "{colors.trace-toc}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.metric-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  divider-rule:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.title-instrument}"
    padding: "{spacing.2xl}"
  field-border:
    backgroundColor: "{colors.input-edge}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  night-chassis:
    backgroundColor: "{colors.dark-chassis}"
    textColor: "{colors.dark-ink}"
    typography: "{typography.body-sm}"
    padding: "{spacing.lg}"
  night-well:
    backgroundColor: "{colors.dark-well}"
    textColor: "{colors.dark-primary}"
    typography: "{typography.mono-spec}"
    rounded: "{rounded.lg}"
    padding: "{spacing.base}"
---

# Isochron Design System

## 1. Mode & Scene Sentence

- **Surface Mode:** **Operate** — a single-screen acoustic instrument that stays out of the watchmaker's way.
- **Scene Sentence:** A collector or watchmaker sits at a quiet desk in morning daylight (or late-night lamp light), pressing a wristwatch crown against their phone's bottom microphone or a piezo pickup clip while reading rate, amplitude, and beat error from arm's length.
- **Default Polarity:** **Light first** (`paper-chassis: oklch(0.966 0.005 85)`, warm anodized pebble aluminum, like a Dieter Rams Braun T1000 or Witschi Watch Expert IV housing), with `[data-theme="dark"]` switching cleanly to matte graphite titanium (`oklch(0.152 0.007 255)`).

## 2. World & Material Vocabulary

Stock timegrapher apps look either like 1998 Windows oscilloscope clutter or generic dark neon dashboards. Isochron takes its vocabulary from **1960s Ulm/Braun industrial metrology and Swiss paper-strip chronoscopes**:

- **Surface hierarchy without nested cards:** One outer instrument grid divided by crisp `1px` hairline rules (`hairline`), one recessed scope bay (`scope-well`), and tabular `JetBrains Mono` readouts (`tnum`, slashed `zero`) at `44px` (`clamp(1.85rem, 3.4vw, 2.75rem)` fluidly in CSS).
- **Restrained color posture:** Every neutral carries a subtle warm-stone (`hue 85`) or slate-titanium (`hue 255`) tint — zero pure `#fff` or `#000`. Color appears only when carrying measurement semantics:
  - **Signal Vermilion (`primary`):** Active microphone capture button and detected impulse cursor.
  - **Phosphor Emerald (`signal-lock`):** Settled lock state (`±1.0 s/d` spread achieved).
  - **Cobalt Tock (`trace-toc`):** Tock waveform / trace separation against primary Tick marks so beat error (`ms`) is visible by eye before the numbers finish settling.

## 3. Signature Moment

The **Tri-Mode Live Acoustic Scope**:
1. **Paper Trace:** Witschi-style vertical rising dot ribbon where slope directly reveals daily rate (`+s/d` tilts right, `-s/d` tilts left) and twin-column separation reveals beat error (`ms`).
2. **Escapement Beat:** Epoch-folded Tick & Tock acoustic envelopes overlaid with a nonlinear `asin(liftAngle / 2θ)` degree ruler along the top edge so unlock, impulse, and drop sub-peaks can be inspected visually.
3. **Raw Sensor:** Live high-frequency input monitor with peak headroom bar (`0.6–0.9` sweet spot vs. `CLIP` warning) and raw browser DSP audit (`AGC`, `Noise Suppression`, `Echo Cancellation`, `Sample Rate`).

## 4. Motion & Linter Notes

- **High-frequency discipline:** Scope tabs, position buttons, and caliber switches respond in `120ms` (`cubic-bezier(0.2, 0, 0, 1)`) on explicit properties only (`color`, `background-color`, `border-color`, `opacity`, `transform`), gated behind `prefers-reduced-motion`. Theme toggles suppress transitions for one frame so colors never smear.
- **Known `sloplint` notes:** Gate 20 ("no Hallmark stamp") is Hallmark's internal stamp bookkeeping and documented here per project convention.
