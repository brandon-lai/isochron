/*
    Isochron — Acoustic Watch Timegrapher
    Derived from vacaboja/tg (Marcello Mamino) and natemac/mac-timegrapher.
    Licensed under the GNU General Public License version 2.0 (GPL-2.0-only).
*/

import createModule from "/wasm/tg-core.js";

const R_RATE = 0;
const R_AMPLITUDE = 1;
const R_BEAT_ERROR = 2;
const R_DETECTED_BPH = 3;
const R_SIGNAL_QUALITY = 4;
const R_VALID = 5;

const W_POINTS = 0;
const W_MS_BEFORE = 1;
const W_MS_AFTER = 2;
const W_PERIOD_SECONDS = 3;
const W_TIC_PULSE_MS = 4;
const W_TOC_PULSE_MS = 5;
const W_VALID = 6;

const C_COLLECTED = 0;
const C_NEEDED = 1;
const C_SIGNAL = 2;
const C_STATE = 3;
const C_DRIFT = 4;

const CAL_INTERVAL_MS = 1000;
const MEASURE_INTERVAL_MS = 400;
const MAX_EVENTS = 100;

let mod = null;
let handle = 0;
let scratch = 0;
let scratchSamples = 0;
let resultPtr = 0;
let eventTimePtr = 0;
let eventTicTocPtr = 0;
let wfTicPtr = 0;
let wfTocPtr = 0;
let wfInfoPtr = 0;
let wfPoints = 0;
let calPtr = 0;
let timer = null;
let calTimer = null;
let calWanted = false;
let sampleRate = 0;
let samplesSeen = 0;

async function ensureModule() {
  if (!mod) {
    mod = await createModule({
      locateFile: (file) => `/wasm/${file}`,
    });
  }
  return mod;
}

function release() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (calTimer !== null) {
    clearInterval(calTimer);
    calTimer = null;
  }
  calWanted = false;
  if (mod && handle) {
    mod._tgw_cal_end(handle);
    mod._tgw_destroy(handle);
    if (scratch) mod._free(scratch);
    if (resultPtr) mod._free(resultPtr);
    if (eventTimePtr) mod._free(eventTimePtr);
    if (eventTicTocPtr) mod._free(eventTicTocPtr);
    if (wfTicPtr) mod._free(wfTicPtr);
    if (wfTocPtr) mod._free(wfTocPtr);
    if (wfInfoPtr) mod._free(wfInfoPtr);
    if (calPtr) mod._free(calPtr);
  }
  handle = 0;
  scratch = 0;
  scratchSamples = 0;
  resultPtr = 0;
  eventTimePtr = 0;
  eventTicTocPtr = 0;
  wfTicPtr = 0;
  wfTocPtr = 0;
  wfInfoPtr = 0;
  wfPoints = 0;
  calPtr = 0;
  samplesSeen = 0;
}

function readWaveformFor(activeHandle, activeWfTic, activeWfToc, activeWfInfo) {
  if (!mod || !activeHandle) return null;
  if (!mod._tgw_waveform(activeHandle, activeWfTic, activeWfToc, activeWfInfo)) {
    return null;
  }
  const info = mod.HEAPF64;
  const base = activeWfInfo >> 3;
  if (!info[base + W_VALID]) return null;

  const points = info[base + W_POINTS];
  const heap = mod.HEAPF32;
  return {
    tic: heap.slice(activeWfTic >> 2, (activeWfTic >> 2) + points),
    toc: heap.slice(activeWfToc >> 2, (activeWfToc >> 2) + points),
    msBefore: info[base + W_MS_BEFORE],
    msAfter: info[base + W_MS_AFTER],
    periodSeconds: info[base + W_PERIOD_SECONDS],
    ticPulseMs: info[base + W_TIC_PULSE_MS] > 0 ? info[base + W_TIC_PULSE_MS] : null,
    tocPulseMs: info[base + W_TOC_PULSE_MS] > 0 ? info[base + W_TOC_PULSE_MS] : null,
  };
}

function emitMeasurement() {
  if (!mod || !handle) return;
  mod._tgw_result(handle, resultPtr);
  const base = resultPtr >> 3;
  const h = mod.HEAPF64;

  const count = mod._tgw_events(handle, eventTimePtr, eventTicTocPtr, MAX_EVENTS);
  const times = new Float64Array(count);
  const isTick = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    times[i] = mod.HEAPF64[(eventTimePtr >> 3) + i];
    isTick[i] = mod.HEAPU8[eventTicTocPtr + i];
  }

  self.postMessage({
    type: "result",
    beats: { times, isTick },
    waveform: readWaveformFor(handle, wfTicPtr, wfTocPtr, wfInfoPtr),
    measurement: {
      rate: h[base + R_RATE],
      amplitude: h[base + R_AMPLITUDE],
      beatError: h[base + R_BEAT_ERROR],
      detectedBph: h[base + R_DETECTED_BPH],
      signalQuality: h[base + R_SIGNAL_QUALITY],
      valid: h[base + R_VALID] !== 0,
    },
    secondsCaptured: sampleRate > 0 ? samplesSeen / sampleRate : 0,
  });
}

function beginCalibration() {
  if (!mod || !handle) return;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (!mod._tgw_cal_begin(handle)) {
    calWanted = false;
    self.postMessage({
      type: "error",
      message: "Could not start the 1 Hz quartz crystal check.",
    });
    return;
  }
  samplesSeen = 0;
  if (calTimer === null) {
    calTimer = setInterval(emitCalibration, CAL_INTERVAL_MS);
  }
}

function emitCalibration() {
  if (!mod || !handle || !calPtr) return;
  mod._tgw_cal_update(handle, calPtr);
  const h = mod.HEAPF64;
  const base = calPtr >> 3;

  self.postMessage({
    type: "calibration",
    calibration: {
      collected: h[base + C_COLLECTED],
      needed: h[base + C_NEEDED],
      signal: h[base + C_SIGNAL],
      state: h[base + C_STATE],
      driftSecondsPerDay: h[base + C_DRIFT],
    },
    secondsCaptured: sampleRate > 0 ? samplesSeen / sampleRate : 0,
  });
}

async function analyzeOfflineBuffer(msg) {
  const m = await ensureModule();
  const sr = msg.sampleRate;
  const bph = msg.bph || 0;
  const liftAngle = msg.liftAngle || 52;
  const samples = msg.samples;

  const h = m._tgw_init(sr, bph, liftAngle);
  if (!h) {
    self.postMessage({
      type: "error",
      message: `Offline analysis rejected settings (${sr} Hz, ${bph || "auto"} BPH, ${liftAngle}°).`,
    });
    return;
  }

  const chunkLen = Math.max(4096, Math.round(sr * 0.5));
  const tmpScratch = m._malloc(chunkLen * 4);
  const tmpRes = m._malloc(m._tgw_result_fields() * 8);
  const tmpEvtTime = m._malloc(MAX_EVENTS * 8);
  const tmpEvtTic = m._malloc(MAX_EVENTS);
  const pts = m._tgw_waveform_points();
  const tmpWfTic = m._malloc(pts * 4);
  const tmpWfToc = m._malloc(pts * 4);
  const tmpWfInfo = m._malloc(m._tgw_waveform_fields() * 8);

  const collectedTimes = [];
  const collectedTic = [];
  let lastSeenTime = -1;

  try {
    for (let offset = 0; offset < samples.length; offset += chunkLen) {
      const slice = samples.subarray(offset, Math.min(samples.length, offset + chunkLen));
      m.HEAPF32.set(slice, tmpScratch >> 2);
      m._tgw_push(h, tmpScratch, slice.length);

      // Sample events periodically so long recordings preserve the full rising ribbon
      if (offset + slice.length >= sr * 4) {
        m._tgw_result(h, tmpRes);
        const c = m._tgw_events(h, tmpEvtTime, tmpEvtTic, MAX_EVENTS);
        for (let i = 0; i < c; i++) {
          const t = m.HEAPF64[(tmpEvtTime >> 3) + i];
          const tk = m.HEAPU8[tmpEvtTic + i];
          if (t > lastSeenTime + 0.005) {
            lastSeenTime = t;
            collectedTimes.push(t);
            collectedTic.push(tk);
          }
        }
      }
    }

    m._tgw_result(h, tmpRes);
    const base = tmpRes >> 3;
    const hf64 = m.HEAPF64;
    const wf = readWaveformFor(h, tmpWfTic, tmpWfToc, tmpWfInfo);

    self.postMessage({
      type: "offline-result",
      fileName: msg.fileName || "Recording",
      beats: {
        times: new Float64Array(collectedTimes),
        isTick: new Uint8Array(collectedTic),
      },
      waveform: wf,
      measurement: {
        rate: hf64[base + R_RATE],
        amplitude: hf64[base + R_AMPLITUDE],
        beatError: hf64[base + R_BEAT_ERROR],
        detectedBph: hf64[base + R_DETECTED_BPH],
        signalQuality: hf64[base + R_SIGNAL_QUALITY],
        valid: hf64[base + R_VALID] !== 0,
      },
      secondsCaptured: sr > 0 ? samples.length / sr : 0,
    });
  } finally {
    m._tgw_destroy(h);
    m._free(tmpScratch);
    m._free(tmpRes);
    m._free(tmpEvtTime);
    m._free(tmpEvtTic);
    m._free(tmpWfTic);
    m._free(tmpWfToc);
    m._free(tmpWfInfo);
  }
}

self.onmessage = async (event) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "init": {
        release();
        await ensureModule();
        sampleRate = msg.sampleRate;
        handle = mod._tgw_init(msg.sampleRate, msg.bph, msg.liftAngle);
        if (!handle) {
          self.postMessage({
            type: "error",
            message: `Measurement engine rejected settings (${msg.sampleRate} Hz, ${msg.bph || "auto"} BPH, ${msg.liftAngle}° lift angle).`,
          });
          return;
        }
        resultPtr = mod._malloc(mod._tgw_result_fields() * 8);
        eventTimePtr = mod._malloc(MAX_EVENTS * 8);
        eventTicTocPtr = mod._malloc(MAX_EVENTS);
        wfPoints = mod._tgw_waveform_points();
        wfTicPtr = mod._malloc(wfPoints * 4);
        wfTocPtr = mod._malloc(wfPoints * 4);
        wfInfoPtr = mod._malloc(mod._tgw_waveform_fields() * 8);
        calPtr = mod._malloc(mod._tgw_cal_fields() * 8);
        timer = setInterval(emitMeasurement, MEASURE_INTERVAL_MS);
        self.postMessage({ type: "ready" });
        if (calWanted) beginCalibration();
        break;
      }

      case "push": {
        if (!mod || !handle) return;
        const block = msg.samples;
        if (block.length > scratchSamples) {
          if (scratch) mod._free(scratch);
          scratchSamples = block.length;
          scratch = mod._malloc(scratchSamples * 4);
        }
        mod.HEAPF32.set(block, scratch >> 2);
        mod._tgw_push(handle, scratch, block.length);
        samplesSeen += block.length;
        break;
      }

      case "reset": {
        if (mod && handle) {
          mod._tgw_reset(handle);
          samplesSeen = 0;
        }
        break;
      }

      case "calibrate-start": {
        calWanted = true;
        beginCalibration();
        break;
      }

      case "calibrate-stop": {
        calWanted = false;
        if (calTimer !== null) {
          clearInterval(calTimer);
          calTimer = null;
        }
        if (mod && handle) {
          mod._tgw_cal_end(handle);
          mod._tgw_reset(handle);
          samplesSeen = 0;
          if (timer === null) {
            timer = setInterval(emitMeasurement, MEASURE_INTERVAL_MS);
          }
        }
        break;
      }

      case "analyze-buffer": {
        await analyzeOfflineBuffer(msg);
        break;
      }

      case "destroy": {
        release();
        break;
      }
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Measurement engine error.",
    });
  }
};
