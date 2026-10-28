// ============================================================================
// Allen & Heath Xone:96 - AudioWorklet processors (devices/xone96)
//
//   'xone96-strips'  up to four channel strips per node: input select, GAIN,
//                    Xone EQ (LR4 isolator kills + peaking mids), +20 dBu soft
//                    clip, the post-EQ pre-fader meter, channel fader, the
//                    crossfader VCA, FILTER assign, SEND 1 (pre/post), SEND 2,
//                    CUE (pre/post EQ) - and the twin's built-in decks, which
//                    are synthesised here so they cost no native nodes.
//   'xone96-master'  LR MIX summing (+21 dBu clip), MASTER 1 (+24 dBu clip),
//                    BOOTH (3-band EQ, mono, mute, +18 dBu clip), MONITOR
//                    headphones (CUE/MST blend, SPLIT CUE), the LR meters and
//                    the twin's YOU HEAR selector.
//
// Every setting is a port message: no AudioParams, which cost CPU on every
// render quantum. Gains glide over ~5 ms (per-block targets, linear inside the
// block), so nothing zips or clicks. Nothing looks ahead: zero added latency.
// Levels: 0.1 = 0 dBu. Meters: DIN-style ballistics (instant attack, 20 dB in
// 1.5 s release) and a 1 s PK! hold, reported every 32 ms.
// ============================================================================

const SR = sampleRate;
const BLOCK = 128;
const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;
const GLIDE = 1 - Math.exp(-BLOCK / (0.005 * SR));
const METER_REL = Math.pow(10, (-20 / 1.5 / 20) * (BLOCK / SR));
const PK_LIN = 0.1 * Math.pow(10, 15 / 20);
const PK_HOLD = Math.round((1.0 * SR) / BLOCK);
const METER_EVERY = 12;
// Keep filtering this long after a channel's input goes quiet (EQ tails), then sleep
const TAIL_BLOCKS = Math.round((0.25 * SR) / BLOCK);

// ---------------------------------------------------------------------------
// DSP helpers
// ---------------------------------------------------------------------------

/** tanh, Pade [7/6], monotonic, ~1e-4 */
function tanhF(x) {
  if (x > 4.97) return 1;
  if (x < -4.97) return -1;
  const x2 = x * x;
  return (x * (135135 + x2 * (17325 + x2 * (378 + x2)))) / (135135 + x2 * (62370 + x2 * (3150 + 28 * x2)));
}

/** Soft clip: linear to 80 % of `lim`, then a tanh knee that never passes `lim` */
function clip(x, lim) {
  const k = 0.8 * lim;
  if (x > k) return k + 0.2 * lim * tanhF((x - k) / (0.2 * lim));
  if (x < -k) return -k - 0.2 * lim * tanhF((-x - k) / (0.2 * lim));
  return x;
}

/** sin(2 pi p), p in [0, 1): folded odd polynomial, ~1.5e-4 */
function sin2pi(p) {
  let x = (p < 0.5 ? p : p - 1) * TWO_PI;
  if (x > HALF_PI) x = Math.PI - x;
  else if (x < -HALF_PI) x = -Math.PI - x;
  const x2 = x * x;
  return x * (1 - x2 * (0.16666666667 - x2 * (0.0083333333 - x2 * 0.000198412698)));
}

/** 2-point polyBLEP residual */
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);

// RBJ biquads, coefficients [b0 b1 b2 a1 a2] at offset o
function bqLowpass(c, o, f, q) {
  const w = (TWO_PI * f) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  c[o] = (1 - cs) / 2 / a0; c[o + 1] = (1 - cs) / a0; c[o + 2] = (1 - cs) / 2 / a0;
  c[o + 3] = (-2 * cs) / a0; c[o + 4] = (1 - al) / a0;
}
function bqHighpass(c, o, f, q) {
  const w = (TWO_PI * f) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  c[o] = (1 + cs) / 2 / a0; c[o + 1] = -(1 + cs) / a0; c[o + 2] = (1 + cs) / 2 / a0;
  c[o + 3] = (-2 * cs) / a0; c[o + 4] = (1 - al) / a0;
}
function bqAllpass(c, o, f, q) {
  const w = (TWO_PI * f) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  c[o] = (1 - al) / a0; c[o + 1] = (-2 * cs) / a0; c[o + 2] = (1 + al) / a0;
  c[o + 3] = (-2 * cs) / a0; c[o + 4] = (1 - al) / a0;
}
function bqPeak(c, o, f, q, db) {
  const A = Math.pow(10, db / 40), w = (TWO_PI * f) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al / A;
  c[o] = (1 + al * A) / a0; c[o + 1] = (-2 * cs) / a0; c[o + 2] = (1 - al * A) / a0;
  c[o + 3] = (-2 * cs) / a0; c[o + 4] = (1 - al / A) / a0;
}
function bqShelf(c, o, f, db, high) {
  const A = Math.pow(10, db / 40), w = (TWO_PI * f) / SR, cs = Math.cos(w), sn = Math.sin(w);
  const al = (sn / 2) * Math.SQRT2, sq = 2 * Math.sqrt(A) * al;
  let b0, b1, b2, a0, a1, a2;
  if (high) {
    b0 = A * (A + 1 + (A - 1) * cs + sq); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - sq);
    a0 = A + 1 - (A - 1) * cs + sq; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - sq;
  } else {
    b0 = A * (A + 1 - (A - 1) * cs + sq); b1 = 2 * A * (A - 1 - (A + 1) * cs); b2 = A * (A + 1 - (A - 1) * cs - sq);
    a0 = A + 1 + (A - 1) * cs + sq; a1 = -2 * (A - 1 + (A + 1) * cs); a2 = A + 1 + (A - 1) * cs - sq;
  }
  c[o] = b0 / a0; c[o + 1] = b1 / a0; c[o + 2] = b2 / a0; c[o + 3] = a1 / a0; c[o + 4] = a2 / a0;
}

/** One transposed direct form II biquad over buf[0..BLOCK) in place */
function bqRun(buf, c, o, z, zo) {
  const b0 = c[o], b1 = c[o + 1], b2 = c[o + 2], a1 = c[o + 3], a2 = c[o + 4];
  let z1 = z[zo], z2 = z[zo + 1];
  for (let i = 0; i < BLOCK; i++) {
    const x = buf[i];
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    buf[i] = y;
  }
  if (!(z1 === z1) || !(z2 === z2) || z1 > 1e6 || z1 < -1e6) { z1 = 0; z2 = 0; }
  if (z1 < 1e-20 && z1 > -1e-20) z1 = 0;
  if (z2 < 1e-20 && z2 > -1e-20) z2 = 0;
  z[zo] = z1; z[zo + 1] = z2;
}

/** out += buf * gain, the gain ramping g0 -> g1 across the block */
function addRamp(out, buf, g0, g1) {
  if (g0 === 0 && g1 === 0) return;
  if (g0 === g1) { for (let i = 0; i < BLOCK; i++) out[i] += buf[i] * g0; return; }
  const dg = (g1 - g0) / BLOCK;
  let g = g0;
  for (let i = 0; i < BLOCK; i++) { out[i] += buf[i] * g; g += dg; }
}

/** Mix an input (mono or stereo) into xL / xR; true if it contributed */
function addInput(xL, xR, inp, g0, g1) {
  if ((g0 === 0 && g1 === 0) || !inp || !inp.length) return false;
  addRamp(xL, inp[0], g0, g1);
  addRamp(xR, inp[1] || inp[0], g0, g1);
  return true;
}

/** Send yL / yR into a stereo output bus */
function route(o, yL, yR, g0, g1) {
  if (!o || !o.length || (g0 === 0 && g1 === 0)) return;
  addRamp(o[0], yL, g0, g1);
  addRamp(o[1] || o[0], yR, g0, g1);
}

/** Voice filter: topology-preserving SVF coefficients onto object v */
function svfSet(v, f, q) {
  const g = Math.tan((Math.PI * Math.min(f, SR * 0.45)) / SR);
  const k = 1 / q;
  v.k = k; v.a1 = 1 / (1 + g * (g + k)); v.a2 = g * v.a1; v.a3 = g * v.a2;
}

// ============================================================================
// Built-in decks (twin only)
// One "record" per channel, synthesised voice by voice. TRACK A / TRACK B are
// 32-bar arrangements (an element enters every 8 bars, a crash marks each
// phrase, the kick drops out for the last two bars); the rest are stems. All in
// A minor: Am7 - Fmaj7 - C - G, one bar each.
// ============================================================================

const S_TRACK_A = 0, S_TRACK_B = 1, S_DRUMS = 2, S_BASS = 3, S_STABS = 4, S_PERC = 5, S_PAD = 6, S_LEAD = 7, S_NONE = 8, S_FULL = 9;
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 60, 64, 67], [55, 59, 62, 67]];
const ROOTS = [33, 29, 36, 31];
const LEAD = [
  [0, 76, 3], [4, 74, 2], [6, 72, 2], [8, 69, 6], [14, 72, 2],
  [16, 72, 3], [20, 69, 2], [22, 67, 2], [24, 69, 8],
  [32, 72, 3], [36, 74, 2], [38, 76, 2], [40, 79, 6], [46, 76, 2],
  [48, 74, 4], [52, 71, 4], [56, 74, 8],
];
const ARR = 32;
const BASS_A = { 2: [0, 1.6], 6: [0, 1.6], 7: [12, 0.6], 10: [0, 1.6], 13: [7, 0.8], 14: [0, 1.5] };
const BASS_B = { 0: 0, 2: 12, 3: 0, 6: 3, 8: 0, 10: 12, 11: 10, 14: 7 };

/** Balance pan law: centre = full level on both sides */
const panL = p => (p > 0 ? 1 - p : 1);
const panR = p => (p < 0 ? 1 + p : 1);

const KILL_SAMPLES = Math.round(0.02 * SR);

class Voice {
  constructor(deck) { this.deck = deck; this.start = 0; this.end = 0; this.t = 0; this.kill = false; this.killG = 1; }
  begin(start, len) { this.start = start; this.end = start + Math.round(len * SR); this.t = 0; this.kill = false; this.killG = 1; }
  /** Fade out over 20 ms, then free */
  release() { this.kill = true; }
}

class Kick extends Voice {
  set(start, level) {
    this.begin(start, 0.6);
    this.peak = 0.16 * level; this.a = 0.002 * SR; this.h = Math.round(0.06 * SR);
    this.c = Math.exp(-1 / (0.11 * SR));
    this.f = 160; this.ph = 0; this.e = 0;
    this.n1 = Math.round(0.09 * SR); this.r1 = Math.pow(52 / 160, 1 / this.n1);
    this.n2 = Math.round(0.4 * SR); this.r2 = Math.pow(44 / 52, 1 / (this.n2 - this.n1));
  }
  render(L, R, from, to) {
    let t = this.t, ph = this.ph, f = this.f, e = this.e;
    const inv = 1 / SR, a = this.a, h = this.h, pk = this.peak, c = this.c;
    for (let i = from; i < to; i++) {
      if (t < a) e = (pk * t) / a; else if (t < h) e = pk; else e *= c;
      if (t < this.n1) f *= this.r1; else if (t < this.n2) f *= this.r2;
      ph += f * inv; if (ph >= 1) ph -= 1;
      const s = sin2pi(ph) * e;
      L[i] += s; R[i] += s;
      t++;
    }
    this.t = t; this.ph = ph; this.f = f; this.e = e;
  }
}

class Clap extends Voice {
  set(start, level) {
    this.begin(start, 0.35);
    this.p = 0.22 * level; this.e = 0;
    this.ms = Math.round(SR / 1000);
    this.j1 = Math.round(0.011 * SR); this.j2 = Math.round(0.022 * SR); this.j3 = Math.round(0.03 * SR);
    this.c3 = Math.exp(-1 / (0.003 * SR)); this.c50 = Math.exp(-1 / (0.05 * SR));
    svfSet(this, 1400, 1.1);
    this.s1 = 0; this.s2 = 0;
    this.gl = panL(0.05); this.gr = panR(0.05);
  }
  render(L, R, from, to) {
    const d = this.deck, ms = this.ms, p = this.p, j1 = this.j1, j2 = this.j2, j3 = this.j3;
    const k = this.k, a1 = this.a1, a2 = this.a2, a3 = this.a3;
    let t = this.t, e = this.e, s1 = this.s1, s2 = this.s2;
    for (let i = from; i < to; i++) {
      if (t === 0 || t === j1 || t === j2) e = p;
      else if (t === j3) e = 0.8 * p;
      else if (t > j3) e *= this.c50;
      else if ((t < j1 ? t : t < j2 ? t - j1 : t - j2) >= ms) e = 0.2 * p + (e - 0.2 * p) * this.c3;
      const x = d.noise();
      const v3 = x - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
      s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
      const y = k * v1 * e;
      L[i] += y * this.gl; R[i] += y * this.gr;
      t++;
    }
    this.t = t; this.e = e; this.s1 = s1; this.s2 = s2;
  }
}

/** Noise through a 2-pole high-pass, optionally with a +6 dB band at 10 kHz: hats, shaker, crash */
class Hiss extends Voice {
  set(start, peak, attack, hold, tau, len, hpf, presence, pan) {
    this.begin(start, len);
    this.peak = peak; this.a = Math.max(1, attack * SR); this.h = Math.round(hold * SR);
    this.c = Math.exp(-1 / (tau * SR)); this.e = 0;
    svfSet(this, hpf, 1.122);
    this.s1 = 0; this.s2 = 0;
    this.pres = presence;
    const g = Math.tan((Math.PI * Math.min(10000, SR * 0.45)) / SR);
    this.pa1 = 1 / (1 + g * (g + 1)); this.pa2 = g * this.pa1; this.pa3 = g * this.pa2;
    this.p1 = 0; this.p2 = 0;
    this.gl = panL(pan); this.gr = panR(pan);
  }
  render(L, R, from, to) {
    const d = this.deck, pres = this.pres;
    const k = this.k, a1 = this.a1, a2 = this.a2, a3 = this.a3, pa1 = this.pa1, pa2 = this.pa2, pa3 = this.pa3;
    const pk = this.peak, at = this.a, h = this.h, c = this.c;
    let t = this.t, e = this.e, s1 = this.s1, s2 = this.s2, p1 = this.p1, p2 = this.p2;
    for (let i = from; i < to; i++) {
      if (t < at) e = (pk * t) / at; else if (t < h) e = pk; else e *= c;
      const x = d.noise();
      const v3 = x - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
      s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
      let y = x - k * v1 - v2;
      if (pres) {
        const w3 = y - p2, w1 = pa1 * p1 + pa2 * w3, w2 = p2 + pa2 * p1 + pa3 * w3;
        p1 = 2 * w1 - p1; p2 = 2 * w2 - p2;
        y += w1;
      }
      y *= e;
      L[i] += y * this.gl; R[i] += y * this.gr;
      t++;
    }
    this.t = t; this.e = e; this.s1 = s1; this.s2 = s2; this.p1 = p1; this.p2 = p2;
  }
}

/** Sine or triangle with an optional pitch drop and band-pass: rim shot, congas */
class Tone extends Voice {
  set(start, peak, attack, tau, len, f0, f1, glide, tri, bpf, bpq, pan) {
    this.begin(start, len);
    this.peak = peak; this.a = Math.max(1, attack * SR); this.c = Math.exp(-1 / (tau * SR)); this.e = 0;
    this.f = f0; this.ng = Math.max(1, Math.round(glide * SR)); this.r = Math.pow(f1 / f0, 1 / this.ng);
    this.tri = tri; this.ph = 0;
    this.bp = bpf > 0;
    svfSet(this, bpf > 0 ? bpf : 1000, bpq > 0 ? bpq : 1);
    this.s1 = 0; this.s2 = 0;
    this.gl = panL(pan); this.gr = panR(pan);
  }
  render(L, R, from, to) {
    let t = this.t, e = this.e, f = this.f, ph = this.ph, s1 = this.s1, s2 = this.s2;
    const inv = 1 / SR, bp = this.bp, tri = this.tri, k = this.k, a1 = this.a1, a2 = this.a2, a3 = this.a3;
    for (let i = from; i < to; i++) {
      if (t < this.a) e = (this.peak * t) / this.a; else e *= this.c;
      if (t < this.ng) f *= this.r;
      ph += f * inv; if (ph >= 1) ph -= 1;
      let x = tri ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : sin2pi(ph);
      if (bp) {
        const v3 = x - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
        s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
        x = k * v1;
      }
      x *= e;
      L[i] += x * this.gl; R[i] += x * this.gr;
      t++;
    }
    this.t = t; this.e = e; this.f = f; this.ph = ph; this.s1 = s1; this.s2 = s2;
  }
}

/** Saw or square plus a sine sub through a resonant low-pass with a cutoff envelope */
class Bass extends Voice {
  set(start, note, dur, level, cutoff, resDb, envAmt, square) {
    this.begin(start, dur + 0.2);
    this.dur = Math.round(dur * SR);
    this.inc = midiHz(note) / SR; this.ph = 0; this.sph = 0; this.sq = square;
    this.peak = 0.12 * level; this.e = 0; this.a = 0.004 * SR; this.h = Math.round(0.02 * SR);
    this.cd = Math.exp(-1 / (0.08 * SR)); this.cr = Math.exp(-1 / (0.025 * SR));
    this.cut = cutoff * envAmt; this.cutT = cutoff; this.cutC = Math.exp(-16 / (0.06 * SR)); this.cutD = Math.round(0.005 * SR);
    this.q = Math.pow(10, resDb / 20);
    svfSet(this, this.cut, this.q);
    this.s1 = 0; this.s2 = 0;
  }
  render(L, R, from, to) {
    const inc = this.inc, sq = this.sq, pk = this.peak, sus = 0.7 * this.peak;
    let t = this.t, e = this.e, ph = this.ph, sph = this.sph, s1 = this.s1, s2 = this.s2;
    for (let i = from; i < to; i++) {
      if ((t & 15) === 0 && t > this.cutD) {
        this.cut = this.cutT + (this.cut - this.cutT) * this.cutC;
        svfSet(this, this.cut, this.q);
      }
      if (t < this.a) e = (pk * t) / this.a;
      else if (t < this.h) e = pk;
      else if (t < this.dur) e = sus + (e - sus) * this.cd;
      else e *= this.cr;
      ph += inc; if (ph >= 1) ph -= 1;
      let o;
      if (sq) {
        let q2 = ph + 0.5; if (q2 >= 1) q2 -= 1;
        o = (ph < 0.5 ? 1 : -1) + blep(ph, inc) - blep(q2, inc);
      } else o = 2 * ph - 1 - blep(ph, inc);
      sph += inc; if (sph >= 1) sph -= 1;
      const x = o + 0.9 * sin2pi(sph);
      const v3 = x - s2, v1 = this.a1 * s1 + this.a2 * v3, v2 = s2 + this.a2 * s1 + this.a3 * v3;
      s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
      const y = v2 * e;
      L[i] += y; R[i] += y;
      t++;
    }
    this.t = t; this.e = e; this.ph = ph; this.sph = sph; this.s1 = s1; this.s2 = s2;
  }
}

/** Detuned saws (and triangles) spread in stereo through a low-pass: chord stabs and pads */
class Chord extends Voice {
  constructor(deck) {
    super(deck);
    this.ph = new Float64Array(8); this.inc = new Float64Array(8);
    this.ol = new Float64Array(8); this.or = new Float64Array(8); this.tri = new Uint8Array(8);
    this.n = 0;
  }
  osc(j, note, cents, pan, tri) {
    this.inc[j] = (midiHz(note) * Math.pow(2, cents / 1200)) / SR;
    this.ph[j] = Math.random();
    this.ol[j] = panL(pan); this.or[j] = panR(pan); this.tri[j] = tri;
  }
  setStab(start, notes, level) {
    this.begin(start, 0.6);
    this.pad = false; this.n = 0;
    for (let i = 0; i < notes.length; i++) {
      for (let k = 0; k < 2; k++) this.osc(this.n++, notes[i], k ? 7 : -7, (k ? 0.4 : -0.4) * (i % 2 ? 1 : -1) * 0.7, 0);
    }
    this.peak = 0.05 * level; this.e = 0; this.a = 0.003 * SR; this.c = Math.exp(-1 / (0.08 * SR));
    this.cut = 3800; this.cutT = 900; this.cutC = Math.exp(-16 / (0.08 * SR)); this.cutD = Math.round(0.01 * SR);
    this.q = Math.pow(10, 2 / 20);
    svfSet(this, this.cut, this.q);
    this.l1 = 0; this.l2 = 0; this.r1 = 0; this.r2 = 0;
  }
  setPad(start, notes, dur, level) {
    this.begin(start, dur + 0.6);
    this.pad = true; this.n = 0;
    for (let i = 0; i < notes.length; i++) {
      for (let k = 0; k < 2; k++) this.osc(this.n++, notes[i], k ? -9 : 9, (i % 2 ? 1 : -1) * (k ? 0.6 : 0.3), k);
    }
    const d = dur * SR;
    this.peak = 0.038 * level; this.e = 0;
    this.up = Math.max(1, Math.round(d * 0.35)); this.hold = Math.round(d * 0.85); this.down = Math.round(d + 0.45 * SR);
    this.cut = 1500; this.cutT = 1500; this.cutC = 1; this.cutD = 1e12;
    this.q = Math.pow(10, 0.8 / 20);
    svfSet(this, this.cut, this.q);
    this.l1 = 0; this.l2 = 0; this.r1 = 0; this.r2 = 0;
  }
  render(L, R, from, to) {
    const n = this.n, ph = this.ph, inc = this.inc, ol = this.ol, or = this.or, tri = this.tri, pad = this.pad;
    let t = this.t, e = this.e, l1 = this.l1, l2 = this.l2, r1 = this.r1, r2 = this.r2;
    for (let i = from; i < to; i++) {
      if ((t & 15) === 0 && t > this.cutD) {
        this.cut = this.cutT + (this.cut - this.cutT) * this.cutC;
        svfSet(this, this.cut, this.q);
      }
      if (pad) {
        if (t < this.up) e = (this.peak * t) / this.up;
        else if (t < this.hold) e = this.peak;
        else if (t < this.down) e = (this.peak * (this.down - t)) / (this.down - this.hold);
        else e = 0;
      } else if (t < this.a) e = (this.peak * t) / this.a;
      else e *= this.c;
      let xl = 0, xr = 0;
      for (let j = 0; j < n; j++) {
        let p = ph[j] + inc[j]; if (p >= 1) p -= 1; ph[j] = p;
        const o = tri[j] ? (p < 0.5 ? 4 * p - 1 : 3 - 4 * p) : 2 * p - 1 - blep(p, inc[j]);
        xl += o * ol[j]; xr += o * or[j];
      }
      const a1 = this.a1, a2 = this.a2, a3 = this.a3;
      let v3 = xl - l2, v1 = a1 * l1 + a2 * v3, v2 = l2 + a2 * l1 + a3 * v3;
      l1 = 2 * v1 - l1; l2 = 2 * v2 - l2;
      L[i] += v2 * e;
      v3 = xr - r2; v1 = a1 * r1 + a2 * v3; v2 = r2 + a2 * r1 + a3 * v3;
      r1 = 2 * v1 - r1; r2 = 2 * v2 - r2;
      R[i] += v2 * e;
      t++;
    }
    this.t = t; this.e = e; this.l1 = l1; this.l2 = l2; this.r1 = r1; this.r2 = r2;
  }
}

/** A sung "aah": saw with vibrato through three vowel formants */
const FORMANTS = [[750, 7, 1], [1200, 9, 0.6], [2600, 12, 0.25]];
class Lead extends Voice {
  constructor(deck) {
    super(deck);
    this.fa1 = new Float64Array(3); this.fa2 = new Float64Array(3); this.fa3 = new Float64Array(3);
    this.fg = new Float64Array(3); this.fs1 = new Float64Array(3); this.fs2 = new Float64Array(3);
    for (let j = 0; j < 3; j++) {
      const g = Math.tan((Math.PI * FORMANTS[j][0]) / SR), k = 1 / FORMANTS[j][1];
      this.fa1[j] = 1 / (1 + g * (g + k)); this.fa2[j] = g * this.fa1[j]; this.fa3[j] = g * this.fa2[j];
      this.fg[j] = FORMANTS[j][2] * k; // band-pass normalised to unity at the formant
    }
  }
  set(start, note, dur, level) {
    this.begin(start, dur + 0.4);
    this.dur = Math.round(dur * SR);
    this.f0 = midiHz(note); this.inc = this.f0 / SR; this.ph = 0; this.vph = 0;
    this.vRamp = Math.max(1, Math.round(Math.min(0.35, dur) * SR));
    this.peak = 0.2 * level; this.e = 0; this.a = 0.04 * SR;
    this.cr = Math.exp(-1 / (0.06 * SR));
    this.fs1.fill(0); this.fs2.fill(0);
    this.gl = panL(0.1); this.gr = panR(0.1);
  }
  render(L, R, from, to) {
    let t = this.t, e = this.e, ph = this.ph, inc = this.inc, vph = this.vph;
    const fs1 = this.fs1, fs2 = this.fs2, fa1 = this.fa1, fa2 = this.fa2, fa3 = this.fa3, fg = this.fg;
    for (let i = from; i < to; i++) {
      if ((t & 15) === 0) {
        vph += (16 * 5.2) / SR; if (vph >= 1) vph -= 1;
        const depth = 12 * Math.min(1, t / this.vRamp);
        inc = (this.f0 * Math.pow(2, (depth * sin2pi(vph)) / 1200)) / SR;
      }
      if (t < this.a) e = (this.peak * t) / this.a; else if (t < this.dur) e = this.peak; else e *= this.cr;
      ph += inc; if (ph >= 1) ph -= 1;
      const x = 2 * ph - 1 - blep(ph, inc);
      let y = 0;
      for (let j = 0; j < 3; j++) {
        const s1 = fs1[j], s2 = fs2[j];
        const v3 = x - s2, v1 = fa1[j] * s1 + fa2[j] * v3, v2 = s2 + fa2[j] * s1 + fa3[j] * v3;
        fs1[j] = 2 * v1 - s1; fs2[j] = 2 * v2 - s2;
        y += fg[j] * v1;
      }
      y *= e;
      L[i] += y * this.gl; R[i] += y * this.gr;
      t++;
    }
    this.t = t; this.e = e; this.ph = ph; this.inc = inc; this.vph = vph;
  }
}

const MAX_VOICES = 40;
const scratchL = new Float32Array(BLOCK);
const scratchR = new Float32Array(BLOCK);

class Deck {
  constructor(seed) {
    this.src = S_NONE;
    this.voices = [];
    this.n = ((seed * 2654435761) >>> 0) || 1;
    this.pools = new Map();
    this.L = new Float32Array(BLOCK);
    this.R = new Float32Array(BLOCK);
  }
  noise() {
    let n = this.n;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.n = n >>> 0;
    return (n | 0) * 4.656612873077393e-10;
  }
  get(Cls) {
    let pool = this.pools.get(Cls);
    if (!pool) { pool = []; this.pools.set(Cls, pool); }
    if (this.voices.length >= MAX_VOICES) this.free(0);
    const v = pool.pop() || new Cls(this);
    this.voices.push(v);
    return v;
  }
  free(i) {
    const v = this.voices[i];
    this.voices.splice(i, 1);
    this.pools.get(v.constructor).push(v);
  }
  releaseAll() { for (const v of this.voices) v.release(); }
  clear() { while (this.voices.length) this.free(this.voices.length - 1); }

  // --- voices (start times in absolute frames) -------------------------------
  kick(f, level = 1) { this.get(Kick).set(f, level); }
  clap(f, level = 1) { this.get(Clap).set(f, level); }
  hat(f, open = false, level = 1, pan = 0.15) {
    this.get(Hiss).set(f, (open ? 0.07 : 0.06) * level, 0.001, 0.001, (open ? 0.28 : 0.045) / 4, open ? 0.5 : 0.12, open ? 6500 : 8000, true, pan);
  }
  shaker(f, level = 1) { this.get(Hiss).set(f, 0.035 * level, 0.012, 0.02, 0.02, 0.12, 5000, false, 0.35); }
  crash(f, level = 1) { this.get(Hiss).set(f, 0.05 * level, 0.002, 0.002, 0.4, 2.2, 4500, false, 0); }
  rim(f, level = 1) { this.get(Tone).set(f, 0.22 * level, 0.0005, 0.0075, 0.1, 1700, 1700, 0, true, 1800, 3, -0.2); }
  conga(f, hz, level = 1, pan = -0.3) { this.get(Tone).set(f, 0.14 * level, 0.001, 0.045, 0.4, hz * 1.5, hz, 0.03, false, 0, 0, pan); }
  bass(f, note, dur, o) {
    this.get(Bass).set(f, note, dur, o.level ?? 1, o.cutoff ?? 380, o.res ?? 4, o.envAmt ?? 3, !!o.square);
  }
  stab(f, notes, level = 1) { this.get(Chord).setStab(f, notes, level); }
  pad(f, notes, dur, level = 1) { this.get(Chord).setPad(f, notes, dur, level); }
  lead(f, note, dur, level = 1) { this.get(Lead).set(f, note, dur, level); }

  /** One 16th-note step `n` (16ths since the start) of the current source, at frame `f` */
  step(f, n, d16) {
    const step = n % 16, bar = Math.floor(n / 16), arrBar = bar % ARR, chordIdx = bar % 4;
    const chord = CHORDS[chordIdx], root = ROOTS[chordIdx];
    const beat = step % 4 === 0;
    const phraseStart = step === 0 && arrBar % 8 === 0;
    switch (this.src) {
      case S_TRACK_A: {
        // Deep house: 4/4 kick, off-beat open hat, rolling bass, dub stabs from bar 17
        if (beat && arrBar < 30) this.kick(f);
        if (phraseStart) this.crash(f);
        if (step % 4 === 2) this.hat(f, true, arrBar >= 4 ? 1 : 0.6);
        if (arrBar >= 8 && step % 2 === 1) this.hat(f, false, 0.45, -0.15);
        if (arrBar >= 8 && (step === 4 || step === 12)) this.clap(f, 0.8);
        if (arrBar >= 8 && arrBar < 30) {
          const p = BASS_A[step];
          if (p) this.bass(f, root + p[0], d16 * p[1], { cutoff: 420, envAmt: 2.5 });
        }
        if (arrBar >= 16 && (step === 3 || step === 10) && bar % 2 === 0) this.stab(f, chord, 0.9);
        break;
      }
      case S_TRACK_B: {
        // Tech groove: 4/4 kick, 16th hats, rim, an acid square bass on an A pedal
        if (beat && arrBar < 30) this.kick(f, 1.05);
        if (phraseStart) this.crash(f, 0.9);
        if (step === 3 || step === 11 || step === 14) this.rim(f, 0.8);
        if (arrBar >= 4) this.hat(f, false, step % 4 === 2 ? 1 : 0.4, 0.2);
        if (arrBar >= 16 && (step === 4 || step === 12)) this.clap(f, 0.9);
        if (arrBar >= 8 && arrBar < 30) {
          const p = BASS_B[step];
          if (p !== undefined) this.bass(f, 33 + p, d16 * 0.8, { cutoff: 300 + (150 * (arrBar % 8)) / 8, res: 9, envAmt: 5, square: true, level: 0.75 });
        }
        break;
      }
      case S_DRUMS: this.drums(f, step, 1); break;
      case S_BASS: this.bassline(f, step, root, d16, 1.2); break;
      case S_STABS: this.stabs(f, step, chord, 1.6); break;
      case S_PERC: this.perc(f, step, 1); break;
      case S_PAD: if (step === 0) this.pad(f, chord, d16 * 16, 1.7); break;
      case S_LEAD: {
        const pos = n % 64;
        for (let i = 0; i < LEAD.length; i++) if (LEAD[i][0] === pos) this.lead(f, LEAD[i][1], d16 * LEAD[i][2] * 0.95, 0.9);
        break;
      }
      case S_FULL:
        // The whole band from bar 1: drums, bass, stabs, percussion and a quiet pad
        this.drums(f, step, 1);
        this.bassline(f, step, root, d16, 1.2);
        this.stabs(f, step, chord, 0.9);
        this.perc(f, step, 0.6);
        if (step === 0) this.pad(f, chord, d16 * 16, 0.6);
        break;
    }
  }

  drums(f, step, lv) {
    if (step % 4 === 0) this.kick(f, lv);
    if (step === 4 || step === 12) this.clap(f, lv);
    if (step % 4 === 2) this.hat(f, true, lv);
    else if (step % 2 === 1) this.hat(f, false, 0.5 * lv);
  }
  bassline(f, step, root, d16, lv) {
    const p = BASS_A[step];
    if (p) this.bass(f, root + p[0], d16 * p[1], { cutoff: 420, envAmt: 2.5, level: lv });
  }
  stabs(f, step, chord, lv) {
    if (step === 3 || step === 10) this.stab(f, chord, lv);
  }
  perc(f, step, lv) {
    this.shaker(f, (step % 4 === 2 ? 1.6 : 0.9) * lv);
    if (step === 6 || step === 14) this.rim(f, 0.8 * lv);
    if (step === 3) this.conga(f, 220, 1.2 * lv, -0.3);
    if (step === 9 || step === 11) this.conga(f, 330, lv, 0.3);
  }

  /** Render the block that starts at frame f0 into this.L / this.R; false if silent */
  render(f0) {
    const L = this.L, R = this.R;
    if (!this.voices.length) return false;
    L.fill(0); R.fill(0);
    let any = false;
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const v = this.voices[i];
      const from = v.start - f0;
      if (from >= BLOCK) continue;
      const a = from > 0 ? from : 0;
      const endIn = v.end - f0;
      const b = endIn < BLOCK ? endIn : BLOCK;
      if (b > a) {
        if (v.kill) {
          scratchL.fill(0, a, b); scratchR.fill(0, a, b);
          v.render(scratchL, scratchR, a, b);
          let g = v.killG;
          const dg = 1 / KILL_SAMPLES;
          for (let j = a; j < b; j++) { L[j] += scratchL[j] * g; R[j] += scratchR[j] * g; g = g > dg ? g - dg : 0; }
          v.killG = g;
          if (g <= 0) { this.free(i); any = true; continue; }
        } else v.render(L, R, a, b);
        any = true;
      }
      if (endIn <= BLOCK) this.free(i);
    }
    return any;
  }
}

// ============================================================================
// Channel strips
// ============================================================================

// Parameter slots: the engine posts all of them for a channel in one message
const P_DECK = 0, P_STUDIO = 1, P_FILE = 2, P_RTN = 3, P_TRIM = 4, P_LO = 5, P_HI = 6, P_MIDA = 7, P_MIDB = 8, P_MIDF = 9;
const P_FADER = 10, P_XF = 11, P_DIRECT = 12, P_F1 = 13, P_F2 = 14, P_S1PRE = 15, P_S1POST = 16, P_S2 = 17, P_CUE = 18, P_CUEPOST = 19;
const NP = 20;

// Strip kinds: stereo channel 1-4 (4-band EQ), aux A/B (3-band, swept MID), RTN C/D (level only)
const K_MAIN = 0, K_AUX = 1, K_RTN = 2;

// EQ coefficient slots (5 each)
const C_LP1 = 0, C_LP2 = 5, C_HP1 = 10, C_HP2 = 15, C_HP3 = 20, C_HP4 = 25, C_LP3 = 30, C_LP4 = 35, C_AP = 40, C_PKA = 45, C_PKB = 50;
const NC = 55;

function fixedCoefs(c) {
  const Q = Math.SQRT1_2;
  // LR4 split at 180 Hz and 3 kHz; the low band gets the 3 kHz all-pass so all bands sum flat
  bqLowpass(c, C_LP1, 180, Q); bqLowpass(c, C_LP2, 180, Q);
  bqHighpass(c, C_HP1, 180, Q); bqHighpass(c, C_HP2, 180, Q);
  bqHighpass(c, C_HP3, 3000, Q); bqHighpass(c, C_HP4, 3000, Q);
  bqLowpass(c, C_LP3, 3000, Q); bqLowpass(c, C_LP4, 3000, Q);
  bqAllpass(c, C_AP, 3000, Q);
  bqPeak(c, C_PKA, 350, 0.9, 0); bqPeak(c, C_PKB, 1100, 0.9, 0);
}

class Strip {
  constructor(kind, map, seed) {
    this.kind = kind;
    this.inS = map.studio ?? -1; this.inF = map.file ?? -1; this.inR = map.rtn ?? -1;
    this.tgt = new Float64Array(NP);
    this.cur = new Float64Array(NP);
    this.prev = new Float64Array(NP);
    for (const p of [P_TRIM, P_LO, P_HI, P_FADER, P_XF, P_DIRECT]) this.tgt[p] = this.cur[p] = 1;
    this.tgt[P_MIDF] = this.cur[P_MIDF] = 700;
    this.tgt[P_CUEPOST] = this.cur[P_CUEPOST] = 1;
    this.coef = new Float64Array(NC);
    fixedCoefs(this.coef);
    this.midA = 0; this.midB = 0; this.midF = 350;
    this.z = new Float64Array(44); // 11 sections x 2 states x 2 sides
    this.tail = 0;
    this.meter = 0; this.pk = 0;
    this.deck = kind === K_RTN ? null : new Deck(seed);
    this.xL = new Float32Array(BLOCK); this.xR = new Float32Array(BLOCK);
    this.yL = new Float32Array(BLOCK); this.yR = new Float32Array(BLOCK);
    this.lo = new Float32Array(BLOCK); this.mid = new Float32Array(BLOCK); this.hi = new Float32Array(BLOCK);
  }

  /** Glide every target one block (frequency in the log domain) */
  glide() {
    const t = this.tgt, c = this.cur;
    this.prev.set(c);
    for (let i = 0; i < NP; i++) {
      if (t[i] === c[i]) continue;
      if (i === P_MIDF) {
        c[i] *= Math.pow(t[i] / c[i], GLIDE);
        if (Math.abs(t[i] - c[i]) < 0.5) c[i] = t[i];
      } else {
        c[i] += (t[i] - c[i]) * GLIDE;
        if (Math.abs(t[i] - c[i]) < (i === P_MIDA || i === P_MIDB ? 0.01 : 1e-5)) c[i] = t[i];
      }
    }
    // Mid-band coefficients follow the glided gains / frequency
    const cf = this.coef;
    if (this.kind === K_MAIN) {
      if (c[P_MIDA] !== this.midA) { this.midA = c[P_MIDA]; bqPeak(cf, C_PKA, 350, 0.9, this.midA); }
      if (c[P_MIDB] !== this.midB) { this.midB = c[P_MIDB]; bqPeak(cf, C_PKB, 1100, 0.9, this.midB); }
    } else if (this.kind === K_AUX && (c[P_MIDA] !== this.midA || c[P_MIDF] !== this.midF)) {
      this.midA = c[P_MIDA]; this.midF = c[P_MIDF];
      bqPeak(cf, C_PKA, this.midF, 1.0, this.midA);
    }
  }

  /** EQ one side: x -> y (side 0 = L, 1 = R) */
  eq(x, y, side) {
    const c = this.coef, z = this.z, zb = side * 22, p = this.prev, q = this.cur;
    const lo = this.lo, mid = this.mid, hi = this.hi;
    lo.set(x); mid.set(x);
    bqRun(lo, c, C_LP1, z, zb); bqRun(lo, c, C_LP2, z, zb + 2); bqRun(lo, c, C_AP, z, zb + 4);
    bqRun(mid, c, C_HP1, z, zb + 6); bqRun(mid, c, C_HP2, z, zb + 8);
    hi.set(mid);
    bqRun(hi, c, C_HP3, z, zb + 10); bqRun(hi, c, C_HP4, z, zb + 12);
    bqRun(mid, c, C_LP3, z, zb + 14); bqRun(mid, c, C_LP4, z, zb + 16);
    bqRun(mid, c, C_PKA, z, zb + 18);
    if (this.kind === K_MAIN) bqRun(mid, c, C_PKB, z, zb + 20);
    const dl = (q[P_LO] - p[P_LO]) / BLOCK, dh = (q[P_HI] - p[P_HI]) / BLOCK;
    let gl = p[P_LO], gh = p[P_HI];
    for (let i = 0; i < BLOCK; i++) {
      y[i] = lo[i] * gl + mid[i] + hi[i] * gh;
      gl += dl; gh += dh;
    }
  }
}

class XoneStripsProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    const kinds = o.kinds || [K_MAIN];
    const maps = o.inputs || [];
    this.strips = kinds.map((k, i) => new Strip(k, maps[i] || {}, (o.seed || 1) * 31 + i * 7 + 1));
    this.steps = [];
    this.blocks = 0;
    this.meterMsg = new Array(this.strips.length * 2).fill(0);
    this.port.onmessage = e => this.onMessage(e.data);
  }

  onMessage(m) {
    if (!m) return;
    switch (m.t) {
      case 'ch': {
        const s = this.strips[m.c];
        if (s) for (let i = 0; i < NP && i < m.v.length; i++) if (Number.isFinite(m.v[i])) s.tgt[i] = m.v[i];
        break;
      }
      case 'src': {
        const s = this.strips[m.c];
        if (s && s.deck && s.deck.src !== m.v) { s.deck.src = m.v; s.deck.releaseAll(); }
        break;
      }
      case 'step':
        this.steps.push(m);
        break;
      case 'stop':
        this.steps.length = 0;
        for (const s of this.strips) if (s.deck) s.deck.releaseAll();
        break;
    }
  }

  process(inputs, outputs) {
    const f0 = currentFrame, fEnd = f0 + BLOCK;

    // Deck steps due in this block (late ones start at once)
    if (this.steps.length) {
      let w = 0;
      for (let k = 0; k < this.steps.length; k++) {
        const st = this.steps[k];
        if (st.f >= fEnd) { this.steps[w++] = st; continue; }
        const f = st.f < f0 ? f0 : st.f;
        for (const s of this.strips) {
          if (!s.deck || s.deck.src === S_NONE) continue;
          if (s.tgt[P_DECK] <= 0 && s.cur[P_DECK] < 1e-4) continue;
          s.deck.step(f, st.n, st.d);
        }
      }
      this.steps.length = w;
    }

    for (let o = 0; o < outputs.length; o++) for (let ch = 0; ch < outputs[o].length; ch++) outputs[o][ch].fill(0);
    const oD = outputs[0], oF1 = outputs[1], oF2 = outputs[2], oS1 = outputs[3], oS2 = outputs[4], oC = outputs[5];

    for (let si = 0; si < this.strips.length; si++) {
      const s = this.strips[si];
      s.glide();
      const c0 = s.prev, c1 = s.cur;
      const xL = s.xL, xR = s.xR;
      xL.fill(0); xR.fill(0);
      let live = false;

      // --- source select x GAIN -------------------------------------------
      if (s.deck && s.deck.voices.length) {
        const g0 = c0[P_DECK] * c0[P_TRIM], g1 = c1[P_DECK] * c1[P_TRIM];
        if (s.deck.render(f0) && (g0 !== 0 || g1 !== 0)) {
          addRamp(xL, s.deck.L, g0, g1); addRamp(xR, s.deck.R, g0, g1);
          live = true;
        }
        if (s.tgt[P_DECK] <= 0 && s.cur[P_DECK] < 1e-4) s.deck.clear();
      }
      if (s.inS >= 0 && addInput(xL, xR, inputs[s.inS], c0[P_STUDIO] * c0[P_TRIM], c1[P_STUDIO] * c1[P_TRIM])) live = true;
      if (s.inF >= 0 && addInput(xL, xR, inputs[s.inF], c0[P_FILE] * c0[P_TRIM], c1[P_FILE] * c1[P_TRIM])) live = true;
      if (s.inR >= 0 && addInput(xL, xR, inputs[s.inR], c0[P_RTN] * c0[P_TRIM], c1[P_RTN] * c1[P_TRIM])) live = true;

      if (live) s.tail = TAIL_BLOCKS;
      else if (s.tail > 0) s.tail--;
      else {
        // Asleep: nothing in, filter tails done
        s.meter *= METER_REL;
        if (s.meter < 1e-7) s.meter = 0;
        if (s.pk > 0) s.pk--;
        continue;
      }
      if (!live && s.tail === 0) s.z.fill(0);

      // --- EQ, +20 dBu soft clip, post-EQ pre-fader meter ------------------
      let yL = s.yL, yR = s.yR;
      if (s.kind === K_RTN) { yL = xL; yR = xR; }
      else { s.eq(xL, yL, 0); s.eq(xR, yR, 1); }
      let peak = 0;
      for (let i = 0; i < BLOCK; i++) {
        let l = yL[i], r = yR[i];
        if (l > 0.8 || l < -0.8) yL[i] = l = clip(l, 1);
        if (r > 0.8 || r < -0.8) yR[i] = r = clip(r, 1);
        if (l < 0) l = -l;
        if (r < 0) r = -r;
        if (l > peak) peak = l;
        if (r > peak) peak = r;
      }
      s.meter = peak > s.meter ? peak : s.meter * METER_REL;
      if (s.meter < 1e-7) s.meter = 0;
      if (peak >= PK_LIN) s.pk = PK_HOLD; else if (s.pk > 0) s.pk--;

      // --- fader, crossfader VCA, FILTER assign, sends, CUE -----------------
      const fx0 = c0[P_FADER] * c0[P_XF], fx1 = c1[P_FADER] * c1[P_XF];
      route(oD, yL, yR, fx0 * c0[P_DIRECT], fx1 * c1[P_DIRECT]);
      route(oF1, yL, yR, fx0 * c0[P_F1], fx1 * c1[P_F1]);
      route(oF2, yL, yR, fx0 * c0[P_F2], fx1 * c1[P_F2]);
      route(oS1, yL, yR, c0[P_S1PRE] + c0[P_FADER] * c0[P_S1POST], c1[P_S1PRE] + c1[P_FADER] * c1[P_S1POST]);
      route(oS2, yL, yR, c0[P_FADER] * c0[P_S2], c1[P_FADER] * c1[P_S2]);
      route(oC, yL, yR, c0[P_CUE] * c0[P_CUEPOST], c1[P_CUE] * c1[P_CUEPOST]);
      route(oC, xL, xR, c0[P_CUE] * (1 - c0[P_CUEPOST]), c1[P_CUE] * (1 - c1[P_CUEPOST]));
    }

    if (++this.blocks % METER_EVERY === 0) {
      const mm = this.meterMsg;
      for (let i = 0; i < this.strips.length; i++) { mm[2 * i] = this.strips[i].meter; mm[2 * i + 1] = this.strips[i].pk > 0 ? 1 : 0; }
      this.port.postMessage({ t: 'm', v: mm });
    }
    return true;
  }
}

// ============================================================================
// Master section
// ============================================================================

const M_MASTER = 0, M_BOOTH = 1, M_MONO = 2, M_MUTE = 3, M_BLO = 4, M_BMID = 5, M_BHI = 6, M_PHONES = 7, M_CUEMIX = 8;
const M_SPLIT = 9, M_MONITOR = 10, M_F1 = 11, M_F2 = 12, M_OUT = 13, M_CUEON = 14;
const NM = 15;
const BOOTH_CLIP = 0.1 * Math.pow(10, 18 / 20);

class XoneMasterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tgt = new Float64Array(NM);
    this.cur = new Float64Array(NM);
    this.prev = new Float64Array(NM);
    for (const i of [M_MASTER, M_BOOTH, M_PHONES]) this.tgt[i] = this.cur[i] = 1;
    this.tgt[M_OUT] = this.cur[M_OUT] = 1.25;
    this.bq = new Float64Array(15);
    this.bz = new Float64Array(12);
    this.beq = [NaN, NaN, NaN];
    this.mL = new Float32Array(BLOCK); this.mR = new Float32Array(BLOCK);
    this.bL = new Float32Array(BLOCK); this.bR = new Float32Array(BLOCK);
    this.meters = new Float64Array(4); // mix L, mix R, cue L, cue R
    this.pk = new Int32Array(4);
    this.peaks = new Float64Array(4);
    this.meterMsg = new Array(8).fill(0);
    this.blocks = 0;
    this.port.onmessage = e => {
      const m = e.data;
      if (m && m.t === 'p') for (let i = 0; i < NM && i < m.v.length; i++) if (Number.isFinite(m.v[i])) this.tgt[i] = m.v[i];
    };
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const oL = out[0], oR = out[1] || out[0];
    const t = this.tgt, c = this.cur, c0 = this.prev;
    c0.set(c);
    for (let i = 0; i < NM; i++) {
      if (t[i] === c[i]) continue;
      if (i === M_MONITOR || i === M_SPLIT || i === M_MONO) { c[i] = t[i]; continue; }
      c[i] += (t[i] - c[i]) * GLIDE;
      if (Math.abs(t[i] - c[i]) < 1e-5) c[i] = t[i];
    }

    // LR MIX: direct channels + both filter returns
    const mL = this.mL, mR = this.mR;
    mL.fill(0); mR.fill(0);
    addInput(mL, mR, inputs[0], 1, 1);
    addInput(mL, mR, inputs[1], c0[M_F1], c[M_F1]);
    addInput(mL, mR, inputs[2], c0[M_F2], c[M_F2]);
    const cue = inputs[3];
    const cL = cue && cue.length ? cue[0] : null, cR = cue && cue.length ? cue[1] || cue[0] : null;

    // Summing amplifier (+21 dBu) and the pre-MASTER meters
    const pk = this.peaks;
    pk[0] = pk[1] = pk[2] = pk[3] = 0;
    for (let i = 0; i < BLOCK; i++) {
      let l = mL[i], r = mR[i];
      if (l > 0.89 || l < -0.89) mL[i] = l = clip(l, 1.122);
      if (r > 0.89 || r < -0.89) mR[i] = r = clip(r, 1.122);
      if (l < 0) l = -l;
      if (r < 0) r = -r;
      if (l > pk[0]) pk[0] = l;
      if (r > pk[1]) pk[1] = r;
    }
    if (cL) {
      for (let i = 0; i < BLOCK; i++) {
        const a = cL[i] < 0 ? -cL[i] : cL[i], b = cR[i] < 0 ? -cR[i] : cR[i];
        if (a > pk[2]) pk[2] = a;
        if (b > pk[3]) pk[3] = b;
      }
    }
    for (let k = 0; k < 4; k++) {
      this.meters[k] = pk[k] > this.meters[k] ? pk[k] : this.meters[k] * METER_REL;
      if (this.meters[k] < 1e-7) this.meters[k] = 0;
      if (pk[k] >= PK_LIN) this.pk[k] = PK_HOLD; else if (this.pk[k] > 0) this.pk[k]--;
    }

    const mon = Math.round(c[M_MONITOR]);
    if (mon === 1) {
      // BOOTH: 3-band EQ (+/-8 dB), MONO, MUTE, level, +18 dBu output stage
      const bq = this.bq;
      if (c[M_BLO] !== this.beq[0]) { this.beq[0] = c[M_BLO]; bqShelf(bq, 0, 100, c[M_BLO], false); }
      if (c[M_BMID] !== this.beq[1]) { this.beq[1] = c[M_BMID]; bqPeak(bq, 5, 1000, 0.8, c[M_BMID]); }
      if (c[M_BHI] !== this.beq[2]) { this.beq[2] = c[M_BHI]; bqShelf(bq, 10, 10000, c[M_BHI], true); }
      const bL = this.bL, bR = this.bR;
      bL.set(mL); bR.set(mR);
      for (let k = 0; k < 3; k++) { bqRun(bL, bq, 5 * k, this.bz, 2 * k); bqRun(bR, bq, 5 * k, this.bz, 6 + 2 * k); }
      const mono = c[M_MONO] > 0.5;
      const g0 = c0[M_BOOTH] * (1 - c0[M_MUTE]), g1 = c[M_BOOTH] * (1 - c[M_MUTE]);
      const dg = (g1 - g0) / BLOCK, o0 = c0[M_OUT], dO = (c[M_OUT] - o0) / BLOCK;
      let g = g0, og = o0;
      for (let i = 0; i < BLOCK; i++) {
        let l = bL[i], r = bR[i];
        if (mono) { l = r = 0.5 * (l + r); }
        oL[i] = clip(l * g, BOOTH_CLIP) * og;
        oR[i] = clip(r * g, BOOTH_CLIP) * og;
        g += dg; og += dO;
      }
    } else if (mon === 2) {
      // MONITOR headphones: CUE/MST blend, or SPLIT CUE (cue left, LR MIX right)
      const split = c[M_SPLIT] > 0.5;
      const g0 = c0[M_PHONES] * c0[M_OUT], g1 = c[M_PHONES] * c[M_OUT];
      const a0 = Math.cos(c0[M_CUEMIX] * HALF_PI), a1 = Math.cos(c[M_CUEMIX] * HALF_PI);
      const b0 = Math.sin(c0[M_CUEMIX] * HALF_PI), b1 = Math.sin(c[M_CUEMIX] * HALF_PI);
      const dg = (g1 - g0) / BLOCK, da = (a1 - a0) / BLOCK, db = (b1 - b0) / BLOCK;
      // Nothing cued: the headphones hear the master mix (w glides 0 -> 1 when a CUE goes on)
      const w0 = c0[M_CUEON], dw = (c[M_CUEON] - w0) / BLOCK;
      let g = g0, ga = a0, gb = b0, w = w0;
      for (let i = 0; i < BLOCK; i++) {
        const ql = cL ? cL[i] : 0, qr = cR ? cR[i] : 0;
        let l, r;
        if (split) { l = 0.5 * (ql + qr); r = 0.5 * (mL[i] + mR[i]); }
        else { l = ql * ga + mL[i] * gb; r = qr * ga + mR[i] * gb; }
        l = w * l + (1 - w) * mL[i];
        r = w * r + (1 - w) * mR[i];
        oL[i] = l * g; oR[i] = r * g;
        g += dg; ga += da; gb += db; w += dw;
      }
    } else {
      // MASTER 1, +24 dBu output stage
      const m0 = c0[M_MASTER], dm = (c[M_MASTER] - m0) / BLOCK, o0 = c0[M_OUT], dO = (c[M_OUT] - o0) / BLOCK;
      let m = m0, og = o0;
      for (let i = 0; i < BLOCK; i++) {
        let l = mL[i] * m, r = mR[i] * m;
        if (l > 1.26 || l < -1.26) l = clip(l, 1.585);
        if (r > 1.26 || r < -1.26) r = clip(r, 1.585);
        oL[i] = l * og; oR[i] = r * og;
        m += dm; og += dO;
      }
    }

    if (++this.blocks % METER_EVERY === 0) {
      const mm = this.meterMsg, v = this.meters, p = this.pk;
      for (let k = 0; k < 4; k++) { mm[k] = v[k]; mm[4 + k] = p[k] > 0 ? 1 : 0; }
      this.port.postMessage({ t: 'm', v: mm });
    }
    return true;
  }
}

registerProcessor('xone96-strips', XoneStripsProcessor);
registerProcessor('xone96-master', XoneMasterProcessor);
