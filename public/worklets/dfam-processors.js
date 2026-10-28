/* eslint-disable */
// ============================================================================
// DFAM - the whole Moog DFAM in one AudioWorkletProcessor ('dfam').
//
//   CLOCK (0.7-700 Hz, 1 V/oct TEMPO CV) --> 8-step SEQUENCER --> PITCH / VELOCITY
//     (ADV/CLOCK replaces it)                  | TRIGGER normal --> VCO EG, VCF EG, VCA EG
//   VCO 1 --+--> 1->2 FM (linear) --> VCO 2 (hard sync to VCO 1)    velocity scales all three
//           +--------------+  +-------------+
//   NOISE / EXT AUDIO ---> MIXER --> 4-pole LADDER (LP/HP) --> VCA --> VOLUME --> out
//                                    ^ VCF EG, NOISE/VCF MOD (the VCF MOD jack replaces the noise)
//
// Why one processor: sample-accurate envelopes and sequencing, audio-rate
// clocking (the DFAM clock is an oscillator), zero-latency self-patching and a
// single node per instance (cheap on iPad). Self-patches (DFAM out -> DFAM in)
// run through an internal patch matrix, so they never form Web Audio cycles.
// Cables from other instruments arrive on the a-rate params 'in0'..'in14'
// (1.0 = 5 V); clock/trigger events arrive as timed port messages.
//
// Output: one output, 9 channels (1.0 = 5 V):
//   0 VCA (main, post VOLUME)  1 VCA EG  2 VCF EG  3 VCO EG  4 VCO 1  5 VCO 2
//   6 TRIGGER  7 VELOCITY  8 PITCH
// Internally everything is in volts.
// ============================================================================

const NSTEP = 8;

// Knob slots - the engine sends { t: 'k', i, v } in engine units (devices/dfam/model.ts)
const K_VCO1_FREQ = 0, K_VCO2_FREQ = 1, K_VCO1_EG = 2, K_VCO2_EG = 3, K_VCO1_WAVE = 4, K_VCO2_WAVE = 5;
const K_FM = 6, K_SYNC = 7, K_VCO_DECAY = 8, K_SEQ_MOD = 9, K_VCO1_LEVEL = 10, K_VCO2_LEVEL = 11;
const K_NOISE_LEVEL = 12, K_CUTOFF = 13, K_RES = 14, K_VCF_EG = 15, K_VCF_MODE = 16, K_VCF_DECAY = 17;
const K_NOISE_VCF = 18, K_VCA_DECAY = 19, K_VCA_SLOW = 20, K_VOLUME = 21, K_TEMPO = 22, K_RUN = 23;
const K_PITCH = 24, K_VEL = 32, NK = 40;

// Patch points
const I_TRIG = 0, I_VCA_CV = 1, I_VEL = 2, I_VCA_DEC = 3, I_EXT = 4, I_VCF_DEC = 5, I_NOISE = 6, I_VCO_DEC = 7;
const I_VCF_MOD = 8, I_VCO1_CV = 9, I_FM = 10, I_VCO2_CV = 11, I_TEMPO = 12, I_RUN = 13, I_ADV = 14, NIN = 15;
const O_VCA = 0, O_VCA_EG = 1, O_VCF_EG = 2, O_VCO_EG = 3, O_VCO1 = 4, O_VCO2 = 5, O_TRIG = 6, O_VEL = 7, O_PITCH = 8, NOUT = 9;

// Scaling
const EG_PEAK = 8;            // envelopes peak at +8 V at full velocity
const VCO_EG_OCT = 5;         // octaves of pitch sweep: full VCO EG AMOUNT, full-velocity envelope
const VCF_EG_OCT = 6;         // octaves of cutoff sweep: full VCF EG AMOUNT
const BASE_HZ = 130.8128;     // VCO FREQUENCY at noon = C3
const EDGE_ON = 1.5, EDGE_OFF = 1.0; // gate / trigger thresholds (volts)
const DEDUPE = 0.0015;        // an event and an audio pulse closer than this are one pulse
const FB_SAT = 2.4;           // ladder feedback saturation (lets self-oscillation reach ~VCO level)
const TRIG_OUT_SEC = 0.001;   // TRIGGER output pulse width

// Continuous knobs smoothed per sample (others jump)
const SMOOTHED = [K_VCO1_FREQ, K_VCO2_FREQ, K_VCO1_EG, K_VCO2_EG, K_FM, K_VCO1_LEVEL, K_VCO2_LEVEL, K_NOISE_LEVEL, K_RES, K_VCF_EG, K_NOISE_VCF, K_VOLUME];
const IS_SMOOTHED = new Uint8Array(NK);
SMOOTHED.forEach(i => { IS_SMOOTHED[i] = 1; });

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Rational tanh: accurate to ~1e-3, monotonic, exactly +-1 beyond |x| = 3 */
function tanhf(x) {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return x * (27 + x2) / (27 + 9 * x2);
}

// ----------------------------------------------------------------------------
// Band-limited oscillator edges (2-point polyBLEP / polyBLAMP).
// The oscillator output runs one sample late, so a discontinuity found while
// computing sample n corrects both sample n-1 (ca) and sample n (cb).
// d = samples from the discontinuity to sample n (0 <= d < 1).
// ----------------------------------------------------------------------------

function makeOsc() { return { p: Math.random(), y: 0, ca: 0, cb: 0 }; }

/** Value step of height h */
function blep(o, h, d) {
  if (h === 0) return;
  const e = 1 - d;
  o.ca += 0.5 * h * d * d;
  o.cb -= 0.5 * h * e * e;
}

/** Slope step of ds per sample */
function blamp(o, ds, d) {
  if (ds === 0) return;
  const e = 1 - d;
  o.ca += ds * d * d * d / 6;
  o.cb += ds * e * e * e / 6;
}

/**
 * Edges of a square (wave 0) or triangle (wave 1) while its phase moves p0 -> p
 * (wrapped: it crossed 1.0). dExtra: samples from the end of that move to sample n.
 */
function edges(o, wave, p0, p, wrapped, dt, dExtra) {
  if (wrapped) {
    const d = p / dt + dExtra;
    if (d < 1) { if (wave === 0) blep(o, 2, d); else blamp(o, 8 * dt, d); }
  } else if (p0 < 0.5 && p >= 0.5) {
    const d = (p - 0.5) / dt + dExtra;
    if (d < 1) { if (wave === 0) blep(o, -2, d); else blamp(o, -8 * dt, d); }
  }
}

/** Output the corrected previous sample and store the naive current one */
function emit(o, wave) {
  const p = o.p;
  const naive = wave === 0 ? (p < 0.5 ? 1 : -1) : (p < 0.5 ? 4 * p - 1 : 3 - 4 * p);
  const out = o.y + o.ca;
  o.y = naive; o.ca = o.cb; o.cb = 0;
  return out;
}

// ----------------------------------------------------------------------------
// Decay envelope: RC attack toward 1.3x the peak (the analog curve), then an
// exponential decay that falls 60 dB over the DECAY time. Decay CV is in
// volts: +1 V doubles the decay time (it sums with the knob).
// ----------------------------------------------------------------------------

class Envelope {
  constructor() {
    this.v = 0; this.peak = 0; this.stage = 0; // 0 idle, 1 attack, 2 decay
    this.atk = 0; this.rate = 0; this.mul = 1; this.lastCv = 0;
  }
  trigger(peak, attackSec, decaySec, sr) {
    this.peak = peak;
    const tau = Math.max(1e-5, attackSec / 1.466);
    this.atk = 1 - Math.exp(-1 / (tau * sr));
    this.rate = 6.9 / (Math.max(0.0005, decaySec) * sr);
    this.mul = Math.exp(-this.rate);
    this.lastCv = 0;
    if (this.v >= peak) this.stage = peak > 0 || this.v > 0 ? 2 : 0;
    else this.stage = 1;
  }
  step(cv) {
    if (this.stage === 1) {
      this.v += (this.peak * 1.3 - this.v) * this.atk;
      if (this.v >= this.peak) { this.v = this.peak; this.stage = 2; }
    } else if (this.stage === 2) {
      if (cv !== this.lastCv) {
        this.lastCv = cv;
        this.mul = Math.exp(-this.rate * Math.pow(2, -clamp(cv, -12, 12)));
      }
      this.v *= this.mul;
      if (this.v < 1e-4) { this.v = 0; this.stage = 0; }
    }
    return this.v;
  }
}

class DfamProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const d = [];
    for (let j = 0; j < NIN; j++) d.push({ name: 'in' + j, defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' });
    return d;
  }

  constructor() {
    super();
    const sr = sampleRate;
    this.sr = sr;
    const k = new Float64Array(NK);
    k[K_VCO1_WAVE] = 1; k[K_VCO2_WAVE] = 1; k[K_SYNC] = 0;
    k[K_VCO_DECAY] = 0.1; k[K_VCF_DECAY] = 0.3; k[K_VCA_DECAY] = 0.3;
    k[K_VCO1_LEVEL] = 0.75; k[K_CUTOFF] = 2000; k[K_VCF_MODE] = 1; k[K_VOLUME] = 0.75; k[K_TEMPO] = 8;
    for (let i = 0; i < NSTEP; i++) k[K_VEL + i] = 1;
    this.k = k;                       // targets
    this.s = Float64Array.from(k);    // smoothed
    this.cutLog = Math.log2(k[K_CUTOFF]);
    this.smoothA = 1 - Math.exp(-1 / (0.006 * sr));
    this.fresh = true;                // the first settings apply instantly (no glide from defaults)

    // Patching
    this.patched = new Uint8Array(NIN);    // any cable (internal or external) in this input
    this.routes = [];                      // internal self-patches [out, in, scale]
    this.prevOut = new Float64Array(NOUT); // last sample of every output (volts) for internal routes
    this.inV = new Float64Array(NIN);
    this.active = [];                      // inputs with a live external signal this block

    // Envelopes
    this.egVco = new Envelope(); this.egVcf = new Envelope(); this.egVca = new Envelope();

    // Sequencer and clock
    this.step = NSTEP - 1;         // parked on step 8, so the first clock plays step 1
    this.running = false; this.runButton = false;
    this.runGate = false; this.runEvent = false;
    this.audition = false; this.auditionStep = -1;
    this.phase = 0;
    this.trigHigh = false; this.advHigh = false;
    this.lastTrigAudio = -1; this.lastTrigEvent = -1;
    this.lastAdvAudio = -1; this.lastAdvEvent = -1; this.lastAdvAt = -1;
    this.queue = [];
    this.trigOut = 0;              // samples left of the TRIGGER output pulse
    this.seqPitch = 0;             // volts on the internal pitch bus

    // Oscillators and noise
    this.osc1 = makeOsc(); this.osc2 = makeOsc();
    this.drift1 = 0; this.drift2 = 0; this.driftT1 = 0; this.driftT2 = 0; this.driftCount = 0;
    this.seed = (Math.random() * 0xffffffff) >>> 0 || 1;
    this.pitch1Last = NaN; this.f1 = 0;
    this.pitch2Last = NaN; this.f2Base = 0;
    this.fmLast = -1; this.fmIndex = 0;

    // Ladder state and coefficient cache
    this.z0 = 0; this.z1 = 0; this.z2 = 0; this.z3 = 0;
    this.cutLast = NaN; this.gCut = 0;
    // DC blocker (8 Hz) on the main output
    this.dcX = 0; this.dcY = 0; this.dcR = 1 - (2 * Math.PI * 8) / sr;

    // UI reporting
    this.uiDirty = true; this.uiTrig = false; this.uiLast = -1;

    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(m) {
    switch (m.t) {
      case 'k':
        this.k[m.i] = m.v;
        if (this.fresh || !IS_SMOOTHED[m.i]) this.s[m.i] = m.v;
        if (m.i === K_CUTOFF && this.fresh) this.cutLog = Math.log2(clamp(m.v, 5, 22000));
        if (m.i === K_RUN) this.runButton = m.v > 0.5;
        break;
      case 'patched':
        this.patched[m.i] = m.v ? 1 : 0;
        if (m.i === I_RUN && !m.v) { this.runGate = false; this.runEvent = false; }
        break;
      case 'routes': this.routes = m.routes; break;
      case 'trig': this.push(0, 'button-trig'); break;
      case 'adv': this.push(0, 'button-adv'); break;
      case 'ev': this.push(m.time, m.ch, m.v); break;
      case 'audition': this.push(0, m.v ? 'aud-on' : 'aud-off'); break;
    }
  }

  push(time, ch, v) {
    this.queue.push({ time, ch, v });
    if (this.queue.length > 1) this.queue.sort((a, b) => a.time - b.time);
  }

  // --------------------------------------------------------------------------
  // Sequencer
  // --------------------------------------------------------------------------

  /** Fire all three envelopes (TRIGGER normal, TRIGGER jack or TRIGGER button) */
  fire() {
    const vel = this.patched[I_VEL] ? clamp(this.inV[I_VEL] / 5, 0, 1.6) : this.k[K_VEL + this.step];
    const sr = this.sr, k = this.k;
    // Velocity sets each envelope's level and stretches its decay a little (harder hit, longer ring)
    const vs = Math.pow(2, (Math.min(vel, 1) - 1) * 0.75);
    const peak = EG_PEAK * vel;
    this.egVco.trigger(peak, 0.001, k[K_VCO_DECAY] * vs, sr);
    this.egVcf.trigger(peak, 0.001, k[K_VCF_DECAY] * vs, sr);
    this.egVca.trigger(peak, k[K_VCA_SLOW] > 0.5 ? 0.1 : 0.001, k[K_VCA_DECAY] * vs, sr);
    this.trigOut = Math.round(TRIG_OUT_SEC * sr);
    this.uiTrig = true; this.uiDirty = true;
  }

  advance() {
    this.step = (this.step + 1) % NSTEP;
    this.seqPitch = this.k[K_PITCH + this.step];
    this.uiDirty = true;
  }

  /** One clock pulse: advance, then play the step through the TRIGGER normal */
  clockPulse() {
    this.lastAdvAt = currentTime;
    this.advance();
    if (!this.patched[I_TRIG]) this.fire();
  }

  handleEvent(ev) {
    switch (ev.ch) {
      case 'button-trig': this.fire(); break;
      case 'button-adv': this.advance(); break;
      case 'aud-on': {
        // Audition from step 1 when stopped - or when armed for an external clock that is not
        // sending pulses (studio stopped): then the internal clock plays the phrase
        const idleClock = this.running && this.patched[I_ADV] && currentTime - this.lastAdvAt > 0.5;
        if (!this.audition && (!this.running || idleClock)) {
          this.audition = true; this.auditionStep = this.step; this.step = NSTEP - 1;
          if (this.running) this.phase = 1;
        }
        break;
      }
      case 'aud-off':
        if (this.audition) {
          this.audition = false;
          if (this.auditionStep >= 0) { this.step = this.auditionStep; this.seqPitch = this.k[K_PITCH + this.step]; }
          this.auditionStep = -1; this.uiDirty = true;
        }
        break;
      // A cable from another instrument may carry both an event and an audio pulse: count it once
      case 'trig':
        if (Math.abs(ev.time - this.lastTrigAudio) < DEDUPE) break;
        this.lastTrigEvent = ev.time;
        this.fire();
        break;
      case 'adv':
        if (Math.abs(ev.time - this.lastAdvAudio) < DEDUPE) break;
        this.lastAdvEvent = ev.time;
        // ADV/CLOCK only plays while the sequencer runs (press RUN/STOP first)
        if (this.running && this.patched[I_ADV] && !this.audition) this.clockPulse();
        break;
      case 'run': this.runEvent = ev.v > 0.5; break;
    }
  }

  // --------------------------------------------------------------------------

  process(inputs, outputs, params) {
    const out = outputs[0];
    if (!out || out.length < NOUT) return true;
    const n = out[0].length;
    const sr = this.sr;
    const k = this.k, s = this.s;
    const t0 = currentTime;
    this.fresh = false;
    const routes = this.routes, nr = routes.length;
    const inV = this.inV, prev = this.prevOut, patched = this.patched;
    const egVco = this.egVco, egVcf = this.egVcf, egVca = this.egVca;
    const o1s = this.osc1, o2s = this.osc2;

    // External inputs with signal this block (most are silent)
    const active = this.active; active.length = 0;
    const arrs = [];
    for (let j = 0; j < NIN; j++) {
      const arr = params['in' + j];
      arrs.push(arr);
      if (arr.length > 1 || arr[0] !== 0) active.push(j);
      else inV[j] = 0;
    }
    const na = active.length;

    // Smoothing needed this block?
    const a = this.smoothA;
    const cutTarget = Math.log2(clamp(k[K_CUTOFF], 5, 22000));
    let smoothing = Math.abs(cutTarget - this.cutLog) > 1e-6;
    for (let q = 0; q < SMOOTHED.length && !smoothing; q++) {
      const id = SMOOTHED[q];
      if (Math.abs(k[id] - s[id]) > 1e-7) smoothing = true;
    }
    if (!smoothing) { for (let q = 0; q < SMOOTHED.length; q++) s[SMOOTHED[q]] = k[SMOOTHED[q]]; this.cutLog = cutTarget; }

    // Per-block switches
    const syncOn = k[K_SYNC] > 0.5;
    const seqMod = k[K_SEQ_MOD] | 0;
    const seq1 = seqMod === 0 ? 1 : 0, seq2 = seqMod === 1 ? 0 : 1;
    const wave1 = k[K_VCO1_WAVE] > 0.5 ? 1 : 0, wave2 = k[K_VCO2_WAVE] > 0.5 ? 1 : 0; // 1 = triangle
    const hp = k[K_VCF_MODE] < 0.5;
    const extOn = !!patched[I_EXT], modExt = !!patched[I_VCF_MOD];
    const nyq = 0.45 * sr, piOverSr = Math.PI / sr;

    // Slow analog drift (a few cents)
    if (++this.driftCount >= 32) {
      this.driftCount = 0;
      this.driftT1 = (Math.random() * 2 - 1) * 0.0025;
      this.driftT2 = (Math.random() * 2 - 1) * 0.0025;
    }
    this.drift1 += (this.driftT1 - this.drift1) * 0.02;
    this.drift2 += (this.driftT2 - this.drift2) * 0.02;
    const drift1 = this.drift1, drift2 = this.drift2;

    const oMain = out[0], oVcaEg = out[1], oVcfEg = out[2], oVcoEg = out[3], oVco1 = out[4], oVco2 = out[5];
    const oTrig = out[6], oVel = out[7], oPitch = out[8];

    for (let i = 0; i < n; i++) {
      const t = t0 + i / sr;

      // ---- inputs: cables from other instruments (1.0 = 5 V) + self-patches (last sample, volts) ----
      for (let q = 0; q < na; q++) {
        const j = active[q], arr = arrs[j];
        inV[j] = (arr.length > 1 ? arr[i] : arr[0]) * 5;
      }
      if (nr) {
        if (!na) for (let q = 0; q < nr; q++) inV[routes[q][1]] = 0;
        else for (let q = 0; q < nr; q++) { const j = routes[q][1]; if (active.indexOf(j) < 0) inV[j] = 0; }
        for (let q = 0; q < nr; q++) { const rt = routes[q]; inV[rt[1]] += prev[rt[0]] * rt[2]; }
      }

      // ---- smoothing ----
      if (smoothing) {
        for (let q = 0; q < SMOOTHED.length; q++) { const id = SMOOTHED[q]; s[id] += (k[id] - s[id]) * a; }
        this.cutLog += (cutTarget - this.cutLog) * a;
      }
      const curPitch = k[K_PITCH + this.step];
      if (this.seqPitch !== curPitch) {
        this.seqPitch += (curPitch - this.seqPitch) * a;
        if (Math.abs(curPitch - this.seqPitch) < 1e-6) this.seqPitch = curPitch;
      }

      // ---- timed events: buttons, cables from other instruments, auditions ----
      while (this.queue.length && this.queue[0].time <= t) this.handleEvent(this.queue.shift());

      // ---- RUN/STOP jack: runs while the gate is high ----
      if (patched[I_RUN]) {
        const gv = inV[I_RUN];
        if (!this.runGate && gv > EDGE_ON) this.runGate = true;
        else if (this.runGate && gv < EDGE_OFF) this.runGate = false;
      }
      const run = this.runButton || (patched[I_RUN] && (this.runGate || this.runEvent)) || this.audition;
      if (run !== this.running) {
        this.running = run;
        if (run) this.phase = 1;     // the internal clock fires at once: a parked step 8 plays step 1
        this.uiDirty = true;
      }

      // ---- TRIGGER jack: fires the envelopes without advancing ----
      if (patched[I_TRIG]) {
        const gv = inV[I_TRIG];
        if (!this.trigHigh && gv > EDGE_ON) {
          this.trigHigh = true;
          if (Math.abs(t - this.lastTrigEvent) >= DEDUPE) { this.lastTrigAudio = t; this.fire(); }
        } else if (this.trigHigh && gv < EDGE_OFF) this.trigHigh = false;
      }

      // ---- clock: a cable in ADV/CLOCK replaces the internal clock ----
      const extClock = patched[I_ADV] && !this.audition;
      if (patched[I_ADV]) {
        const gv = inV[I_ADV];
        if (!this.advHigh && gv > EDGE_ON) {
          this.advHigh = true;
          if (Math.abs(t - this.lastAdvEvent) >= DEDUPE) {
            this.lastAdvAudio = t;
            if (this.running && extClock) this.clockPulse();
          }
        } else if (this.advHigh && gv < EDGE_OFF) this.advHigh = false;
      }
      if (this.running && !extClock) {
        const tv = inV[I_TEMPO];
        const hz = tv === 0 ? k[K_TEMPO] : clamp(k[K_TEMPO] * Math.pow(2, tv), 0.02, 4000);
        this.phase += hz / sr;
        if (this.phase >= 1) {
          this.phase -= 1;
          if (this.phase >= 1) this.phase = 0;
          this.clockPulse();
        }
      }

      // ---- envelopes ----
      const vcoEg = egVco.stage ? egVco.step(inV[I_VCO_DEC]) : 0;
      const vcfEg = egVcf.stage ? egVcf.step(inV[I_VCF_DEC]) : 0;
      const vcaEg = egVca.stage ? egVca.step(inV[I_VCA_DEC]) : 0;

      // ---- VCO 1 (master) ----
      const seqV = this.seqPitch;
      const pitch1 = s[K_VCO1_FREQ] + inV[I_VCO1_CV] + seqV * seq1 + s[K_VCO1_EG] * VCO_EG_OCT * (vcoEg / EG_PEAK) + drift1;
      if (pitch1 !== this.pitch1Last) { this.pitch1Last = pitch1; this.f1 = BASE_HZ * Math.pow(2, pitch1); }
      let dt1 = this.f1 / sr;
      if (dt1 > 0.45) dt1 = 0.45;
      const p1a = o1s.p;
      let p1b = p1a + dt1;
      let wrapped = false, dWrap = 0;
      if (p1b >= 1) {
        p1b -= 1;
        wrapped = true;
        dWrap = p1b / dt1;               // samples since the wrap
        if (dWrap >= 1) dWrap = 0.999999;
      }
      edges(o1s, wave1, p1a, p1b, wrapped, dt1, 0);
      o1s.p = p1b;
      const vco1 = emit(o1s, wave1);   // band-limited, one sample late

      // ---- VCO 2: linear FM from VCO 1, hard sync to VCO 1 ----
      const pitch2 = s[K_VCO2_FREQ] + inV[I_VCO2_CV] + seqV * seq2 + s[K_VCO2_EG] * VCO_EG_OCT * (vcoEg / EG_PEAK) + drift2;
      if (pitch2 !== this.pitch2Last) { this.pitch2Last = pitch2; this.f2Base = BASE_HZ * Math.pow(2, pitch2); }
      const fmAmt = s[K_FM] + (patched[I_FM] ? inV[I_FM] / 8 : 0);
      if (fmAmt !== this.fmLast) { this.fmLast = fmAmt; this.fmIndex = fmAmt > 0.0005 ? 5 * Math.pow(Math.min(fmAmt, 1.25), 1.5) : 0; }
      let f2 = this.fmIndex ? this.f2Base * (1 + this.fmIndex * vco1) : this.f2Base;
      if (f2 < 0) f2 = 0;                // linear FM, not through-zero: the carrier stalls
      let dt2 = f2 / sr;
      if (dt2 > 0.45) dt2 = 0.45;
      const p2a = o2s.p;
      if (syncOn && wrapped) {
        // Run up to the reset instant (VCO 2 may have its own edges on the way)...
        let pr = p2a + (1 - dWrap) * dt2;
        let w2 = false;
        if (pr >= 1) { pr -= 1; w2 = true; }
        if (dt2 > 0) edges(o2s, wave2, p2a, pr, w2, dt2, dWrap);
        // ...then jump to phase 0, band-limiting the value step and (triangle) the slope step
        const before = wave2 === 0 ? (pr < 0.5 ? 1 : -1) : (pr < 0.5 ? 4 * pr - 1 : 3 - 4 * pr);
        blep(o2s, (wave2 === 0 ? 1 : -1) - before, dWrap);
        if (wave2 === 1) blamp(o2s, 4 * dt2 - (pr < 0.5 ? 4 : -4) * dt2, dWrap);
        o2s.p = dWrap * dt2;
      } else {
        let p2b = p2a + dt2;
        let w2 = false;
        if (p2b >= 1) { p2b -= 1; w2 = true; }
        if (dt2 > 0) edges(o2s, wave2, p2a, p2b, w2, dt2, 0);
        o2s.p = p2b;
      }
      const vco2 = emit(o2s, wave2);

      // ---- noise (xorshift32) / EXT AUDIO ----
      let x = this.seed;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.seed = x >>> 0;
      const noise = ((this.seed / 4294967296) * 2 - 1) * 1.2;

      // ---- mixer: audio-taper levels, NOISE LEVEL CV sums with its knob ----
      const l1 = s[K_VCO1_LEVEL], l2 = s[K_VCO2_LEVEL];
      let ln = s[K_NOISE_LEVEL];
      if (patched[I_NOISE]) ln = clamp(ln + inV[I_NOISE] / 8, 0, 1.3);
      const mix = vco1 * l1 * l1 * (0.55 + 0.45 * l1)
        + vco2 * l2 * l2 * (0.55 + 0.45 * l2)
        + (extOn ? inV[I_EXT] / 5 : noise) * ln * ln * (0.55 + 0.45 * ln);

      // ---- VCF: 4-pole ladder, zero-delay feedback, saturating input and feedback ----
      const modSrc = modExt ? inV[I_VCF_MOD] : noise * 5;        // volts, 1 V/oct at full depth
      const cutOct = this.cutLog + s[K_VCF_EG] * VCF_EG_OCT * (vcfEg / EG_PEAK) + s[K_NOISE_VCF] * modSrc;
      if (cutOct !== this.cutLast) {
        this.cutLast = cutOct;
        let fc = Math.pow(2, cutOct);
        if (fc < 8) fc = 8; else if (fc > nyq) fc = nyq;
        this.gCut = Math.tan(fc * piOverSr);
      }
      const g = this.gCut;
      const G = g / (1 + g), inv = 1 / (1 + g);
      const kk = s[K_RES] * 5;            // self-oscillates past ~80% (about 3 o'clock)
      const S1 = this.z0 * inv, S2 = this.z1 * inv, S3 = this.z2 * inv, S4 = this.z3 * inv;
      const G2 = G * G, G4 = G2 * G2;
      const sigma = G2 * G * S1 + G2 * S2 + G * S3 + S4;
      const xd = 1.6 * tanhf((mix + 1e-6 * noise) * 0.625) * (1 + 0.45 * kk); // soft input drive + bass make-up
      const y4e = (G4 * xd + sigma) / (1 + kk * G4);
      const u = FB_SAT * tanhf((xd - kk * y4e) / FB_SAT);
      let v = (u - this.z0) * G; const y1 = v + this.z0; this.z0 = y1 + v;
      v = (y1 - this.z1) * G; const y2 = v + this.z1; this.z1 = y2 + v;
      v = (y2 - this.z2) * G; const y3 = v + this.z2; this.z2 = y3 + v;
      v = (y3 - this.z3) * G; const y4 = v + this.z3; this.z3 = y4 + v;
      const filt = hp ? u - 4 * y1 + 6 * y2 - 4 * y3 + y4 : y4;

      // ---- VCA: envelope + VCA CV (summed, so it can clip - as on the hardware) ----
      let gv = vcaEg + (patched[I_VCA_CV] ? inV[I_VCA_CV] : 0);
      let main = 0;
      if (gv > 0) {
        gv /= EG_PEAK;
        if (gv > 1) gv = 1 + 0.3 * tanhf((gv - 1) / 0.3);
        let amp = filt * gv * 1.25;
        if (amp > 1.2 || amp < -1.2) { const c = 1.2 * tanhf(amp / 1.2); amp = c + (amp - c) * 0.15; }
        const vol = s[K_VOLUME];
        main = amp * vol * vol;
      }
      const dc = main - this.dcX + this.dcR * this.dcY;
      this.dcX = main; this.dcY = dc;
      main = dc;

      // ---- outputs ----
      const trig = this.trigOut > 0 ? 1 : 0;
      if (this.trigOut > 0) this.trigOut--;
      const velOut = k[K_VEL + this.step];
      oMain[i] = main;
      oVcaEg[i] = vcaEg * 0.2;
      oVcfEg[i] = vcfEg * 0.2;
      oVcoEg[i] = vcoEg * 0.2;
      oVco1[i] = vco1;
      oVco2[i] = vco2;
      oTrig[i] = trig;
      oVel[i] = velOut;
      oPitch[i] = curPitch * 0.2;
      if (nr) {
        prev[O_VCA] = main * 5; prev[O_VCA_EG] = vcaEg; prev[O_VCF_EG] = vcfEg; prev[O_VCO_EG] = vcoEg;
        prev[O_VCO1] = vco1 * 5; prev[O_VCO2] = vco2 * 5; prev[O_TRIG] = trig * 5; prev[O_VEL] = velOut * 5; prev[O_PITCH] = curPitch;
      }
    }

    // Denormal / blow-up guard
    if (!Number.isFinite(this.z0 + this.z1 + this.z2 + this.z3)) { this.z0 = this.z1 = this.z2 = this.z3 = 0; this.cutLast = NaN; }
    if (Math.abs(this.z0) < 1e-30) this.z0 = 0;
    if (Math.abs(this.z1) < 1e-30) this.z1 = 0;
    if (Math.abs(this.z2) < 1e-30) this.z2 = 0;
    if (Math.abs(this.z3) < 1e-30) this.z3 = 0;
    if (Math.abs(this.dcY) < 1e-30) this.dcY = 0;

    // UI: current step, running and trigger flash - at most every 25 ms
    const now = t0 + n / sr;
    if (this.uiDirty && now - this.uiLast >= 0.025) {
      // RUN LED: the button or the RUN/STOP gate - an audition does not light it
      const lit = this.runButton || (patched[I_RUN] && (this.runGate || this.runEvent));
      this.port.postMessage({ t: 's', step: this.step, run: lit ? 1 : 0, trig: this.uiTrig ? 1 : 0, time: now });
      this.uiDirty = false; this.uiTrig = false; this.uiLast = now;
    }
    return true;
  }
}

registerProcessor('dfam', DfamProcessor);
