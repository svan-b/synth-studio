/* eslint-disable */
// ============================================================================
// Synth Studio AudioWorklet processors (shared DSP core) - see docs/DSP.md
//
//   'vco'        - band-limited oscillator. One output, 4 channels:
//                  [0] triangle  [1] saw  [2] pulse  [3] sine
//                  (+ [4] sub -1 oct, [5] sub -2 oct squares with
//                  processorOptions.subs = true and outputChannelCount [6]).
//                  4-point polyBLEP / polyBLAMP on every discontinuity,
//                  including sub-sample hard sync and through-zero FM; analog
//                  drift / tolerance; output mask. 3 samples latency.
//   'ladder'     - zero-delay-feedback 4-pole transistor ladder with every
//                  mode tap (LP24/18/12/6, HP24/12, BP12). quality 0 = 1x
//                  (the original model), quality 1 = 2x oversampled core with
//                  per-stage tanh (halfband IIR up/down sampling); bass-loss
//                  compensation.
//   'env'        - D/A/H/D/S/R envelope (AD / ADSR / AR modes), sample-accurate
//                  scheduled triggers, audio-rate gate input, time CV,
//                  optional analog RC curves, curvature and looping.
//   'svf'        - Simper/Cytomic trapezoidal state-variable filter:
//                  LP2, LP1, BP, HP1, HP2, BS (notch), PK (peak) - the Elektron
//                  multimode set. Stable under audio-rate modulation.
//   'fdn-reverb' - 8-line feedback-delay-network reverb: predelay, 3-stage
//                  Hadamard diffuser, Householder feedback, modulated lines,
//                  Jot absorption filters (RT60 halves at the damping
//                  frequency at any size), stereo width. Stereo in/out.
//   'chorus'     - BBD-style 1-2 voice stereo chorus with feedback, bucket-
//                  brigade band limiting and soft saturation.
//
// Backward compatibility: 'vco', 'ladder' and 'env' keep exactly their
// original AudioParams, ranges and output layouts; with default settings the
// ladder and envelope reproduce the original output (to float precision).
//
// Settings vs AudioParams: an AudioParam costs ~3.4 ns per sample per node in
// Chrome on every render quantum, even when idle and unconnected. So only
// modulation inputs are AudioParams; settings (VCO mask / drift / tolerance /
// thruZero / fmRatio, ladder quality / comp, envelope delay / hold / loop /
// analog / shape, chorus and reverb tone) come from processorOptions and
// { type: 'set', ... } port messages (the envelope's are timed).
//
// Signal convention used across the app: 1.0 = 5 volts.
// Performance: coefficients are computed once per render quantum whenever the
// relevant a-rate params are constant (array length 1); per-sample paths use
// the fast approximations below instead of Math.pow / tan / tanh / exp / sin;
// states are flushed against denormals and reset on NaN / Infinity.
// ============================================================================

const TWO_PI = Math.PI * 2;
const LN2 = Math.LN2;
const LOG2E = Math.LOG2E;

// ---------------------------------------------------------------------------
// Fast math (accuracy noted; all far below audibility)
// ---------------------------------------------------------------------------

// 2^k for integer k in [-64, 64]
const POW2 = new Float64Array(129);
for (let i = 0; i <= 128; i++) POW2[i] = Math.pow(2, i - 64);
const ROUND_MAGIC = 6755399441055744.0; // 1.5 * 2^52: (x + M) - M rounds to nearest

/** 2^x, |x| <= 60, relative error ~1e-7 (0.0002 cents) */
function exp2(x) {
  if (x > 60) x = 60; else if (x < -60) x = -60;
  const k = (x + ROUND_MAGIC) - ROUND_MAGIC;
  const f = x - k;
  return (1.0000000754953540 + f * (0.69314720671060703 + f * (0.24022107355813041 + f * (0.055503272142182529 +
    f * (0.0096760370985559188 + f * 0.0013400432164069483))))) * POW2[(k + 64) | 0];
}

/** tanh via [7/6] Pade, max error 1e-4 (at the |x| = 4.97 clamp), monotonic, |y| <= 1 */
function tanhF(x) {
  if (x > 4.97) return 1;
  if (x < -4.97) return -1;
  const x2 = x * x;
  return x * (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}

/** tanh(x) / x (1 at x = 0) */
function tanhcF(x) {
  const x2 = x * x;
  if (x2 > 24.7009) return 1 / Math.abs(x);
  return (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}

/** tan(x) for 0 <= x <= 1.42 via [5/4] Pade, relative error < 3e-5 (5e-9 below 0.72) */
function tanF(x) {
  const x2 = x * x;
  return x * (945 + x2 * (-105 + x2)) / (945 + x2 * (-420 + x2 * 15));
}

/** sin(2*pi*p) for any p, error 7e-9 */
function sin2pi(p) {
  let u = p - Math.floor(p + 0.5); // [-0.5, 0.5)
  if (u > 0.25) u = 0.5 - u; else if (u < -0.25) u = -0.5 - u;
  const u2 = u * u;
  return u * (6.2831852802603860 + u2 * (-41.341680667564709 + u2 * (81.602480704356452 + u2 * (-76.581283596342473 + u2 * 39.760714499738548))));
}

/** Small, fast seedable PRNG (mulberry32). Returns a function -> [0, 1) */
function makeRng(seed) {
  let a = (typeof seed === 'number' && Number.isFinite(seed)) ? (seed * 2654435761) >>> 0 : (Math.random() * 4294967296) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
/** Flush tiny values to zero (denormal guard for filter states) */
const flush = x => (x > 1e-20 || x < -1e-20 ? x : 0);

// ---------------------------------------------------------------------------
// 4-point polyBLEP / polyBLAMP (integrated cubic B-spline). `d` = time in
// samples since the discontinuity at the current sample (0..1); k = index of
// the current sample in the work buffer. Corrects samples k-2 .. k+1.
// ---------------------------------------------------------------------------

function addBlep(W, k, d, h) {
  const d2 = d * d, d3 = d2 * d, d4 = d2 * d2;
  const u = d - 1, u2 = u * u, u3 = u2 * u, u4 = u2 * u2;
  W[k - 2] += h * (d4 * 0.041666666666666664);
  W[k - 1] += h * (0.5 + (4 * u - 2 * u3 - 0.75 * u4) * 0.16666666666666666);
  W[k] += h * (-0.5 + (4 * d - 2 * d3 + 0.75 * d4) * 0.16666666666666666);
  W[k + 1] -= h * (u4 * 0.041666666666666664);
}

function addBlamp(W, k, d, s) {
  const d2 = d * d, d4 = d2 * d2, d5 = d4 * d;
  const u = d - 1, u2 = u * u, u4 = u2 * u2, u5 = u4 * u;
  W[k - 2] += s * (d5 * 0.008333333333333333);
  W[k - 1] += s * (0.23333333333333334 + 0.5 * u + (2 * u2 - 0.5 * u4 - 0.15 * u5) * 0.16666666666666666);
  W[k] += s * (0.23333333333333334 - 0.5 * d + (2 * d2 - 0.5 * d4 + 0.15 * d5) * 0.16666666666666666);
  W[k + 1] -= s * (u5 * 0.008333333333333333);
}

// The B-spline kernel rolls off the top octave a little; a centred 3-tap
// presence FIR (+1 sample latency) restores it (-1 dB at 10 kHz, like the
// old 2-point polyBLEP) while keeping ~12 dB of the extra alias rejection.
const FIR_C = 1.24, FIR_S = -0.12;

// ============================================================================
// VCO
// ============================================================================

const EV_WRAP_UP = 1, EV_WRAP_DOWN = 2, EV_PW = 3, EV_HALF = 4, EV_RESET = 5;
const VCO_LAT = 4; // work-buffer offset of the current sample (2 BLEP + 1 FIR + 1 carry)

class VcoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 0, maxValue: 24000, automationRate: 'a-rate' },
      // Exponential pitch CV in octaves (1.0 = one octave up)
      { name: 'pitch', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      // Linear FM in Hz (sum of connected modulators); negative frequency runs the phase backwards
      { name: 'fm', defaultValue: 0, minValue: -48000, maxValue: 48000, automationRate: 'a-rate' },
      { name: 'pw', defaultValue: 0.5, minValue: 0.02, maxValue: 0.98, automationRate: 'a-rate' },
      { name: 'sync', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // Settings that are not modulation inputs are processorOptions / { type: 'set' } messages,
      // not AudioParams: every AudioParam costs ~3.5 ns/sample per node even when idle.
    ];
  }

  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.subs = !!o.subs;
    this.rng = makeRng(o.seed);
    this.phase = typeof o.phase === 'number' ? o.phase - Math.floor(o.phase) : this.rng();
    this.tolDraw = this.rng() * 2 - 1;
    // settings (processorOptions, or later { type: 'set', ... } messages)
    this.mask = 63;          // 1 tri, 2 saw, 4 pulse, 8 sine, 16 sub1, 32 sub2: masked outputs are silent and free
    this.drift = 0;          // analog drift: slow random pitch wander, cents (~1 sigma)
    this.driftRate = 0.25;   // its rough rate, Hz
    this.tolerance = 0;      // fixed detune: tolerance (cents) x a random draw in -1..1 made at construction
    this.thruZero = true;    // negative instantaneous frequency runs the phase backwards; false = stop at 0 Hz
    this.fmRatio = false;    // true: `fm` is a ratio of the frequency (f = f0 * (1 + fm), constant FM index)
    this.apply(o);
    this.port.onmessage = e => { const m = e.data; if (m && m.type === 'set') this.apply(m); };
    this.lastSync = 0;
    this.lastPw = 0.5;
    this.dr1 = 0; this.dr2 = 0;
    this.s1 = 1; this.s2 = 1;          // sub flip-flops (+1 / -1)
    this.chGain = new Float64Array(6); // 0 = off, 1 = on (fades over one quantum on change)
    this.g0s = new Float64Array(6);
    this.g1s = new Float64Array(6);
    this.started = false;
    this.n = 0;
  }

  /** Apply settings from processorOptions or a { type: 'set' } message */
  apply(m) {
    const num = (v, lo, hi) => (typeof v === 'number' && v === v ? clamp(v, lo, hi) : undefined);
    const mask = num(m.mask, 0, 63);
    if (mask !== undefined) this.mask = mask | 0;
    const d = num(m.drift, 0, 100);
    if (d !== undefined) this.drift = d;
    const dr = num(m.driftRate, 0.01, 20);
    if (dr !== undefined) this.driftRate = dr;
    const t = num(m.tolerance, 0, 100);
    if (t !== undefined) this.tolerance = t;
    if (m.thruZero !== undefined) this.thruZero = !!m.thruZero;
    if (m.fmRatio !== undefined) this.fmRatio = !!m.fmRatio;
  }

  alloc(n) {
    this.n = n;
    const cap = 4 * n + 16;
    this.evI = new Int32Array(cap);
    this.evK = new Int32Array(cap);
    this.evD = new Float64Array(cap);
    this.evQ = new Float64Array(cap);
    this.evT = new Float64Array(cap);
    this.evW = new Float64Array(cap);
    this.W = [];
    for (let c = 0; c < 6; c++) this.W.push(new Float64Array(n + VCO_LAT + 1));
  }

  push(i, d, kind, q, dt, pw) {
    const e = this.ne;
    if (e >= this.evI.length) return;
    this.evI[e] = i;
    this.evD[e] = d < 0 ? 0 : d > 1 ? 1 : d;
    this.evK[e] = kind;
    this.evQ[e] = q;
    this.evT[e] = dt;
    this.evW[e] = pw;
    this.ne = e + 1;
  }

  /**
   * Advance the phase over [ta, tb] (fractions of the sample interval ending at
   * sample i) from phase qa with increment dt, pulse width pwa -> pwb. Records
   * wraps, triangle peaks and pulse-width crossings. Returns the end phase.
   */
  seg(i, qa, ta, tb, dt, pwa, pwb, needPw, needHalf) {
    const span = tb - ta;
    const qb = qa + dt * span;
    if (dt >= 0) {
      if (qb < 1) {
        if (needHalf && qa < 0.5 && qb >= 0.5) this.push(i, 1 - (ta + (0.5 - qa) / dt), EV_HALF, 0, dt, 0);
        if (needPw) {
          const g0 = qa - pwa, g1 = qb - pwb;
          if ((g0 < 0) !== (g1 < 0)) this.push(i, 1 - (ta + span * g0 / (g0 - g1)), EV_PW, g0 < 0 ? -2 : 2, dt, 0);
        }
        return qb;
      }
      const tw = ta + (1 - qa) / dt;
      const pwTw = span > 0 ? pwa + (pwb - pwa) * (tw - ta) / span : pwb;
      if (needHalf && qa < 0.5) this.push(i, 1 - (ta + (0.5 - qa) / dt), EV_HALF, 0, dt, 0);
      if (needPw) {
        const g0 = qa - pwa, g1 = 1 - pwTw;
        if (g0 < 0) this.push(i, 1 - (ta + (tw - ta) * g0 / (g0 - g1)), EV_PW, -2, dt, 0);
      }
      this.push(i, 1 - tw, EV_WRAP_UP, 0, dt, 0);
      const qe = qb - 1;
      if (needHalf && qe >= 0.5) this.push(i, 1 - (tw + 0.5 / dt), EV_HALF, 0, dt, 0);
      if (needPw) {
        const g0 = -pwTw, g1 = qe - pwb;
        if (g1 >= 0) this.push(i, 1 - (tw + (tb - tw) * g0 / (g0 - g1)), EV_PW, -2, dt, 0);
      }
      return qe;
    }
    // backwards (through-zero FM)
    const adt = -dt;
    if (qb >= 0) {
      if (needHalf && qa >= 0.5 && qb < 0.5) this.push(i, 1 - (ta + (qa - 0.5) / adt), EV_HALF, 0, dt, 0);
      if (needPw) {
        const g0 = qa - pwa, g1 = qb - pwb;
        if ((g0 < 0) !== (g1 < 0)) this.push(i, 1 - (ta + span * g0 / (g0 - g1)), EV_PW, g0 < 0 ? -2 : 2, dt, 0);
      }
      return qb;
    }
    const tw = ta + qa / adt;
    const pwTw = span > 0 ? pwa + (pwb - pwa) * (tw - ta) / span : pwb;
    if (needHalf && qa >= 0.5) this.push(i, 1 - (ta + (qa - 0.5) / adt), EV_HALF, 0, dt, 0);
    if (needPw) {
      const g0 = qa - pwa, g1 = -pwTw;
      if (g0 >= 0) this.push(i, 1 - (ta + (tw - ta) * g0 / (g0 - g1)), EV_PW, 2, dt, 0);
    }
    this.push(i, 1 - tw, EV_WRAP_DOWN, 0, dt, 0);
    const qe = qb + 1;
    if (needHalf && qe < 0.5) this.push(i, 1 - (tw + 0.5 / adt), EV_HALF, 0, dt, 0);
    if (needPw) {
      const g0 = 1 - pwTw, g1 = qe - pwb;
      if (g1 < 0) this.push(i, 1 - (tw + (tb - tw) * g0 / (g0 - g1)), EV_PW, 2, dt, 0);
    }
    return qe;
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const n = out[0].length;
    if (n !== this.n) this.alloc(n);
    const sr = sampleRate;
    const nCh = Math.min(out.length, this.subs ? 6 : 4);

    // --- output mask (fade one quantum on change, so mask switches never click)
    const mask = this.mask;
    const g0s = this.g0s, g1s = this.g1s;
    if (!this.started) {
      // the initial mask applies immediately (no fade at start-up)
      for (let c = 0; c < 6; c++) this.chGain[c] = (mask >> c) & 1;
      this.started = true;
    }
    let any = false;
    for (let c = 0; c < nCh; c++) {
      const want = (mask >> c) & 1;
      const g0 = this.chGain[c];
      g0s[c] = g0; g1s[c] = want;
      if (want && g0 === 0) this.W[c].fill(0); // re-enabled: drop stale history
      if (want || g0 > 0) any = true; else out[c].fill(0);
      this.chGain[c] = want;
    }
    for (let c = nCh; c < out.length; c++) out[c].fill(0);
    const triOn = nCh > 0 && (g0s[0] > 0 || g1s[0] > 0);
    const sawOn = nCh > 1 && (g0s[1] > 0 || g1s[1] > 0);
    const pulOn = nCh > 2 && (g0s[2] > 0 || g1s[2] > 0);
    const sinOn = nCh > 3 && (g0s[3] > 0 || g1s[3] > 0);
    const subOn = this.subs && nCh > 4;

    // --- drift / tolerance (per quantum)
    let octOff = 0;
    const tol = this.tolerance;
    if (tol > 0) octOff += (tol * this.tolDraw) / 1200;
    const drift = this.drift;
    if (drift > 0) {
      const a = 1 - Math.exp((-TWO_PI * this.driftRate * n) / sr);
      const w = this.rng() * 2 - 1;
      this.dr1 += a * (w - this.dr1);
      this.dr2 += a * (this.dr1 - this.dr2);
      // unit-variance normalisation of the 2-pole smoothed uniform noise
      const r = (1 - a) * (1 - a);
      const sd = a * a * Math.sqrt((1 + r) / ((1 - r) * (1 - r) * (1 - r)) / 3);
      octOff += (drift * clamp(this.dr2 / sd, -3, 3)) / 1200;
    }
    const driftMul = octOff !== 0 ? Math.pow(2, octOff) : 1;

    // FM: Hz added to the frequency (default), or with fmRatio a ratio of it (through-zero FM
    // with a constant index across the keyboard): f = f0 * (rk * fm + 1) + hk * fm
    const rk = this.fmRatio ? 1 : 0, hk = 1 - rk;
    const tz = this.thruZero;

    if (!any) {
      // Nothing audible (every output masked): keep the phase running so a later enable stays coherent
      const fm0 = params.fm[0];
      let f = params.frequency[0] * Math.pow(2, params.pitch[0]) * driftMul * (rk * fm0 + 1) + hk * fm0;
      if (f < 0 && !tz) f = 0;
      this.phase += (clamp(f, -0.45 * sr, 0.45 * sr) / sr) * n;
      this.phase -= Math.floor(this.phase);
      return true;
    }

    // --- frequency
    const fA = params.frequency, pA = params.pitch, fmA = params.fm, pwA = params.pw;
    const fC = fA.length === 1, pC = pA.length === 1, fmC = fmA.length === 1;
    const lim = 0.45 * sr, invSr = 1 / sr;
    const constF = fC && pC && fmC;
    let dtC = 0;
    const pitchMul0 = pC ? Math.pow(2, pA[0]) * driftMul : 0;
    if (constF) {
      const fm0 = fmA[0];
      let f = fA[0] * pitchMul0 * (rk * fm0 + 1) + hk * fm0;
      if (!tz && f < 0) f = 0;
      dtC = (f > lim ? lim : f < -lim ? -lim : f) * invSr;
    }
    const pwC = pwA.length === 1;
    const pw0 = pwA[0];

    // --- phase pass, fused with the naive waveforms: phase per sample + discontinuity events
    const L = VCO_LAT;
    const Wt = this.W[0], Ws = this.W[1], Wp = this.W[2], Wn = this.W[3];
    // BLEP taps written past the end of the last quantum land on this quantum's first sample
    const ct = Wt[L], cs = Ws[L], cp = Wp[L], cn = Wn[L];
    const syncIn = params.sync[0] > 0.5 && inputs[0] && inputs[0][0] ? inputs[0][0] : null;
    let last = this.lastSync;
    let pwPrev = this.lastPw;
    let p = this.phase;
    const needPw = pulOn, needHalf = triOn;
    this.ne = 0;
    for (let i = 0; i < n; i++) {
      let dt = dtC;
      if (!constF) {
        const fmv = fmC ? fmA[0] : fmA[i];
        let f = (fC ? fA[0] : fA[i]) * (pC ? pitchMul0 : exp2(pA[i]) * driftMul) * (rk * fmv + 1) + hk * fmv;
        if (!tz && f < 0) f = 0;
        dt = (f > lim ? lim : f < -lim ? -lim : f) * invSr;
      }
      const pw = pwC ? pw0 : pwA[i];
      let ds = -1;
      if (syncIn !== null) {
        const s = syncIn[i];
        if (last <= 0 && s > 0) ds = s / (s - last); // time since the master's rising zero crossing
        last = s;
      }
      if (ds < 0) {
        const q = p + dt;
        if (q < 1 && q >= 0 && !(needHalf && (p < 0.5) !== (q < 0.5)) && !(needPw && (p - pwPrev < 0) !== (q - pw < 0))) {
          p = q; // fast path: no discontinuity in this sample
        } else {
          p = this.seg(i, p, 0, 1, dt, pwPrev, pw, needPw, needHalf);
        }
      } else {
        // hard sync: run up to the reset instant, reset, continue from phase 0
        const tr = 1 - ds;
        const pwR = pwPrev + (pw - pwPrev) * tr;
        const qs = this.seg(i, p, 0, tr, dt, pwPrev, pwR, needPw, needHalf);
        this.push(i, ds, EV_RESET, qs >= 1 ? qs - 1 : qs < 0 ? qs + 1 : qs, dt, pwR);
        p = this.seg(i, dt >= 0 ? 0 : 1, tr, 1, dt, pwR, pw, needPw, needHalf);
      }
      const k = i + L;
      if (triOn) { const x = p - 0.5; Wt[k] = 1 - 4 * (x < 0 ? -x : x); }
      if (sawOn) Ws[k] = 2 * p - 1;
      if (pulOn) Wp[k] = p < pw ? 1 : -1;
      if (sinOn) Wn[k] = sin2pi(p);
      pwPrev = pw;
    }
    if (!(p === p) || !(last === last)) {
      // NaN / Infinity on a modulation input: recover instead of staying silent forever
      p = 0; last = 0;
      for (let c = 0; c < 6; c++) this.W[c].fill(0);
      this.ne = 0;
    }
    this.phase = p;
    this.lastSync = last;
    this.lastPw = pwPrev === pwPrev ? pwPrev : 0.5;
    if (triOn) { Wt[L] += ct; Wt[n + L] = 0; }
    if (sawOn) { Ws[L] += cs; Ws[n + L] = 0; }
    if (pulOn) { Wp[L] += cp; Wp[n + L] = 0; }
    if (sinOn) { Wn[L] += cn; Wn[n + L] = 0; }

    // --- band-limit every discontinuity: polyBLEP for steps, polyBLAMP for slope changes
    const ne = this.ne;
    const evI = this.evI, evK = this.evK, evD = this.evD, evQ = this.evQ, evT = this.evT, evW = this.evW;
    for (let e = 0; e < ne; e++) {
      const k = evI[e] + L, d = evD[e], dt = evT[e], adt = dt < 0 ? -dt : dt;
      switch (evK[e]) {
        case EV_WRAP_UP:
          if (triOn) addBlamp(Wt, k, d, 8 * adt);
          if (sawOn) addBlep(Ws, k, d, -2);
          if (pulOn) addBlep(Wp, k, d, 2);
          break;
        case EV_WRAP_DOWN:
          if (triOn) addBlamp(Wt, k, d, 8 * adt);
          if (sawOn) addBlep(Ws, k, d, 2);
          if (pulOn) addBlep(Wp, k, d, -2);
          break;
        case EV_HALF:
          addBlamp(Wt, k, d, -8 * adt);
          break;
        case EV_PW:
          addBlep(Wp, k, d, evQ[e]);
          break;
        case EV_RESET: {
          const qs = evQ[e];
          if (triOn) {
            const x = qs - 0.5;
            addBlep(Wt, k, d, -1 - (1 - 4 * (x < 0 ? -x : x)));
            addBlamp(Wt, k, d, 4 * adt - (qs < 0.5 ? 4 : -4) * dt);
          }
          if (sawOn) addBlep(Ws, k, d, (dt >= 0 ? -1 : 1) - (2 * qs - 1));
          if (pulOn) addBlep(Wp, k, d, (dt >= 0 ? 1 : -1) - (qs < evW[e] ? 1 : -1));
          if (sinOn) {
            addBlep(Wn, k, d, -sin2pi(qs));
            addBlamp(Wn, k, d, TWO_PI * dt * (1 - sin2pi(qs + 0.25)));
          }
          break;
        }
      }
    }

    // --- outputs: delay-compensated, presence FIR on the edged waves, one pass for all channels
    const oT = out[0], oS = out[1], oP = out[2], oN = sinOn ? out[3] : null;
    for (let j = 0; j < n; j++) {
      if (triOn) oT[j] = FIR_C * Wt[j + 1] + FIR_S * (Wt[j] + Wt[j + 2]);
      if (sawOn) oS[j] = FIR_C * Ws[j + 1] + FIR_S * (Ws[j] + Ws[j + 2]);
      if (pulOn) oP[j] = FIR_C * Wp[j + 1] + FIR_S * (Wp[j] + Wp[j + 2]);
      if (oN) oN[j] = Wn[j + 1];
    }
    for (let c = 0; c < 4 && c < nCh; c++) {
      if (!(g0s[c] > 0 || g1s[c] > 0)) continue;
      if (g0s[c] !== g1s[c]) ramp(out[c], n, g0s[c], g1s[c]);
      carry(this.W[c], n);
    }
    if (subOn) {
      // Sub-octave flip-flops clocked by every cycle start of the core (wraps and sync resets):
      // sub 1 toggles on each cycle (f/2), sub 2 on every second one (f/4).
      const on1 = g0s[4] > 0 || g1s[4] > 0;
      const on2 = nCh > 5 && (g0s[5] > 0 || g1s[5] > 0);
      const W1 = this.W[4], W2 = this.W[5];
      const s1In = this.s1, s2In = this.s2;
      let s1 = s1In, s2 = s2In, e = 0;
      if (on1 || on2) {
        const c41 = W1[L], c42 = W2[L];
        // naive square values: state after every cycle event up to and including sample i
        for (let i = 0; i < n; i++) {
          while (e < ne && evI[e] === i) {
            const kd = evK[e];
            if (kd === EV_WRAP_UP || kd === EV_WRAP_DOWN || kd === EV_RESET) { s1 = -s1; if (s1 > 0) s2 = -s2; }
            e++;
          }
          W1[i + L] = s1; W2[i + L] = s2;
        }
        W1[L] += c41; W2[L] += c42; W1[n + L] = 0; W2[n + L] = 0;
        // band-limit every toggle (same sub-sample position as the core's event)
        s1 = s1In; s2 = s2In;
        for (e = 0; e < ne; e++) {
          const kd = evK[e];
          if (kd !== EV_WRAP_UP && kd !== EV_WRAP_DOWN && kd !== EV_RESET) continue;
          const k = evI[e] + L, d = evD[e];
          addBlep(W1, k, d, -2 * s1);
          s1 = -s1;
          if (s1 > 0) { addBlep(W2, k, d, -2 * s2); s2 = -s2; }
        }
        if (on1) this.emit(W1, out[4], n, g0s[4], g1s[4]);
        if (on2) this.emit(W2, out[5], n, g0s[5], g1s[5]);
      } else {
        for (e = 0; e < ne; e++) {
          const kd = evK[e];
          if (kd === EV_WRAP_UP || kd === EV_WRAP_DOWN || kd === EV_RESET) { s1 = -s1; if (s1 > 0) s2 = -s2; }
        }
      }
      this.s1 = s1; this.s2 = s2;
    }
    return true;
  }

  /** Delay-compensated output with the presence FIR, gain ramp on mask changes, carry history (subs) */
  emit(W, o, n, g0, g1) {
    for (let j = 0; j < n; j++) o[j] = FIR_C * W[j + 1] + FIR_S * (W[j] + W[j + 2]);
    if (g0 !== g1) ramp(o, n, g0, g1);
    carry(W, n);
  }
}

/** Linear gain ramp g0 -> g1 over one quantum (mask changes fade instead of clicking) */
function ramp(o, n, g0, g1) {
  const step = (g1 - g0) / n;
  for (let j = 0; j < n; j++) o[j] *= g0 + step * (j + 1);
}

/** Keep the work buffer's tail (latency history + BLEP carry) for the next quantum */
function carry(W, n) {
  W[0] = W[n]; W[1] = W[n + 1]; W[2] = W[n + 2]; W[3] = W[n + 3]; W[4] = W[n + 4];
}

// ============================================================================
// LADDER
// ============================================================================

// Halfband polyphase IIR (2x up/down): 6 first-order allpass coefficients,
// ~95 dB stopband, flat to 20 kHz at 48 kHz. Path 0 gets even coefficients.
const HB0 = [0.045362164348961, 0.337149687979074, 0.708064136363538];
const HB1 = [0.168087481234502, 0.522377854308354, 0.897445591172774];
// 2x core: stage tanh at 2.5 x the input-pair scale (per-stage compression under
// drive, self-oscillation within ~2 cents at res 1.1 / ~4 cents at 1.2)
const LADDER_IVS = 0.4;

// Mode mix: y = m0*u + m1*y1 + m2*y2 + m3*y3 + m4*y4
// 0 LP24, 1 LP12, 2 LP6, 3 HP24, 4 BP12, 5 HP12, 6 LP18
const LADDER_MIX = [
  [0, 0, 0, 0, 1],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
  [1, -4, 6, -4, 1],
  [0, 0, 2, 0, -2],
  [1, -2, 1, 0, 0],
  [0, 0, 0, 1, 0],
];

class LadderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 1000, minValue: 5, maxValue: 24000, automationRate: 'a-rate' },
      // Exponential cutoff CV in octaves
      { name: 'cutoffCv', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      // 0..1, ~1 = self oscillation
      { name: 'resonance', defaultValue: 0, minValue: 0, maxValue: 1.2, automationRate: 'a-rate' },
      { name: 'drive', defaultValue: 1, minValue: 0.1, maxValue: 10, automationRate: 'k-rate' },
      // 0 LP24, 1 LP12, 2 LP6, 3 HP24, 4 BP12, 5 HP12, 6 LP18
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 6, automationRate: 'k-rate' },
      // quality / comp are settings (processorOptions or { type: 'set' } messages), not AudioParams
    ];
  }

  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.quality = 0; // 0 = 1x (the original model), 1 = 2x oversampled per-stage-tanh transistor core
    this.comp = 0;    // passband (bass) loss compensation at high resonance, low-pass modes: 0 = classic, 1 = full
    this.apply(o);
    this.port.onmessage = e => { const m = e.data; if (m && m.type === 'set') this.apply(m); };
    this.s = [0, 0, 0, 0];
    this.hb = new Float64Array(24); // halfband states: up0 x/y (3+3), up1 (3+3), dn0 (3+3), dn1 (3+3)
    this.lastQ = -1;
  }

  /** Apply settings from processorOptions or a { type: 'set' } message */
  apply(m) {
    if (m.quality !== undefined) this.quality = m.quality >= 0.5 ? 1 : 0;
    if (typeof m.comp === 'number' && m.comp === m.comp) this.comp = clamp(m.comp, 0, 1);
  }

  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0][0];
    const n = output.length;
    const sr = sampleRate;
    const cArr = params.cutoff, cvArr = params.cutoffCv, rArr = params.resonance;
    const drive = params.drive[0];
    let mode = Math.round(params.mode[0]);
    if (mode < 0 || mode > 6) mode = 0;
    const m = LADDER_MIX[mode];
    const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3], m4 = m[4];
    const quality = this.quality;
    const comp = this.comp;
    const lpMode = mode === 0 || mode === 1 || mode === 2 || mode === 6;
    const doComp = comp > 0 && lpMode;
    if (quality !== this.lastQ) { this.hb.fill(0); this.lastQ = quality; }

    const s = this.s;
    let s0 = s[0], s1 = s[1], s2 = s[2], s3 = s[3];
    const constC = cArr.length === 1 && cvArr.length === 1;
    const constR = rArr.length === 1;
    const nyq = sr * 0.45;
    const os = quality ? 2 : 1;
    const wScale = Math.PI / (sr * os);

    // per-quantum coefficients when constant
    let g = 0, G = 0, ig = 0, G2 = 0, G3 = 0, G4 = 0;
    if (constC) {
      let fc = cArr[0] * Math.pow(2, cvArr[0]);
      if (fc < 5) fc = 5;
      if (fc > nyq) fc = nyq;
      g = Math.tan(fc * wScale);
      ig = 1 / (1 + g); G = g * ig; G2 = G * G; G3 = G2 * G; G4 = G3 * G;
    }
    let res = rArr[0], k = res * 4.1, inG = drive * (1 + res * 0.6), mk = 1, iK = 0;
    if (constR && doComp) mk = 1 + comp * ((1 + k) / (1 + res * 0.6) - 1);
    if (constC && constR) iK = 1 / (1 + k * G4);

    if (!quality) {
      // ---- 1x: the original model (linear ZDF estimate, tanh at the input) ----
      for (let i = 0; i < n; i++) {
        if (!constC) {
          let fc = cArr.length > 1 ? cArr[i] : cArr[0];
          fc *= exp2(cvArr.length > 1 ? cvArr[i] : cvArr[0]);
          if (fc < 5) fc = 5;
          if (fc > nyq) fc = nyq;
          g = tanF(fc * wScale);
          ig = 1 / (1 + g); G = g * ig; G2 = G * G; G3 = G2 * G; G4 = G3 * G;
        }
        if (!constR) {
          res = rArr[i]; k = res * 4.1; inG = drive * (1 + res * 0.6);
          if (doComp) mk = 1 + comp * ((1 + k) / (1 + res * 0.6) - 1);
        }
        if (!constC || !constR) iK = 1 / (1 + k * G4);
        const xin = input ? input[i] * inG : 0;
        const sigma = G3 * s0 * ig + G2 * s1 * ig + G * s2 * ig + s3 * ig;
        const y4est = (G4 * xin + sigma) * iK;
        const u = tanhF(xin - k * y4est);
        let v = (u - s0) * G; const y1 = v + s0; s0 = y1 + v;
        v = (y1 - s1) * G; const y2 = v + s1; s1 = y2 + v;
        v = (y2 - s2) * G; const y3 = v + s2; s2 = y3 + v;
        v = (y3 - s3) * G; const y4 = v + s3; s3 = y4 + v;
        const y = m0 * u + m1 * y1 + m2 * y2 + m3 * y3 + m4 * y4;
        output[i] = doComp ? y * mk : y;
      }
    } else {
      // ---- 2x: transistor ladder, per-stage tanh (Huovilainen), solved with
      // zero-delay feedback by linearising each tanh around the stage state ----
      const hb = this.hb;
      let ux00 = hb[0], ux01 = hb[1], ux02 = hb[2], uy00 = hb[3], uy01 = hb[4], uy02 = hb[5];
      let ux10 = hb[6], ux11 = hb[7], ux12 = hb[8], uy10 = hb[9], uy11 = hb[10], uy12 = hb[11];
      let dx00 = hb[12], dx01 = hb[13], dx02 = hb[14], dy00 = hb[15], dy01 = hb[16], dy02 = hb[17];
      let dx10 = hb[18], dx11 = hb[19], dx12 = hb[20], dy10 = hb[21], dy11 = hb[22], dy12 = hb[23];
      const a0 = HB0[0], a1 = HB0[1], a2 = HB0[2], b0 = HB1[0], b1 = HB1[1], b2 = HB1[2];
      for (let i = 0; i < n; i++) {
        if (!constC) {
          let fc = cArr.length > 1 ? cArr[i] : cArr[0];
          fc *= exp2(cvArr.length > 1 ? cvArr[i] : cvArr[0]);
          if (fc < 5) fc = 5;
          if (fc > nyq) fc = nyq;
          g = tanF(fc * wScale);
        }
        if (!constR) {
          res = rArr[i]; k = res * 4.1; inG = drive * (1 + res * 0.6);
          if (doComp) mk = 1 + comp * ((1 + k) / (1 + res * 0.6) - 1);
        }
        const x = input ? input[i] * inG : 0;
        // upsample: two allpass chains on the same input
        let t = a0 * (x - uy00) + ux00; ux00 = x; uy00 = t;
        let t2 = a1 * (t - uy01) + ux01; ux01 = t; uy01 = t2;
        const xa = a2 * (t2 - uy02) + ux02; ux02 = t2; uy02 = xa;
        t = b0 * (x - uy10) + ux10; ux10 = x; uy10 = t;
        t2 = b1 * (t - uy11) + ux11; ux11 = t; uy11 = t2;
        const xb = b2 * (t2 - uy12) + ux12; ux12 = t2; uy12 = xb;

        let za = 0, zb = 0;
        for (let sub = 0; sub < 2; sub++) {
          const xs = sub === 0 ? xa : xb;
          // Stage nonlinearity: y' = g (tanh(y[n-1]) - tanh(y[n])), each tanh linearised
          // around its stage state (T = tanh(v)/v). The pole drop under compression is
          // compensated (keeps self-oscillation in tune); the input pair is solved like
          // the 1x model: zero-delay linear estimate, then the exact tanh.
          const T1 = tanhcF(s0 * LADDER_IVS), T2 = tanhcF(s1 * LADDER_IVS), T3 = tanhcF(s2 * LADDER_IVS), T4 = tanhcF(s3 * LADDER_IVS);
          const ge = (4 * g) / (T1 + T2 + T3 + T4);
          const c1 = 1 / (1 + ge * T1), c2 = 1 / (1 + ge * T2), c3 = 1 / (1 + ge * T3), c4 = 1 / (1 + ge * T4);
          const A1 = ge * c1, B1 = s0 * c1;
          const A2 = ge * T1 * c2, B2 = s1 * c2;
          const A3 = ge * T2 * c3, B3 = s2 * c3;
          const A4 = ge * T3 * c4, B4 = s3 * c4;
          const P = A1 * A2 * A3 * A4;
          const Q = A4 * (A3 * (A2 * B1 + B2) + B3) + B4;
          const y4e = (P * xs + Q) / (1 + k * P);
          const u = tanhF(xs - k * y4e);
          const y1 = A1 * u + B1, y2 = A2 * y1 + B2, y3 = A3 * y2 + B3, y4 = A4 * y3 + B4;
          s0 = 2 * y1 - s0; s1 = 2 * y2 - s1; s2 = 2 * y3 - s2; s3 = 2 * y4 - s3;
          const y = m0 * u + m1 * y1 + m2 * y2 + m3 * y3 + m4 * y4;
          if (sub === 0) za = y; else zb = y;
        }
        // downsample: path 0 gets the later sample, path 1 the earlier one
        t = a0 * (zb - dy00) + dx00; dx00 = zb; dy00 = t;
        t2 = a1 * (t - dy01) + dx01; dx01 = t; dy01 = t2;
        const ya = a2 * (t2 - dy02) + dx02; dx02 = t2; dy02 = ya;
        t = b0 * (za - dy10) + dx10; dx10 = za; dy10 = t;
        t2 = b1 * (t - dy11) + dx11; dx11 = t; dy11 = t2;
        const yb = b2 * (t2 - dy12) + dx12; dx12 = t2; dy12 = yb;
        const y = 0.5 * (ya + yb);
        output[i] = doComp ? y * mk : y;
      }
      hb[0] = ux00; hb[1] = ux01; hb[2] = ux02; hb[3] = uy00; hb[4] = uy01; hb[5] = uy02;
      hb[6] = ux10; hb[7] = ux11; hb[8] = ux12; hb[9] = uy10; hb[10] = uy11; hb[11] = uy12;
      hb[12] = dx00; hb[13] = dx01; hb[14] = dx02; hb[15] = dy00; hb[16] = dy01; hb[17] = dy02;
      hb[18] = dx10; hb[19] = dx11; hb[20] = dx12; hb[21] = dy10; hb[22] = dy11; hb[23] = dy12;
      for (let j = 0; j < 24; j++) {
        const v = hb[j];
        if (!(v > 1e-20 || v < -1e-20)) hb[j] = 0;
      }
    }
    s[0] = s0; s[1] = s1; s[2] = s2; s[3] = s3;
    // Denormal / blow-up guard
    for (let j = 0; j < 4; j++) {
      if (!Number.isFinite(s[j]) || Math.abs(s[j]) < 1e-20) s[j] = 0;
    }
    return true;
  }
}

// ============================================================================
// ENV
// ============================================================================

// mode: 0 = AD (one shot), 1 = ADSR (gated), 2 = AR (gated, sustain at peak)
const ST_IDLE = 0, ST_ATTACK = 1, ST_DECAY = 2, ST_SUSTAIN = 3, ST_RELEASE = 4, ST_DELAY = 5, ST_HOLD = 6;
const LN3 = Math.log(3); // RC attack heading for 1.5 x peak

class EnvProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'attack', defaultValue: 0.001, minValue: 0.0001, maxValue: 60, automationRate: 'k-rate' },
      { name: 'decay', defaultValue: 0.3, minValue: 0.0005, maxValue: 60, automationRate: 'k-rate' },
      { name: 'sustain', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.3, minValue: 0.0005, maxValue: 60, automationRate: 'k-rate' },
      // CV in "volts/5": time *= 2^(-cv*5) so positive CV = shorter (like DFAM)
      { name: 'timeCv', defaultValue: 0, minValue: -4, maxValue: 4, automationRate: 'a-rate' },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      // 0 = exponential decay, 1 = linear
      { name: 'curve', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // delay / hold / loop / analog / shape are settings (processorOptions or timed
      // { type: 'set' } messages), not AudioParams - each AudioParam costs CPU on every quantum
    ];
  }

  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.value = 0;
    this.stage = ST_IDLE;
    this.peak = 1;
    this.count = 0;
    this.queue = [];
    this.setQ = [];
    this.gateHigh = false;
    this.lastIn = 0;
    this.dstep = -1;
    this.curDelay = 0;
    // settings (defaults = the original AD / ADSR / AR envelope)
    this.delayT = 0;     // delay before the attack, seconds  } DAHDSR
    this.holdT = 0;      // hold at the peak, seconds          }
    this.loop = false;   // AD cycles until reset; ADSR / AR repeat A-H-D-R while the gate is held
    this.analog = false; // RC curves: attack charges toward 1.5 x peak, exponential decay / release
    this.shape = 0;      // curvature -1..1: + = more convex (fast start), - = concave (slow start)
    this.apply(o);
    this.port.onmessage = (e) => {
      const m = e.data;
      if (!m) return;
      if (m.type === 'reset' || m.type === 'clear') { this.queue = []; this.value = 0; this.stage = ST_IDLE; this.gateHigh = false; return; }
      const timed = typeof m.time === 'number' && m.time === m.time;
      if (m.type === 'set') {
        // settings apply from the render quantum that contains `time` (or right away)
        if (!timed) { this.apply(m); return; }
        this.setQ.push(m);
        this.setQ.sort((a, b) => a.time - b.time);
        return;
      }
      if (!timed) m.time = 0; // no time = as soon as possible
      this.queue.push(m);
      this.queue.sort((a, b) => a.time - b.time);
    };
  }

  /** Apply settings from processorOptions or a { type: 'set' } message */
  apply(m) {
    const num = (v, lo, hi) => (typeof v === 'number' && v === v ? clamp(v, lo, hi) : undefined);
    const d = num(m.delay, 0, 30);
    if (d !== undefined) this.delayT = d;
    const h = num(m.hold, 0, 30);
    if (h !== undefined) this.holdT = h;
    if (m.loop !== undefined) this.loop = !!m.loop;
    if (m.analog !== undefined) this.analog = !!m.analog;
    const s = num(m.shape, -1, 1);
    if (s !== undefined) this.shape = s;
  }

  fire(velocity) {
    this.peak = velocity === undefined ? 1 : velocity;
    this.stage = this.curDelay > 0 ? ST_DELAY : ST_ATTACK;
    this.count = 0;
    this.dstep = -1;
  }

  /** Gate off: release from the current level (AD mode ignores it) */
  off(mode) {
    this.gateHigh = false;
    if (mode !== 0 && this.stage !== ST_IDLE) this.stage = ST_RELEASE;
  }

  process(inputs, outputs, params) {
    const out = outputs[0][0];
    const n = out.length;
    const gateIn = inputs[0] && inputs[0][0];
    const attack = params.attack[0], decay = params.decay[0], sustain = params.sustain[0], release = params.release[0];
    const mode = Math.round(params.mode[0]);
    const linear = params.curve[0] > 0.5;
    const cvArr = params.timeCv;
    const cvConst = cvArr.length === 1;
    const sr = sampleRate;
    const t0 = currentTime;
    const setQ = this.setQ;
    if (setQ.length) {
      const tEnd = t0 + n / sr;
      while (setQ.length && setQ[0].time < tEnd) this.apply(setQ.shift());
    }
    const delayT = this.delayT, holdT = this.holdT;
    const loop = this.loop;
    const analog = this.analog;
    const shape = this.shape;
    this.curDelay = delayT;
    let nextT = this.queue.length ? this.queue[0].time : Infinity;

    // Steady stages (idle, sustain) with no event, gate edge or loop in this quantum: constant output
    if (!gateIn && nextT > t0 + (n - 1) / sr) {
      const st = this.stage;
      if (st === ST_IDLE || (st === ST_SUSTAIN && mode !== 0 && !(loop && this.gateHigh))) {
        if (st === ST_SUSTAIN && mode === 1) this.value = sustain * this.peak;
        out.fill(this.value);
        return true;
      }
    }

    // Curve constants. Legacy curves (analog 0, shape 0) are exactly the original envelope.
    const legacyA = !analog && shape === 0;
    const legacyDR = shape === 0;
    const kA = (analog ? LN3 : 0) + 6 * shape;
    const expDecay = analog || !linear;
    const kD = (expDecay ? 6.9 : 0) + 6 * shape;
    const kR = 6.9 + 6 * shape;
    const linA = legacyA || (kA < 1e-6 && kA > -1e-6);
    const linD = !legacyDR && kD < 1e-6 && kD > -1e-6;
    const linR = !legacyDR && kR < 1e-6 && kR > -1e-6;
    const eA = linA ? 0 : 1 / (1 - exp2(-kA * LOG2E));          // attack target = peak * eA
    const eD = legacyDR || linD ? 0 : 1 / (1 - exp2(-kD * LOG2E));
    const eR = legacyDR || linR ? 0 : 1 / (1 - exp2(-kR * LOG2E));

    // Per-quantum stage lengths and coefficients (recomputed per sample only while timeCv is modulated)
    let tScale = cvConst ? Math.pow(2, -cvArr[0] * 5) : 1;
    let aN = 0, dN = 0, rN = 0, cA = 0, cD = 0, cR = 0, delN = 0, holdN = 0;
    if (cvConst) {
      aN = Math.max(1, attack * tScale * sr);
      dN = Math.max(1, decay * tScale * sr);
      rN = Math.max(1, release * tScale * sr);
      cA = linA ? 0 : exp2((-kA / aN) * LOG2E);
      cD = legacyDR ? Math.exp(-6.9 / dN) : linD ? 0 : exp2((-kD / dN) * LOG2E);
      cR = legacyDR ? Math.exp(-6.9 / rN) : linR ? 0 : exp2((-kR / rN) * LOG2E);
      delN = delayT * tScale * sr;
      holdN = holdT * tScale * sr;
    }
    let value = this.value;

    for (let i = 0; i < n; i++) {
      const now = t0 + i / sr;
      if (now >= nextT) {
        while (this.queue.length && this.queue[0].time <= now) {
          const msg = this.queue.shift();
          if (msg.type === 'trig') this.fire(msg.velocity);
          else if (msg.type === 'gate') {
            if (msg.on) { this.gateHigh = true; this.fire(msg.velocity); }
            else this.off(mode);
          }
        }
        nextT = this.queue.length ? this.queue[0].time : Infinity;
      }

      if (gateIn) {
        const g = gateIn[i];
        if (this.lastIn < 0.2 && g >= 0.2) { this.gateHigh = true; this.fire(1); }
        else if (this.lastIn >= 0.2 && g < 0.2) this.off(mode);
        this.lastIn = g;
      }

      if (!cvConst) tScale = exp2(-cvArr[i] * 5);

      switch (this.stage) {
        case ST_DELAY:
          if (++this.count >= (cvConst ? delN : delayT * tScale * sr)) { this.stage = ST_ATTACK; this.count = 0; }
          else break;
        // falls through into the attack on the sample the delay ends
        case ST_ATTACK: {
          // Retrigger continues from the current level. Above a (lower-velocity) peak the
          // attack ramps down to it at the attack rate instead of jumping (no click).
          const peak = this.peak;
          const N = cvConst ? aN : Math.max(1, attack * tScale * sr);
          let reached;
          if (value > peak) {
            if (this.dstep < 0) this.dstep = (value - peak) / N;
            value -= this.dstep;
            reached = value <= peak;
          } else {
            if (linA) value += peak / N;
            else {
              // RC / curved attack toward an overshoot target, clipped at the peak
              const T = peak * eA;
              value = T + (value - T) * (cvConst ? cA : exp2((-kA / N) * LOG2E));
            }
            reached = value >= peak;
          }
          if (reached) {
            value = peak;
            if (holdT > 0) { this.stage = ST_HOLD; this.count = 0; }
            else this.stage = mode === 2 ? (loop && this.gateHigh ? ST_RELEASE : ST_SUSTAIN) : ST_DECAY;
          }
          break;
        }
        case ST_HOLD:
          if (++this.count >= (cvConst ? holdN : holdT * tScale * sr)) this.stage = mode === 2 ? (loop && this.gateHigh ? ST_RELEASE : ST_SUSTAIN) : ST_DECAY;
          break;
        case ST_DECAY: {
          const peak = this.peak;
          const target = mode === 1 ? sustain * peak : 0;
          const tSamples = cvConst ? dN : Math.max(1, decay * tScale * sr);
          let done = false;
          if (legacyDR) {
            if (!expDecay) {
              value -= peak / tSamples;
              if (value <= target) { value = target; done = true; }
            } else {
              // ~ -60dB over the decay time
              value = target + (value - target) * (cvConst ? cD : exp2((-6.9 / tSamples) * LOG2E));
              if (Math.abs(value - target) < 1e-4) { value = target; done = true; }
            }
          } else if (linD) {
            value -= peak / tSamples;
            if (value <= target) { value = target; done = true; }
          } else {
            const T = peak + (target - peak) * eD;
            value = T + (value - T) * (cvConst ? cD : exp2((-kD / tSamples) * LOG2E));
            if (value <= target) { value = target; done = true; }
          }
          if (done) {
            if (mode === 1) this.stage = loop && this.gateHigh ? ST_RELEASE : ST_SUSTAIN;
            else if (mode === 0 && loop) this.fire(peak);
            else this.stage = mode === 1 ? ST_SUSTAIN : ST_IDLE;
          }
          break;
        }
        case ST_SUSTAIN:
          if (mode === 1) value = sustain * this.peak;
          if (mode === 0) this.stage = ST_IDLE;
          else if (loop && this.gateHigh) this.stage = ST_RELEASE;
          break;
        case ST_RELEASE: {
          const tSamples = cvConst ? rN : Math.max(1, release * tScale * sr);
          let done = false;
          if (legacyDR) {
            value *= cvConst ? cR : exp2((-6.9 / tSamples) * LOG2E);
            if (value < 1e-4) done = true;
          } else {
            const peak = this.peak > 1e-6 ? this.peak : 1e-6;
            if (linR) value -= peak / tSamples;
            else {
              const T = peak - peak * eR;
              value = T + (value - T) * (cvConst ? cR : exp2((-kR / tSamples) * LOG2E));
            }
            if (value <= 1e-4) done = true;
          }
          if (done) {
            value = 0;
            if (loop && this.gateHigh && mode !== 0) this.fire(this.peak);
            else this.stage = ST_IDLE;
          }
          break;
        }
        default:
          break;
      }
      out[i] = value;
    }
    if (!(value === value) || value === Infinity || value === -Infinity) { value = 0; this.stage = ST_IDLE; } // NaN guard
    this.value = value;
    return true;
  }
}

// ============================================================================
// SVF (Simper / Cytomic trapezoidal state-variable filter)
// ============================================================================

// 0 LP2, 1 LP1, 2 BP, 3 HP1, 4 HP2, 5 BS (notch), 6 PK (peak)
class SvfProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 1000, minValue: 5, maxValue: 24000, automationRate: 'a-rate' },
      // Exponential cutoff CV in octaves
      { name: 'cutoffCv', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      // 0..1 (Q 0.5 .. 25). LP1/HP1 are true 1-pole slopes at 0 and gain a resonant peak above it
      { name: 'resonance', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      // Input saturation: 0 = clean (default), 1 = warm, 10 = heavy
      { name: 'drive', defaultValue: 0, minValue: 0, maxValue: 10, automationRate: 'k-rate' },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 6, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.ic1 = 0; this.ic2 = 0;
  }

  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0][0];
    const n = out.length;
    const sr = sampleRate;
    const cA = params.cutoff, cvA = params.cutoffCv, rA = params.resonance;
    let mode = Math.round(params.mode[0]);
    if (mode < 0 || mode > 6) mode = 0;
    const drive = params.drive[0];
    const dG = 1 + drive, dMix = drive < 1 ? drive : 1, dNorm = 1 / Math.sqrt(dG);
    const constC = cA.length === 1 && cvA.length === 1;
    const constR = rA.length === 1;
    const nyq = sr * 0.48;
    const wS = Math.PI / sr;
    let ic1 = this.ic1, ic2 = this.ic2;

    // Mode mix y = m0*x + m1*band + m2*low, with high = x - k*band - low:
    //   LP2 low | LP1 low+band | BP band*(0.5+0.5k) | HP1 high+band | HP2 high | BS x-k*band | PK x+4*res*k*band (k fixed 0.7)
    const pk = mode === 6;
    const m0 = mode >= 3 ? 1 : 0;
    const m2 = mode === 0 || mode === 1 ? 1 : mode === 3 || mode === 4 ? -1 : 0;
    let g = 0, res = rA[0], kk = 0, a1 = 0, a2 = 0, a3 = 0, m1 = 0;
    if (constC) {
      let fc = cA[0] * Math.pow(2, cvA[0]);
      if (fc < 5) fc = 5; else if (fc > nyq) fc = nyq;
      g = Math.tan(fc * wS);
    }
    for (let i = 0; i < n; i++) {
      if (!constC) {
        let fc = (cA.length > 1 ? cA[i] : cA[0]) * exp2(cvA.length > 1 ? cvA[i] : cvA[0]);
        if (fc < 5) fc = 5; else if (fc > nyq) fc = nyq;
        const w = fc * wS;
        g = w < 1.42 ? tanF(w) : Math.tan(w);
      }
      if (i === 0 || !constC || !constR) {
        if (!constR) res = rA[i];
        kk = pk ? 0.7 : 2 - 1.96 * res;
        a1 = 1 / (1 + g * (g + kk)); a2 = g * a1; a3 = g * a2;
        m1 = mode === 1 ? 1 : mode === 2 ? 0.5 + 0.5 * kk : mode === 3 ? 1 - kk : pk ? res * 4 * kk : mode >= 4 ? -kk : 0;
      }
      let x = input ? input[i] : 0;
      if (drive > 0) x += dMix * (tanhF(x * dG) * dNorm - x);
      const v3 = x - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      out[i] = m0 * x + m1 * v1 + m2 * v2;
    }
    if (!Number.isFinite(ic1) || !Number.isFinite(ic2)) { ic1 = 0; ic2 = 0; }
    if (Math.abs(ic1) < 1e-20) ic1 = 0;
    if (Math.abs(ic2) < 1e-20) ic2 = 0;
    this.ic1 = ic1; this.ic2 = ic2;
    return true;
  }
}

// ============================================================================
// FDN REVERB
// ============================================================================

// Feedback line lengths at size = 1 (ms), roughly exponentially spaced, mutually prime in samples
const FDN_MS = [31.7, 37.1, 41.9, 48.3, 55.7, 63.1, 71.9, 83.3];
// Diffuser: 3 stages x 8 channel delays (ms at size = 1)
const DIF_MS = [
  [0.0, 1.31, 2.07, 0.53, 2.89, 1.73, 3.41, 0.97],
  [3.1, 0.7, 5.3, 2.2, 6.1, 4.4, 1.5, 7.2],
  [9.7, 2.9, 6.3, 12.1, 4.7, 0.8, 10.9, 7.9],
];
// Diffuser polarity flips (baked into the unrolled stages below):
//   stage 1: + - + + - + - -   stage 2: - + + - + - - +   stage 3: + + - + - - + -
// Each stage is delay -> polarity -> orthonormal 8-point Hadamard.
const FDN_MOD_RATE = [1, 1.31, 1.73, 2.19]; // for lines 0, 2, 4, 6
// Wet level calibrated so Reverb2 matches the old convolver Reverb within ~1 dB for
// decays of 1-5 s (0.5 s noise burst in, RMS of the stereo output, Chrome)
const FDN_OUT_GAIN = 0.25;

function pow2Ceil(x) { let p = 1; while (p < x) p <<= 1; return p; }

class FdnReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'predelay', defaultValue: 0.02, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // RT60 at low and mid frequencies (seconds)
      { name: 'decay', defaultValue: 2.5, minValue: 0.1, maxValue: 30, automationRate: 'k-rate' },
      // Room size 0..1 (delay-line lengths x 0.25 .. 1)
      { name: 'size', defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // High-frequency damping (Hz): the RT60 is half of `decay` at this frequency and falls further above it
      { name: 'damping', defaultValue: 7000, minValue: 200, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'width', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // Delay modulation depth 0..1 (up to +-0.5 ms) and base rate
      { name: 'mod', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'modRate', defaultValue: 0.6, minValue: 0.05, maxValue: 5, automationRate: 'k-rate' },
      // lowCut / highCut (input tone) are settings (processorOptions or { type: 'set' } messages).
      // Output is 100% wet: the Reverb2 wrapper mixes dry / wet with native gains.
    ];
  }

  constructor(options) {
    super();
    const sr = sampleRate;
    const o = (options && options.processorOptions) || {};
    this.rng = makeRng(o.seed);
    // settings: input tone
    this.lowCut = 20;      // Hz
    this.highCut = 16000;  // Hz
    this.apply(o);
    this.port.onmessage = e => { const m = e.data; if (m && m.type === 'set') this.apply(m); };
    // predelay: interleaved stereo ring buffer (up to 1 s)
    this.pdSize = pow2Ceil(sr * 1.0 + 8);
    this.pd = new Float32Array(this.pdSize * 2);
    this.pdW = 0;
    this.pdLen = -1;
    // diffuser: 3 stages x 8 channel delays, one ring buffer each (shared write index)
    this.difMax = new Int32Array(24);
    this.difLen = new Int32Array(24);
    let maxD = 1;
    for (let s = 0; s < 3; s++) {
      for (let c = 0; c < 8; c++) {
        const d = Math.round((DIF_MS[s][c] * sr) / 1000);
        this.difMax[s * 8 + c] = d;
        if (d > maxD) maxD = d;
      }
    }
    this.difSize = pow2Ceil(maxD + 2);
    this.db = [];
    for (let j = 0; j < 24; j++) this.db.push(new Float32Array(this.difSize));
    this.difW = 0;
    // feedback lines
    this.lnSize = pow2Ceil((FDN_MS[7] * sr) / 1000 + 0.0006 * sr + 16);
    this.ln = [];
    for (let c = 0; c < 8; c++) this.ln.push(new Float32Array(this.lnSize));
    this.lnW = 0;
    this.len = new Float64Array(8).fill(-1);  // gliding base length (samples, integer when settled)
    this.dA = new Float64Array(8);             // delay at the start / end of the quantum (incl. modulation)
    this.dB = new Float64Array(8);
    this.intD = new Int32Array(8);             // >= 0: integer delay (no interpolation), -1: interpolate
    this.gain = new Float64Array(8);
    this.cut = new Float64Array(8);            // 1 - pole of the per-line absorption filter
    this.lp = new Float64Array(8);
    this.mph = new Float64Array(4);
    this.mval = new Float64Array(4);
    for (let k = 0; k < 4; k++) this.mph[k] = this.rng();
    // input tone filter states (one-pole high-pass x1/y1, one-pole low-pass)
    this.hxL = 0; this.hyL = 0; this.hxR = 0; this.hyR = 0; this.lpL = 0; this.lpR = 0;
    this.lastSize = -1;
    this.quiet = 0;                            // quanta with silent input and a decayed tail
    this.quietNeed = Math.ceil(this.lnSize / 128) + 2;
  }

  /** Apply settings from processorOptions or a { type: 'set' } message */
  apply(m) {
    if (typeof m.lowCut === 'number' && m.lowCut === m.lowCut) this.lowCut = clamp(m.lowCut, 10, 2000);
    if (typeof m.highCut === 'number' && m.highCut === m.highCut) this.highCut = clamp(m.highCut, 500, 20000);
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const oL = out[0], oR = out.length > 1 ? out[1] : null;
    const n = oL.length;
    const inp = inputs[0];
    let iL = inp && inp.length ? inp[0] : null;
    let iR = inp && inp.length > 1 ? inp[1] : iL;
    const sr = sampleRate;

    // Idle: silent input and a tail below -140 dB -> skip all work
    let inPeak = 0;
    if (iL) {
      for (let i = 0; i < n; i++) { const a = iL[i], b = iR[i]; inPeak += a * a + b * b; }
      // NaN / Infinity in the input: treat the quantum as silence so it never enters the delay lines
      if (!(inPeak < Infinity)) { iL = null; iR = null; inPeak = 0; }
    }
    const silentIn = inPeak < 1e-18;
    if (silentIn && this.quiet >= this.quietNeed) {
      oL.fill(0);
      if (oR) oR.fill(0);
      return true;
    }

    const decay = params.decay[0], size = params.size[0], width = params.width[0];
    const modD = params.mod[0] * 0.0005 * sr;
    const scale = 0.25 + 0.75 * size;

    // --- per-quantum coefficients
    const hcA = 1 - Math.exp((-TWO_PI * Math.min(this.highCut, 0.45 * sr)) / sr);
    const lcA = Math.exp((-TWO_PI * this.lowCut) / sr);
    const cw = Math.cos((TWO_PI * Math.min(params.damping[0], 0.49 * sr)) / sr);
    const sm = 1 - Math.exp(-n / (0.08 * sr)); // length glide (~80 ms) when size changes
    const rate = (params.modRate[0] * n) / sr;
    const len = this.len, dA = this.dA, dB = this.dB, intD = this.intD, gain = this.gain, cut = this.cut;
    for (let c = 0; c < 8; c++) {
      const target = Math.round((FDN_MS[c] * sr * scale) / 1000);
      let l0 = len[c];
      if (l0 < 0) l0 = target;
      let l1 = l0 + (target - l0) * sm;
      if (Math.abs(target - l1) < 0.01) l1 = target;
      len[c] = l1;
      let m0 = 0, m1 = 0;
      if ((c & 1) === 0) {
        const k = c >> 1;
        m0 = this.mval[k];
        let ph = this.mph[k] + rate * FDN_MOD_RATE[k];
        ph -= Math.floor(ph);
        this.mph[k] = ph;
        m1 = modD > 0 ? sin2pi(ph) * modD : 0;
        this.mval[k] = m1;
      }
      dA[c] = l0 + m0;
      dB[c] = l1 + m1;
      intD[c] = dA[c] === dB[c] && dA[c] === Math.floor(dA[c]) ? dA[c] : -1;
      // RT60: gain per pass = 10^(-3 len / (decay sr)). Jot absorption filter: a one-pole
      // low-pass whose loss at the damping frequency equals that gain again, so the RT60
      // halves there whatever the line length (size-independent tone).
      const g = Math.pow(10, (-3 * l1) / (decay * sr));
      const g2 = g * g, A = 1 - g2 * cw, B = 1 - g2;
      const pole = B / (A + Math.sqrt(A * A > B * B ? A * A - B * B : 0));
      gain[c] = g;
      cut[c] = 1 - pole;
    }
    // diffuser lengths follow the size
    if (size !== this.lastSize) {
      const f = 0.35 + 0.65 * size;
      for (let j = 0; j < 24; j++) this.difLen[j] = Math.round(this.difMax[j] * f);
      this.lastSize = size;
    }
    const pdTarget = Math.round(Math.min(this.pdSize - 4, params.predelay[0] * sr));
    if (this.pdLen < 0) this.pdLen = pdTarget;
    const pd0 = this.pdLen;
    let pd1 = pd0 + (pdTarget - pd0) * sm;
    if (Math.abs(pdTarget - pd1) < 0.01) pd1 = pdTarget;
    this.pdLen = pd1;
    const pdInt = pd0 === pd1 && pd0 === Math.floor(pd0);

    const pd = this.pd, pdMask = this.pdSize - 1;
    const dm = this.difSize - 1, lm = this.lnSize - 1;
    const db = this.db, dl = this.difLen;
    const b00 = db[0], b01 = db[1], b02 = db[2], b03 = db[3], b04 = db[4], b05 = db[5], b06 = db[6], b07 = db[7];
    const L00 = dl[0], L01 = dl[1], L02 = dl[2], L03 = dl[3], L04 = dl[4], L05 = dl[5], L06 = dl[6], L07 = dl[7];
    const b10 = db[8], b11 = db[9], b12 = db[10], b13 = db[11], b14 = db[12], b15 = db[13], b16 = db[14], b17 = db[15];
    const L10 = dl[8], L11 = dl[9], L12 = dl[10], L13 = dl[11], L14 = dl[12], L15 = dl[13], L16 = dl[14], L17 = dl[15];
    const b20 = db[16], b21 = db[17], b22 = db[18], b23 = db[19], b24 = db[20], b25 = db[21], b26 = db[22], b27 = db[23];
    const L20 = dl[16], L21 = dl[17], L22 = dl[18], L23 = dl[19], L24 = dl[20], L25 = dl[21], L26 = dl[22], L27 = dl[23];
    const ln = this.ln;
    const n0 = ln[0], n1 = ln[1], n2 = ln[2], n3 = ln[3], n4 = ln[4], n5 = ln[5], n6 = ln[6], n7 = ln[7];
    const I0 = intD[0], I1 = intD[1], I2 = intD[2], I3 = intD[3], I4 = intD[4], I5 = intD[5], I6 = intD[6], I7 = intD[7];
    const A0 = dA[0], S0 = dB[0] - dA[0], A1 = dA[1], S1 = dB[1] - dA[1], A2 = dA[2], S2 = dB[2] - dA[2], A3 = dA[3], S3 = dB[3] - dA[3], A4 = dA[4], S4 = dB[4] - dA[4], A5 = dA[5], S5 = dB[5] - dA[5], A6 = dA[6], S6 = dB[6] - dA[6], A7 = dA[7], S7 = dB[7] - dA[7];
    const k0 = cut[0], g0 = gain[0], k1 = cut[1], g1 = gain[1], k2 = cut[2], g2 = gain[2], k3 = cut[3], g3 = gain[3], k4 = cut[4], g4 = gain[4], k5 = cut[5], g5 = gain[5], k6 = cut[6], g6 = gain[6], k7 = cut[7], g7 = gain[7];
    const lp = this.lp;
    let p0 = lp[0], p1 = lp[1], p2 = lp[2], p3 = lp[3], p4 = lp[4], p5 = lp[5], p6 = lp[6], p7 = lp[7];
    let pdW = this.pdW, w = this.difW, lw = this.lnW;
    let hxL = this.hxL, hyL = this.hyL, hxR = this.hxR, hyR = this.hyR, lpL = this.lpL, lpR = this.lpR;
    const invN = 1 / n;
    const SQ8 = 0.35355339059327373;
    // Output taps: two orthogonal Hadamard rows -> decorrelated L / R
    const ws = 0.5 * width, wm = 0.5;
    const outG = FDN_OUT_GAIN;
    let tail = 0;

    for (let i = 0; i < n; i++) {
      const fr = (i + 1) * invN;
      // input tone: one-pole low-cut (DC-blocker form) + one-pole high-cut
      const xl = iL ? iL[i] : 0, xr = iR ? iR[i] : 0;
      hyL = xl - hxL + lcA * hyL; hxL = xl;
      hyR = xr - hxR + lcA * hyR; hxR = xr;
      lpL += hcA * (hyL - lpL); lpR += hcA * (hyR - lpR);
      // predelay (integer read unless the time is gliding)
      pd[pdW << 1] = lpL; pd[(pdW << 1) | 1] = lpR;
      let pl, pr;
      if (pdInt) {
        const r = ((pdW - pd0) & pdMask) << 1;
        pl = pd[r]; pr = pd[r | 1];
      } else {
        const pdD = pd0 + (pd1 - pd0) * fr;
        const pdI = pdD | 0, pdF = pdD - pdI;
        const r0 = ((pdW - pdI) & pdMask) << 1, r1 = ((pdW - pdI - 1) & pdMask) << 1;
        pl = pd[r0] + (pd[r1] - pd[r0]) * pdF;
        pr = pd[r0 | 1] + (pd[r1 | 1] - pd[r0 | 1]) * pdF;
      }
      pdW = (pdW + 1) & pdMask;
      // upmix to 8 channels, then 3 diffusion stages: delay, polarity flip, Hadamard
      let v0 = pl, v1 = pr, v2 = pl, v3 = -pr, v4 = -pl, v5 = pr, v6 = pl, v7 = pr;
      const wi = w & dm;
      // stage 1
      b00[wi] = v0; b01[wi] = v1; b02[wi] = v2; b03[wi] = v3; b04[wi] = v4; b05[wi] = v5; b06[wi] = v6; b07[wi] = v7;
      v0 = b00[(w - L00) & dm]; v1 = -b01[(w - L01) & dm];
      v2 = b02[(w - L02) & dm]; v3 = b03[(w - L03) & dm];
      v4 = -b04[(w - L04) & dm]; v5 = b05[(w - L05) & dm];
      v6 = -b06[(w - L06) & dm]; v7 = -b07[(w - L07) & dm];
      {
        const a0 = v0 + v1, a1 = v0 - v1, a2 = v2 + v3, a3 = v2 - v3, a4 = v4 + v5, a5 = v4 - v5, a6 = v6 + v7, a7 = v6 - v7;
        const c0 = a0 + a2, c2 = a0 - a2, c1 = a1 + a3, c3 = a1 - a3, c4 = a4 + a6, c6 = a4 - a6, c5 = a5 + a7, c7 = a5 - a7;
        v0 = (c0 + c4) * SQ8; v4 = (c0 - c4) * SQ8; v1 = (c1 + c5) * SQ8; v5 = (c1 - c5) * SQ8;
        v2 = (c2 + c6) * SQ8; v6 = (c2 - c6) * SQ8; v3 = (c3 + c7) * SQ8; v7 = (c3 - c7) * SQ8;
      }
      // stage 2
      b10[wi] = v0; b11[wi] = v1; b12[wi] = v2; b13[wi] = v3; b14[wi] = v4; b15[wi] = v5; b16[wi] = v6; b17[wi] = v7;
      v0 = -b10[(w - L10) & dm]; v1 = b11[(w - L11) & dm];
      v2 = b12[(w - L12) & dm]; v3 = -b13[(w - L13) & dm];
      v4 = b14[(w - L14) & dm]; v5 = -b15[(w - L15) & dm];
      v6 = -b16[(w - L16) & dm]; v7 = b17[(w - L17) & dm];
      {
        const a0 = v0 + v1, a1 = v0 - v1, a2 = v2 + v3, a3 = v2 - v3, a4 = v4 + v5, a5 = v4 - v5, a6 = v6 + v7, a7 = v6 - v7;
        const c0 = a0 + a2, c2 = a0 - a2, c1 = a1 + a3, c3 = a1 - a3, c4 = a4 + a6, c6 = a4 - a6, c5 = a5 + a7, c7 = a5 - a7;
        v0 = (c0 + c4) * SQ8; v4 = (c0 - c4) * SQ8; v1 = (c1 + c5) * SQ8; v5 = (c1 - c5) * SQ8;
        v2 = (c2 + c6) * SQ8; v6 = (c2 - c6) * SQ8; v3 = (c3 + c7) * SQ8; v7 = (c3 - c7) * SQ8;
      }
      // stage 3
      b20[wi] = v0; b21[wi] = v1; b22[wi] = v2; b23[wi] = v3; b24[wi] = v4; b25[wi] = v5; b26[wi] = v6; b27[wi] = v7;
      v0 = b20[(w - L20) & dm]; v1 = b21[(w - L21) & dm];
      v2 = -b22[(w - L22) & dm]; v3 = b23[(w - L23) & dm];
      v4 = -b24[(w - L24) & dm]; v5 = -b25[(w - L25) & dm];
      v6 = b26[(w - L26) & dm]; v7 = -b27[(w - L27) & dm];
      {
        const a0 = v0 + v1, a1 = v0 - v1, a2 = v2 + v3, a3 = v2 - v3, a4 = v4 + v5, a5 = v4 - v5, a6 = v6 + v7, a7 = v6 - v7;
        const c0 = a0 + a2, c2 = a0 - a2, c1 = a1 + a3, c3 = a1 - a3, c4 = a4 + a6, c6 = a4 - a6, c5 = a5 + a7, c7 = a5 - a7;
        v0 = (c0 + c4) * SQ8; v4 = (c0 - c4) * SQ8; v1 = (c1 + c5) * SQ8; v5 = (c1 - c5) * SQ8;
        v2 = (c2 + c6) * SQ8; v6 = (c2 - c6) * SQ8; v3 = (c3 + c7) * SQ8; v7 = (c3 - c7) * SQ8;
      }
      w = (w + 1) & dm;
      // feedback network: read the lines (Catmull-Rom while modulated or gliding),
      // absorption low-pass and decay gain
      p0 += k0 * ((I0 >= 0 ? n0[(lw - I0) & lm] : readFrac(n0, lw, lm, A0 + S0 * fr)) - p0);
      p1 += k1 * ((I1 >= 0 ? n1[(lw - I1) & lm] : readFrac(n1, lw, lm, A1 + S1 * fr)) - p1);
      p2 += k2 * ((I2 >= 0 ? n2[(lw - I2) & lm] : readFrac(n2, lw, lm, A2 + S2 * fr)) - p2);
      p3 += k3 * ((I3 >= 0 ? n3[(lw - I3) & lm] : readFrac(n3, lw, lm, A3 + S3 * fr)) - p3);
      p4 += k4 * ((I4 >= 0 ? n4[(lw - I4) & lm] : readFrac(n4, lw, lm, A4 + S4 * fr)) - p4);
      p5 += k5 * ((I5 >= 0 ? n5[(lw - I5) & lm] : readFrac(n5, lw, lm, A5 + S5 * fr)) - p5);
      p6 += k6 * ((I6 >= 0 ? n6[(lw - I6) & lm] : readFrac(n6, lw, lm, A6 + S6 * fr)) - p6);
      p7 += k7 * ((I7 >= 0 ? n7[(lw - I7) & lm] : readFrac(n7, lw, lm, A7 + S7 * fr)) - p7);
      const y0 = p0 * g0, y1 = p1 * g1, y2 = p2 * g2, y3 = p3 * g3, y4 = p4 * g4, y5 = p5 * g5, y6 = p6 * g6, y7 = p7 * g7;
      // Householder feedback (I - 2/N 11^T) plus the diffused input
      const sum = y0 + y1 + y2 + y3 + y4 + y5 + y6 + y7;
      const hh = sum * 0.25;
      const li = lw & lm;
      n0[li] = y0 - hh + v0; n1[li] = y1 - hh + v1; n2[li] = y2 - hh + v2; n3[li] = y3 - hh + v3; n4[li] = y4 - hh + v4; n5[li] = y5 - hh + v5; n6[li] = y6 - hh + v6; n7[li] = y7 - hh + v7;
      lw = (lw + 1) & lm;
      // stereo out from the line outputs
      const yl = (y0 - y1 + y2 - y3 + y4 - y5 + y6 - y7) * SQ8;
      const yr = (y0 + y1 - y2 - y3 + y4 + y5 - y6 - y7) * SQ8;
      tail += sum * sum + yl * yl + yr * yr;
      const mid = (yl + yr) * wm, side = (yl - yr) * ws;
      oL[i] = (mid + side) * outG;
      if (oR) oR[i] = (mid - side) * outG;
    }
    this.pdW = pdW; this.difW = w; this.lnW = lw;
    this.hxL = hxL; this.hyL = flush(hyL); this.hxR = hxR; this.hyR = flush(hyR);
    this.lpL = flush(lpL); this.lpR = flush(lpR);
    lp[0] = flush(p0); lp[1] = flush(p1); lp[2] = flush(p2); lp[3] = flush(p3); lp[4] = flush(p4); lp[5] = flush(p5); lp[6] = flush(p6); lp[7] = flush(p7);
    // blow-up guard (NaN/Infinity anywhere in the loop): clear the network
    if (!(tail < Infinity)) {
      lp.fill(0);
      pd.fill(0);
      for (let c = 0; c < 8; c++) ln[c].fill(0);
      for (let j = 0; j < 24; j++) db[j].fill(0);
      this.hxL = this.hyL = this.hxR = this.hyR = this.lpL = this.lpR = 0;
      tail = 0;
    }
    this.quiet = silentIn && tail < 1e-14 * n ? this.quiet + 1 : 0;
    return true;
  }
}

/** Catmull-Rom read at fractional delay d (samples) behind write index w */
function readFrac(buf, w, mask, d) {
  const di = d | 0, f = d - di;
  const i0 = w - di;
  const xm1 = buf[(i0 + 1) & mask], x0 = buf[i0 & mask], x1 = buf[(i0 - 1) & mask], x2 = buf[(i0 - 2) & mask];
  const c1 = 0.5 * (x1 - xm1), c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
  return ((c3 * f + c2) * f + c1) * f + x0;
}

// ============================================================================
// CHORUS (BBD style)
// ============================================================================

class ChorusProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 20, automationRate: 'k-rate' },
      // Modulation depth and centre delay (seconds)
      { name: 'depth', defaultValue: 0.0018, minValue: 0, maxValue: 0.02, automationRate: 'k-rate' },
      { name: 'delay', defaultValue: 0.0035, minValue: 0.0005, maxValue: 0.05, automationRate: 'k-rate' },
      { name: 'feedback', defaultValue: 0, minValue: -0.95, maxValue: 0.95, automationRate: 'k-rate' },
      { name: 'width', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // voices / lfoShape / highCut / lowCut / drive are settings (processorOptions or
      // { type: 'set' } messages). Output is 100% wet: the Chorus wrapper mixes dry / wet.
    ];
  }

  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    const size = pow2Ceil(sampleRate * 0.08 + 8);
    this.size = size;
    this.bufA = new Float32Array(size);
    this.bufB = new Float32Array(size);
    this.w = 0;
    this.phase = typeof o.phase === 'number' ? o.phase - Math.floor(o.phase) : 0;
    // settings
    this.voices = 2;      // 1 = one BBD line (mono wet), 2 = two lines with opposite LFO phase (stereo)
    this.lfoShape = 0;    // 0 = triangle (Juno), 1 = sine
    this.highCut = 9000;  // bucket-brigade band limit (2-pole), Hz
    this.lowCut = 30;     // wet low cut, Hz
    this.drive = 0.15;    // BBD input saturation 0..1
    this.apply(o);
    this.port.onmessage = e => { const m = e.data; if (m && m.type === 'set') this.apply(m); };
    this.fbA = 0; this.fbB = 0;
    // 2-pole lowpass (TPT SVF) states per voice, one-pole highpass states
    this.a1 = 0; this.a2 = 0; this.b1 = 0; this.b2 = 0;
    this.hxA = 0; this.hyA = 0; this.hxB = 0; this.hyB = 0;
    this.d0 = -1;
    // samples since a non-zero value was last written to either line (>= size: both all zero)
    this.zrun = size;
  }

  /** Apply settings from processorOptions or a { type: 'set' } message */
  apply(m) {
    const num = (v, lo, hi) => (typeof v === 'number' && v === v ? clamp(v, lo, hi) : undefined);
    const v = num(m.voices, 1, 2);
    if (v !== undefined) this.voices = v >= 1.5 ? 2 : 1;
    const s = num(m.lfoShape, 0, 1);
    if (s !== undefined) this.lfoShape = s >= 0.5 ? 1 : 0;
    const hc = num(m.highCut, 500, 20000);
    if (hc !== undefined) this.highCut = hc;
    const lc = num(m.lowCut, 10, 4000);
    if (lc !== undefined) this.lowCut = lc;
    const d = num(m.drive, 0, 1);
    if (d !== undefined) this.drive = d;
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const oL = out[0], oR = out[1] || out[0];
    const n = oL.length;
    const inp = inputs[0];
    const iL = inp && inp[0], iR = inp && (inp[1] || inp[0]);
    const sr = sampleRate;
    const rate = params.rate[0], depth = params.depth[0] * sr;
    const two = this.voices === 2;
    const fbk = params.feedback[0], width = params.width[0];
    const drive = this.drive;
    const dG = 1 + 4 * drive, dN = 1 / dG;
    const sine = this.lfoShape === 1;
    // BBD band limit: Butterworth 2-pole TPT
    const g = Math.tan((Math.PI * Math.min(this.highCut, sr * 0.45)) / sr);
    const kq = 1.4142135623730951;
    const h1 = 1 / (1 + g * (g + kq)), h2 = g * h1, h3 = g * h2;
    const hc = Math.exp((-TWO_PI * this.lowCut) / sr);
    // centre delay glides (no zipper / pitch jumps)
    const dTarget = Math.min(params.delay[0] * sr, this.size - depth - 8);
    if (this.d0 < 0) this.d0 = dTarget;
    const dStart = this.d0;
    this.d0 += (dTarget - this.d0) * (1 - Math.exp(-n / (0.05 * sr)));
    const dEnd = this.d0;
    const inc = rate / sr;
    const dMax = this.size - 4;
    const bA = this.bufA, bB = this.bufB, mask = this.size - 1;
    let w = this.w, ph = this.phase;
    let fbA = this.fbA, fbB = this.fbB;
    let a1 = this.a1, a2 = this.a2, b1 = this.b1, b2 = this.b2;
    let hxA = this.hxA, hyA = this.hyA, hxB = this.hxB, hyB = this.hyB;
    let silent = true;
    if (iL) for (let i = 0; i < n; i++) if (iL[i] !== 0 || iR[i] !== 0) { silent = false; break; }
    // Idle: both lines hold only zeros, every filter and the feedback are at rest and the input is
    // silent. The loop below would then read, filter and write nothing but zeros: the output is
    // exactly zero, so only the LFO phase (sample by sample, as below) and the write position move.
    if (silent && this.zrun >= this.size && fbA === 0 && fbB === 0 && a1 === 0 && a2 === 0 && b1 === 0 && b2 === 0 &&
        hxA === 0 && hyA === 0 && hxB === 0 && hyB === 0) {
      for (let i = 0; i < n; i++) { ph += inc; if (ph >= 1) ph -= 1; }
      this.w = (w + n) & mask;
      this.phase = ph;
      oL.fill(0);
      if (oR !== oL) oR.fill(0);
      return true;
    }
    const w0 = w;
    const ws = 0.5 * width;
    for (let i = 0; i < n; i++) {
      const xl = iL ? iL[i] : 0, xr = iR ? iR[i] : 0;
      const inA = two ? xl : 0.5 * (xl + xr);
      const inB = xr;
      // BBD input: feedback + soft saturation
      let sa = inA + fbk * fbA;
      if (drive > 0) sa = tanhF(sa * dG) * dN * drive + sa * (1 - drive);
      bA[w] = sa;
      let lfo;
      if (sine) lfo = sin2pi(ph);
      else { const t = ph - 0.5; lfo = 1 - 4 * (t < 0 ? -t : t); }
      ph += inc; if (ph >= 1) ph -= 1;
      const dc = dStart + (dEnd - dStart) * ((i + 1) / n);
      // voice A
      let d = dc + depth * lfo;
      if (d < 2) d = 2; else if (d > dMax) d = dMax;
      let di = d | 0, f = d - di;
      let i0 = (w - di) & mask;
      let xm1 = bA[(i0 + 1) & mask], x0 = bA[i0], x1 = bA[(i0 - 1) & mask], x2 = bA[(i0 - 2) & mask];
      let ya = ((((0.5 * (x2 - xm1) + 1.5 * (x0 - x1)) * f + (xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2)) * f + 0.5 * (x1 - xm1)) * f) + x0;
      // BBD band limit + wet low cut
      let v3 = ya - a2, v1 = h1 * a1 + h2 * v3, v2 = a2 + h2 * a1 + h3 * v3;
      a1 = 2 * v1 - a1; a2 = 2 * v2 - a2;
      ya = v2;
      fbA = ya;
      let hy = hc * (hyA + ya - hxA); hxA = ya; hyA = hy; ya = hy;
      let yb = ya;
      if (two) {
        let sb = inB + fbk * fbB;
        if (drive > 0) sb = tanhF(sb * dG) * dN * drive + sb * (1 - drive);
        bB[w] = sb;
        d = dc - depth * lfo;
        if (d < 2) d = 2; else if (d > dMax) d = dMax;
        di = d | 0; f = d - di;
        i0 = (w - di) & mask;
        xm1 = bB[(i0 + 1) & mask]; x0 = bB[i0]; x1 = bB[(i0 - 1) & mask]; x2 = bB[(i0 - 2) & mask];
        yb = ((((0.5 * (x2 - xm1) + 1.5 * (x0 - x1)) * f + (xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2)) * f + 0.5 * (x1 - xm1)) * f) + x0;
        v3 = yb - b2; v1 = h1 * b1 + h2 * v3; v2 = b2 + h2 * b1 + h3 * v3;
        b1 = 2 * v1 - b1; b2 = 2 * v2 - b2;
        yb = v2;
        fbB = yb;
        hy = hc * (hyB + yb - hxB); hxB = yb; hyB = hy; yb = hy;
      } else {
        bB[w] = 0;
      }
      w = (w + 1) & mask;
      const mid = 0.5 * (ya + yb), side = (ya - yb) * ws;
      oL[i] = mid + side;
      if (oR !== oL) oR[i] = mid - side;
    }
    this.w = w; this.phase = ph; this.fbA = fbA; this.fbB = fbB;
    // how long the lines have held only zeros: with a silent input, count the zeros this quantum
    // wrote at its end (any input sample may have written a non-zero value, so: none)
    if (silent) {
      let last = -1;
      for (let j = 0; j < n; j++) { const k = (w0 + j) & mask; if (bA[k] !== 0 || bB[k] !== 0) last = j; }
      this.zrun = last < 0 ? Math.min(this.size, this.zrun + n) : n - 1 - last;
    } else this.zrun = 0;
    if (!Number.isFinite(a1 + a2 + b1 + b2 + hyA + hyB)) { a1 = a2 = b1 = b2 = hxA = hyA = hxB = hyB = 0; this.fbA = this.fbB = 0; bA.fill(0); bB.fill(0); this.zrun = this.size; }
    this.a1 = flush(a1); this.a2 = flush(a2); this.b1 = flush(b1); this.b2 = flush(b2);
    this.hxA = hxA; this.hyA = flush(hyA); this.hxB = hxB; this.hyB = flush(hyB);
    this.fbA = flush(this.fbA); this.fbB = flush(this.fbB);
    return true;
  }
}

registerProcessor('vco', VcoProcessor);
registerProcessor('ladder', LadderProcessor);
registerProcessor('env', EnvProcessor);
registerProcessor('svf', SvfProcessor);
registerProcessor('fdn-reverb', FdnReverbProcessor);
registerProcessor('chorus', ChorusProcessor);
