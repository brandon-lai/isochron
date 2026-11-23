import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import createModule from "../public/wasm/tg-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmBinary = fs.readFileSync(
  path.join(__dirname, "../public/wasm/tg-core.wasm"),
);

function addDampedBurst(out, centerSample, sampleRate, gain, freqHz, decayMs) {
  const start = Math.max(0, Math.floor(centerSample));
  const durationSamples = Math.min(
    out.length - start,
    Math.ceil((decayMs * 5.5 * sampleRate) / 1000),
  );
  if (durationSamples <= 0) return;

  const tau = (decayMs / 1000) * sampleRate;
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  const attackSamples = Math.max(2, Math.round(0.00018 * sampleRate));

  for (let i = 0; i < durationSamples; i++) {
    const attack = i < attackSamples ? i / attackSamples : 1;
    const env = attack * Math.exp(-i / tau);
    const carrier =
      0.72 * Math.sin(omega * i) + 0.28 * Math.sin(omega * 1.43 * i + 0.4);
    out[start + i] += gain * env * carrier;
  }
}

function synthWatch(durationSeconds, params) {
  const sr = params.sampleRate ?? 48000;
  const totalSamples = Math.floor(durationSeconds * sr);
  const out = new Float32Array(totalSamples);

  const rateFactor = 1 + params.rateSecondsPerDay / 86_400;
  const nominalBeatSeconds = 3600 / params.bph;
  const actualBeatSeconds = nominalBeatSeconds / rateFactor;
  const fullPeriodSeconds = actualBeatSeconds * 2;
  const beatErrorSeconds = params.beatErrorMs / 1000;
  const pulseSeconds =
    (fullPeriodSeconds / Math.PI) *
    Math.asin(params.liftAngle / (2 * params.amplitudeDegrees));

  let seed = 0x51f15e;
  for (let i = 0; i < totalSamples; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    out[i] = ((seed / 0xffffffff) * 2 - 1) * 0.002;
  }

  let cycle = 0;
  while (true) {
    const baseCycleStart = 0.06 + cycle * fullPeriodSeconds;
    if (baseCycleStart - 0.05 > durationSeconds) break;

    const drops = [
      { t: baseCycleStart, gainScale: 0.76 },
      {
        t: baseCycleStart + actualBeatSeconds - beatErrorSeconds,
        gainScale: 0.73,
      },
    ];

    for (const d of drops) {
      if (d.t < 0.015 || d.t >= durationSeconds - 0.005) continue;
      addDampedBurst(out, (d.t - pulseSeconds) * sr, sr, 0.16 * d.gainScale, 6200, 0.26);
      addDampedBurst(out, (d.t - pulseSeconds * 0.52) * sr, sr, 0.09 * d.gainScale, 5400, 0.24);
      addDampedBurst(out, d.t * sr, sr, 0.92 * d.gainScale, 7600, 0.34);
    }
    cycle++;
  }
  return out;
}

function measureWithWasm(mod, samples, sampleRate, bph, liftAngle) {
  const h = mod._tgw_init(sampleRate, bph, liftAngle);
  assert.ok(h > 0, "Expected non-zero tg handle");

  const chunk = 4096;
  const scratch = mod._malloc(chunk * 4);
  const resPtr = mod._malloc(mod._tgw_result_fields() * 8);
  const wfPts = mod._tgw_waveform_points();
  const wfTic = mod._malloc(wfPts * 4);
  const wfToc = mod._malloc(wfPts * 4);
  const wfInfo = mod._malloc(mod._tgw_waveform_fields() * 8);

  try {
    for (let offset = 0; offset < samples.length; offset += chunk) {
      const slice = samples.subarray(offset, Math.min(samples.length, offset + chunk));
      mod.HEAPF32.set(slice, scratch >> 2);
      mod._tgw_push(h, scratch, slice.length);
    }
    mod._tgw_result(h, resPtr);
    const base = resPtr >> 3;
    const hf = mod.HEAPF64;
    const hasWf = mod._tgw_waveform(h, wfTic, wfToc, wfInfo) !== 0;

    return {
      rate: hf[base + 0],
      amplitude: hf[base + 1],
      beatError: hf[base + 2],
      detectedBph: hf[base + 3],
      signalQuality: hf[base + 4],
      valid: hf[base + 5] !== 0,
      hasWaveform: hasWf && hf[(wfInfo >> 3) + 6] !== 0,
      ticPulseMs: hf[(wfInfo >> 3) + 4],
    };
  } finally {
    mod._tgw_destroy(h);
    mod._free(scratch);
    mod._free(resPtr);
    mod._free(wfTic);
    mod._free(wfToc);
    mod._free(wfInfo);
  }
}

async function loadTgModule() {
  return createModule({
    instantiateWasm(imports, receiveInstance) {
      WebAssembly.instantiate(wasmBinary, imports).then((output) => {
        receiveInstance(output.instance);
      });
      return {};
    },
  });
}

test("tg-core.wasm auto-detects 28,800 BPH and locks rate, amplitude, and beat error", async () => {
  const mod = await loadTgModule();
  const pcm = synthWatch(18, {
    sampleRate: 48000,
    bph: 28800,
    liftAngle: 52,
    rateSecondsPerDay: 2.4,
    amplitudeDegrees: 288,
    beatErrorMs: 0.3,
  });

  // Pass bph = 0 to prove automatic beat-rate detection works
  const res = measureWithWasm(mod, pcm, 48000, 0, 52);
  assert.equal(res.valid, true);
  assert.equal(res.detectedBph, 28800);
  assert.ok(
    Math.abs(res.rate - 2.4) < 0.4,
    `Expected rate ~ +2.4 s/d, got ${res.rate.toFixed(2)}`,
  );
  assert.ok(
    Math.abs(res.beatError - 0.3) < 0.15,
    `Expected beat error ~ 0.3 ms, got ${res.beatError.toFixed(2)}`,
  );
  assert.ok(
    Math.abs(res.amplitude - 288) < 12,
    `Expected amplitude ~ 288°, got ${res.amplitude.toFixed(1)}°`,
  );
  assert.equal(res.hasWaveform, true);
});

test("tg-core.wasm measures slow 21,600 BPH Seiko NH35 and vintage 18,000 BPH Unitas", async () => {
  const mod = await loadTgModule();

  const nh35 = measureWithWasm(
    mod,
    synthWatch(18, {
      sampleRate: 48000,
      bph: 21600,
      liftAngle: 53,
      rateSecondsPerDay: -6.5,
      amplitudeDegrees: 262,
      beatErrorMs: 0.6,
    }),
    48000,
    0,
    53,
  );
  assert.equal(nh35.valid, true);
  assert.equal(nh35.detectedBph, 21600);
  assert.ok(
    Math.abs(nh35.rate - -6.5) < 0.4,
    `Expected NH35 rate ~ -6.5 s/d, got ${nh35.rate.toFixed(2)}`,
  );
  assert.ok(
    Math.abs(nh35.beatError - 0.6) < 0.18,
    `Expected NH35 beat error ~ 0.6 ms, got ${nh35.beatError.toFixed(2)}`,
  );
  assert.ok(
    Math.abs(nh35.amplitude - 262) < 14,
    `Expected NH35 amplitude ~ 262°, got ${nh35.amplitude.toFixed(1)}°`,
  );

  const unitas = measureWithWasm(
    mod,
    synthWatch(18, {
      sampleRate: 48000,
      bph: 18000,
      liftAngle: 44,
      rateSecondsPerDay: 11.0,
      amplitudeDegrees: 248,
      beatErrorMs: 1.4,
    }),
    48000,
    18000,
    44,
  );
  assert.equal(unitas.valid, true);
  assert.equal(unitas.detectedBph, 18000);
  assert.ok(
    Math.abs(unitas.rate - 11.0) < 0.5,
    `Expected Unitas rate ~ +11.0 s/d, got ${unitas.rate.toFixed(2)}`,
  );
  assert.ok(
    Math.abs(unitas.beatError - 1.4) < 0.2,
    `Expected Unitas beat error ~ 1.4 ms, got ${unitas.beatError.toFixed(2)}`,
  );
});
