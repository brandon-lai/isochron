# Isochron

Isochron is a minimalist, offline-capable mechanical watch timegrapher PWA that measures daily rate (`s/d`), balance amplitude (`°`), and beat error (`ms`) directly from a device microphone using local WebAssembly DSP.

Design system and tokens: [`DESIGN.md`](./DESIGN.md).

## Open-Source DSP Engine & Attribution

Acoustic watch timegraphing is a solved open-source signal-processing problem. Rather than reinventing escapement impulse math in JavaScript, Isochron pairs a modern Dieter Rams / Witschi-inspired React + shadcn/ui instrument interface with Marcello Mamino's proven C timegrapher engine (**[`vacaboja/tg`](https://github.com/vacaboja/tg)**) compiled to WebAssembly with single-precision **FFTW3** (`libfftw3f`) via **[`natemac/mac-timegrapher`](https://github.com/natemac/mac-timegrapher)**.

### How the C + WebAssembly Pipeline Works

1. **Raw Acoustic Capture (`AudioWorklet` + WebRTC Audit):** Isochron requests mono PCM audio with `echoCancellation: false`, `noiseSuppression: false`, and `autoGainControl: false` so browser voice filters do not attenuate high-frequency `6–10 kHz` pallet-stone transients, then verifies actual hardware track settings via `MediaStreamTrack.getSettings()`.
2. **High-Pass Filtering & Envelope Extraction (`core/tg_algo.c`):** Incoming PCM blocks pass through multi-stage high-pass filtering and FFTW3f spectral correlation inside a dedicated Web Worker (`public/workers/tg-worker.js`) running `public/wasm/tg-core.wasm`.
3. **Beat Rate Auto-Detection (`12,000–36,000 BPH`):** Autocorrelation across standard horological frequencies (`18,000`, `19,800`, `21,600`, `25,200`, `28,800`, `36,000 BPH`) automatically locks onto the movement's nominal beat rate, or accepts manual override for exotic calibers (such as `25,200 BPH` Omega Co-Axial).
4. **Daily Rate & Beat Error:** Linear regression across odd ("Tick") and even ("Tock") beat arrival timestamps yields daily drift in seconds per day (`±0.1 s/d`) and half-cycle asymmetry in milliseconds (`±0.01 ms`).
5. **Epoch-Folded Escapement Waveform & Balance Amplitude:** Tick and Tock acoustic envelopes are phase-aligned around the locking/drop peak (`0.0 ms`). Measuring the time lag `Δt` between the pallet-stone unlock impulse and drop impulse solves the Swiss lever harmonic arc equation:
   $$\theta = \frac{\alpha}{2 \sin(\pi \cdot \Delta t / T)}$$
   where $\alpha$ is the movement's lift angle (preset across 29 common calibers from Rolex `3135/3235`, ETA `2824-2`, Sellita `SW200-1`, Seiko `NH35/6R15`, Miyota `9015`, and Speedmaster `1861/3861`, or manually stepped `28°–64°`) and $T$ is the beat period.

## Acoustic Physics & Hardware Notes

- **Daily Rate & Beat Error on Built-In Microphones:** Because rate and beat error depend only on the periodicity of locking peaks, pressing a watch crown or caseback directly against a smartphone's primary microphone in a quiet room reliably locks within ~8 seconds.
- **Balance Amplitude Sensitivity:** Accurate amplitude (`°`) requires clean acoustic separation between the tiny unlocking click and the louder locking drop impulse. Thick dive cases or ambient room noise can mask the unlock transient on an air-coupled mic; a `$15–$25` clip-on piezo contact watch microphone (TRRS or USB-C) couples directly through the steel caseback for bench-grade amplitude readings.
- **Crystal Clock Calibration:** Consumer audio ADC crystals typically exhibit `±5–30 ppm` clock tolerance (`1 ppm = 0.0864 s/d`). Isochron includes manual `±0.1 s/d` crystal trim and a live **1 Hz Quartz Reference Check** inside the **Calibrate** dialog.
- **Privacy & Offline Operation:** All DSP executes locally inside WebAssembly (`public/sw.js` caches the shell, workers, and `tg-core.wasm` for airplane-mode bench use). Zero audio is ever uploaded.

## Development & Verification

```bash
npm install
npm test          # Runs Node test suite against real tg-core.wasm (28,800 / 21,600 / 18,000 BPH)
npm run typecheck # TypeScript strict check
npm run build     # Production Next.js static + PWA build
npm run dev       # Local development server
```

To recompile `public/wasm/tg-core.{js,wasm}` from the C sources in `core/` and `wasm/` (requires Emscripten SDK + single-precision FFTW3 static archive):

```bash
FFTW3_DIR=/path/to/fftw3-wasm ./wasm/build-wasm.sh
```

## License

Isochron is free and open-source software distributed under the **GNU General Public License v2.0 (`GPL-2.0-only`)**. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for full terms and upstream attribution to Marcello Mamino (`vacaboja/tg`) and Nathan McIntyre (`natemac/mac-timegrapher`).
