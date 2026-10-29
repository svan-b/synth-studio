/* eslint-disable */
// ============================================================================
// Moog Sub 37 / Subsequent 37 - device processors (see devices/sub37/REFERENCE.md;
// page numbers below are the Subsequent 37 manual's)
//
// The audio path uses the shared DSP core: two band-limited 'vco' nodes (OSC 1
// with its sub-octave tap), the 2x oversampled 'ladder', plus native gains and a
// WaveShaper for MULTIDRIVE. These two processors add what the core cannot do
// as separate nodes:
//
//  'sub37-ctl'  every control signal of the instrument, sample-accurately, in
//               one node: both DAHDSR envelopes (RESET, LOOP, LATCH, SYNC
//               retriggers, KB TRACK, VEL AMT, linear or exponential attack,
//               GATE SRC), both LFOs (TRI SQR SAW RAMP S&H, the sine / noise
//               PGM sources, KB RESET, KB TRACK, the cross rate modulation),
//               glide (LCR / LCT / EXP, GATED, per oscillator), MOD 1 / MOD 2
//               with their CONTROLLERS depth (mod wheel, velocity), the WAVE
//               morph weights, BEAT FREQ and every smoothed knob. No AudioParams
//               (each costs CPU every quantum): settings arrive as messages and
//               notes as timed events, applied at their exact sample. Nothing is
//               allocated per quantum.
//               Input: external CV, 4 channels (PITCH, FILTER, VOLUME, KB GATE; 1.0 = 5 V).
//               Output, 19 channels:
//                 0 osc1 pitch (oct)   1 osc2 pitch (oct)   2 cutoff CV (oct)
//                 3 VCA gain           4-6 osc1 tri/saw/pulse gains   7 osc1 pw - 0.02
//                 8-10 osc2 gains      11 osc2 pw - 0.02    12 sub gain
//                 13 noise gain        14 ladder resonance  15 MULTIDRIVE pre-gain
//                 16 FDBK / EXT gain   17 KB RESET pulse (-2 then +2 for one sample each)
//                 18 osc2 linear FM in Hz (BEAT FREQ)
//
//  'sub37-mix'  the mixer bus: DC blocker, the FDBK / EXT IN channel (the mixer
//               output fed back into its own input through an AC-coupled,
//               band-limited path - or the EXT IN audio while a cable is
//               patched) and the mixer amp's soft, slightly asymmetric limit.
//               A real one-sample feedback loop, which a Web Audio graph cannot
//               build (cycles need a 128-sample DelayNode).
//               Inputs: 0 summed sources, 1 FDBK/EXT gain (ctl ch 16), 2 EXT IN audio.
// ============================================================================

const TWO_PI = Math.PI * 2;
const LN3 = Math.log(3);

// ---------------------------------------------------------------------------
// Fast math
// ---------------------------------------------------------------------------
const POW2 = new Float64Array(129);
for (let i = 0; i <= 128; i++) POW2[i] = Math.pow(2, i - 64);
const ROUND_MAGIC = 6755399441055744.0;
/** 2^x, |x| <= 60, relative error ~1e-7 */
function exp2(x) {
  if (x > 60) x = 60; else if (x < -60) x = -60;
  const k = (x + ROUND_MAGIC) - ROUND_MAGIC;
  const f = x - k;
  return (1.0000000754953540 + f * (0.69314720671060703 + f * (0.24022107355813041 + f * (0.055503272142182529 +
    f * (0.0096760370985559188 + f * 0.0013400432164069483))))) * POW2[(k + 64) | 0];
}
/** sin(2 pi p), error 7e-9 */
function sin2pi(p) {
  let u = p - Math.floor(p + 0.5);
  if (u > 0.25) u = 0.5 - u; else if (u < -0.25) u = -0.5 - u;
  const u2 = u * u;
  return u * (6.2831852802603860 + u2 * (-41.341680667564709 + u2 * (81.602480704356452 + u2 * (-76.581283596342473 + u2 * 39.760714499738548))));
}
/** tanh via [7/6] Pade (max error 1e-4), monotonic, |y| <= 1 */
function tanhF(x) {
  if (x > 4.97) return 1;
  if (x < -4.97) return -1;
  const x2 = x * x;
  return x * (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
/** Flush tiny values to zero (denormal guard) */
const flush = v => (v > 1e-20 || v < -1e-20 ? v : 0);

// ---------------------------------------------------------------------------
// Calibrations - devices/sub37/model.ts and REFERENCE.md document the same numbers
// ---------------------------------------------------------------------------
const NCH = 19;
const RES_SELF = 0.985;      // ladder resonance where the 2x core starts to self-oscillate: dial 7.0 (p.28)
const RES_TOP = 1.16;        // dial 10
const EG_AMT_OCT = 6 / 5;    // FILTER EG AMT: octaves per dial unit (+-5 -> +-6 oct)
const PITCH_MOD_OCT = 2;     // PITCH AMT +-5 -> +-2 octaves, squared taper
const LFO_RATE_MOD_OCT = 4;  // MOD AMT -> the other LFO's RATE
const EG_TIME_MOD_OCT = 3;   // MOD AMT -> envelope (and glide) times; positive lengthens (p.24)
const MD_MAX_PRE = 40;       // MULTIDRIVE pre-gain at 10
const FB_MAX = 1.25;         // FDBK loop gain at 10 (unstable near the top: "sometimes chaotic", p.27)
const SQUARE_LEVEL = 0.85;   // square / pulse / sub peak against the saw

/** Mixer law: unity at 5 on the dial, (level / 5)^1.5 (+9 dB at 10); above 5 overdrives (p.27) */
function mixGain(d) { return d <= 0 ? 0 : Math.pow(d * 0.2, 1.5); }

/** RESONANCE dial 0-10 -> ladder resonance; the filter self-oscillates above 7 (p.28) */
function resOf(d) {
  if (d <= 0) return 0;
  if (d <= 7) return RES_SELF * (d / 7);
  return RES_SELF + (RES_TOP - RES_SELF) * Math.min(1, (d - 7) / 3);
}

// smoothed settings, by index
const SM = ['tune', 'freq2', 'bend', 'wave1', 'wave2', 'l1', 'ls', 'l2', 'ln', 'lf', 'cutoffOct', 'res', 'md',
  'egAmt', 'kbTrack', 'wheel', 'pa0', 'pa1', 'fa0', 'fa1', 'ma0', 'ma1', 'beat'];
const S_TUNE = 0, S_FREQ2 = 1, S_BEND = 2, S_WAVE1 = 3, S_WAVE2 = 4, S_L1 = 5, S_LS = 6, S_L2 = 7, S_LN = 8, S_LF = 9;
const S_CUT = 10, S_RES = 11, S_MD = 12, S_EGAMT = 13, S_KBT = 14, S_WHEEL = 15, S_PA0 = 16, S_PA1 = 17;
const S_FA0 = 18, S_FA1 = 19, S_MA0 = 20, S_MA1 = 21, S_BEAT = 22, NSM = 23;

// envelope stages
const IDLE = 0, DELAY = 1, ATTACK = 2, HOLD = 3, DECAY = 4, SUSTAIN = 5, RELEASE = 6;
// MOD DEST (p.23) and PGM DST (p.51) indices, as in model.ts
const D_LFO = 0, D_VCA = 1, D_W1 = 2, D_W12 = 3, D_W2 = 4, D_NOISE = 5, D_PGM = 6;
const P_EGTIME = 0, P_RES = 1, P_DRV = 2, P_EGAMT = 3, P_KBAMT = 4, P_L1 = 5, P_LS = 6, P_L2 = 7, P_LF = 8;
// P_ARP = 9 (ARP RATE) is applied by the engine's clock on the main thread
const P_GLIDE = 10, P_FREQ2 = 11, P_BEAT = 12, P_FATK = 13, P_FDCY = 14, P_FSUS = 15, P_FREL = 16;
const P_AATK = 17, P_ADCY = 18, P_ASUS = 19, P_AREL = 20, P_VOL = 21;
// GATE SRC (PRESET EDIT 1.3 / 1.4, p.41)
const GS_BOTH = 0, GS_NOTES = 1, GS_EXT = 2;

class Sub37Ctl extends AudioWorkletProcessor {
  constructor() {
    super();
    this.s = {
      // pitch: octaves (tune, footage), semitones (freq2), Hz (beat), bend -1..1 (wheel), ranges in semitones,
      // bendDest 0 NONE / 1 OSC1 / 2 OSC2 / 3 BOTH
      tune: 0, foot1: 0, foot2: 0, freq2: 0, drone: 0, beat: 0, bendUp: 2, bendDn: 2, bend: 0, bendDest: 3,
      // oscillators / mixer: WAVE 0..1, levels on the 0-10 dial, on switches, EXT patched
      wave1: 0.33, wave2: 0.33, l1: 5, ls: 0, l2: 0, ln: 0, lf: 0, on1: 1, ons: 1, on2: 1, onn: 1, onf: 1, ext: 0,
      // filter: Hz, dials, KB TRACK ratio 0..2
      cutoff: 1500, res: 0, md: 0, egAmt: 2, kbTrack: 1,
      // envelopes: f = filter, a = amp; seconds, sustain 0..1, VEL AMT 0..1, KB TRACK 0..2, switches 0/1,
      // gate source 0 BOTH / 1 NOTES / 2 EXT
      fa: 0.001, fd: 0.4, fs: 0.3, fr: 0.3, fdl: 0, fh: 0, fvel: 0, fkb: 0, floop: 0, flatch: 0, fexp: 0, frst: 0, fgs: 0,
      aa: 0.001, ad: 0.3, as: 0.8, ar: 0.2, adl: 0, ah: 0, avel: 0, akb: 0, aloop: 0, alatch: 0, aexp: 0, arst: 0, ags: 0,
      // glide: seconds, type 0 LCR / 1 LCT / 2 EXP
      gOn: 0, gTime: 0.05, gType: 0, gGated: 0,
      // LFO / mod bus N (0 = MOD 1): rate Hz (HI RANGE and SYNC applied by the engine), SOURCE 0-5, KB RESET,
      // LFO KBTRACK 0..2, PITCH AMT / FILTER AMT / MOD AMT dials, pitch dest 0 both / 1 osc 1 / 2 osc 2,
      // DEST 0-6, CONTROLLERS wheel / velocity amounts -1..1, PGM SRC 0-12, PGM DST 0-21
      r0: 5, r1: 1, src0: 0, src1: 0, kr0: 0, kr1: 0, lk0: 0, lk1: 0,
      pa0: 0, pa1: 0, pd0: 0, pd1: 0, fa0: 0, fa1: 0, de0: 1, de1: 1, ma0: 0, ma1: 0,
      wh0: 1, wh1: 0, ve0: 0, ve1: 0, ps0: 0, ps1: 0, pg0: 0, pg1: 0,
      wheel: 0, volPatched: 0, gIgn: 0,
    };
    this.smv = new Float64Array(NSM);   // smoothed value at the end of the last quantum
    this.sm0 = new Float64Array(NSM);   // value at the start of this quantum
    this.smd = new Float64Array(NSM);   // per-sample increment within this quantum
    this.tgt = new Float64Array(NSM);
    this.readTargets();
    this.smv.set(this.tgt);
    this.q = [];
    // pitch / glide (octaves relative to C4)
    this.cur = new Float64Array(2);
    this.dst = new Float64Array(2);
    this.gStep = new Float64Array(2);
    this.gMode = new Int8Array(2);       // 0 none, 1 linear (LCR / LCT), 2 exponential
    this.glideTimeMul = 1;
    this.keyGate = 0;                    // keys / arpeggiator / sequencer gate
    this.extGate = 0;                    // KB GATE jack
    this.extId = 0;                      // newest KB GATE event id
    this.vel = 1;
    this.kbNote = 48;                    // last key (KB TRACK, LFO KBTRACK, envelope KB TRACK)
    this.seqNote = 0;
    this.seqVel = 1;
    this.seqMod = 0;
    this.pressure = 0;
    // envelopes
    this.st = new Int8Array(2); this.ev = new Float64Array(2); this.peak = new Float64Array([1, 1]);
    this.en = new Float64Array(2); this.dstep = new Float64Array([-1, -1]); this.envGate = new Int8Array(2);
    // per-quantum envelope coefficients
    this.cA = new Float64Array(2); this.cAexp = new Float64Array(2); this.cD = new Float64Array(2); this.cR = new Float64Array(2);
    this.cDl = new Float64Array(2); this.cHd = new Float64Array(2); this.cSus = new Float64Array(2);
    // per-quantum PGM modulation of single stages: [atk, dcy, rel] x 2 envelopes (octaves), sustain offsets
    this.stageMod = new Float64Array(6); this.susMod = new Float64Array(2);
    // LFOs
    this.ph = new Float64Array(2); this.sh = new Float64Array(2); this.na = new Float64Array(2); this.nb = new Float64Array(2);
    this.wrap = new Int8Array(2); this.rs = new Uint32Array([0x9e3779b9, 0x85ebca6b]);
    this.lfoOut = new Float64Array(2);
    this.modOut = new Float64Array(2);   // last bus outputs (source x depth) for per-quantum destinations
    this.resetPulse = 0;
    this.cvGateLast = 0;
    this.mw = new Float64Array(4);
    this.port.onmessage = e => this.onMessage(e.data);
  }

  readTargets() {
    const s = this.s, t = this.tgt;
    for (let k = 0; k < NSM; k++) t[k] = s[SM[k]];
    t[S_CUT] = Math.log2(Math.max(1, s.cutoff) / 1000);
  }

  onMessage(m) {
    if (!m) return;
    if (m.t === 'set') {
      const s = this.s;
      for (const k in m.s) {
        const v = m.s[k];
        if (typeof v === 'number' && v === v) s[k] = v;
      }
      this.readTargets();
      return;
    }
    if (m.t === 'clear') { this.q.length = 0; return; }
    if (typeof m.time !== 'number' || !(m.time === m.time)) m.time = 0;
    const q = this.q;
    let i = q.length;
    while (i > 0 && q[i - 1].time > m.time) i--;
    q.splice(i, 0, m);
  }

  rnd(l) {
    let x = this.rs[l];
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    this.rs[l] = x;
    return (x / 4294967296) * 2 - 1;
  }

  /** Gate source of envelope e: 0 BOTH, 1 NOTES, 2 EXT */
  gs(e) { return e === 0 ? this.s.fgs : this.s.ags; }
  latched(e) { return e === 0 ? this.s.flatch : this.s.alatch; }
  /** The envelope's gate from all its sources (p.41: GATE SRC) plus LATCH */
  gateOf(e) {
    const g = this.gs(e);
    return this.latched(e) || (g !== GS_EXT && this.keyGate) || (g !== GS_NOTES && this.extGate) ? 1 : 0;
  }

  /** Fire envelope i: the attack starts from zero with RESET, else from the current level (p.31) */
  fire(i, reset, peak) {
    if (reset) this.ev[i] = 0;
    this.peak[i] = peak;
    this.st[i] = this.cDl[i] > 0 ? DELAY : ATTACK;
    this.en[i] = 0;
    this.dstep[i] = -1;
  }

  release(i) { if (this.st[i] !== IDLE) this.st[i] = RELEASE; }

  /** Keys, arpeggiator or sequencer gate on: tf / ta say which envelopes (re)start */
  keyOn(m) {
    const s = this.s;
    this.keyGate = 1;
    if (typeof m.vel === 'number') this.vel = m.vel;
    if (typeof m.kb === 'number') this.kbNote = m.kb;
    if (s.fgs !== GS_EXT) { if (m.tf) this.fire(0, !!m.rf, 1 - s.fvel + s.fvel * this.vel); this.envGate[0] = 1; }
    if (s.ags !== GS_EXT) { if (m.ta) this.fire(1, !!m.ra, 1 - s.avel + s.avel * this.vel); this.envGate[1] = 1; }
    // LFO KB RESET (p.23): restart on every new note (STEP 1 RESET may limit it to the first step, p.40)
    if ((m.tf || m.ta) && m.lr !== 0) {
      if (s.kr0) { this.ph[0] = 0; this.wrap[0] = 1; }
      if (s.kr1) { this.ph[1] = 0; this.wrap[1] = 1; }
    }
  }

  keyOff() {
    this.keyGate = 0;
    for (let e = 0; e < 2; e++) if (this.envGate[e] && !this.gateOf(e)) { this.envGate[e] = 0; this.release(e); }
  }

  /** KB GATE jack (p.8): +5 V triggers the envelopes whose GATE SRC is BOTH or EXT */
  extOn() {
    const s = this.s;
    this.extGate = 1;
    if (s.fgs !== GS_NOTES) { this.fire(0, !!s.frst, 1); this.envGate[0] = 1; }
    if (s.ags !== GS_NOTES) { this.fire(1, !!s.arst, 1); this.envGate[1] = 1; }
  }

  extOff() {
    this.extGate = 0;
    for (let e = 0; e < 2; e++) if (this.envGate[e] && !this.gateOf(e)) { this.envGate[e] = 0; this.release(e); }
  }

  handle(m) {
    const s = this.s;
    switch (m.t) {
      case 'pitch': {
        for (let o = 0; o < 2; o++) {
          const n = o === 0 ? m.n1 : m.n2;
          if (typeof n !== 'number') continue;
          const glide = (o === 0 ? m.g1 : m.g2) && s.gOn && s.gTime > 0.0005;
          this.dst[o] = n;
          if (!glide) { this.cur[o] = n; this.gMode[o] = 0; continue; }
          const T = s.gTime * this.glideTimeMul;
          if (s.gType === 2) {
            this.gMode[o] = 2;
            this.gStep[o] = 1 - Math.exp(-3 / Math.max(1, T * sampleRate)); // 95 % of the way in TIME
          } else {
            this.gMode[o] = 1;
            const dist = Math.abs(n - this.cur[o]);
            // LCR: TIME per octave, so bigger intervals take longer; LCT: TIME for any interval (p.21)
            const dur = s.gType === 0 ? T * Math.max(0.05, dist) : T;
            this.gStep[o] = dist / Math.max(1, dur * sampleRate);
          }
        }
        if (typeof m.kb === 'number') this.kbNote = m.kb;
        break;
      }
      case 'gate':
        if (m.src === 'x') {
          // a newer trigger's gate is never closed by an older one's timed gate-off
          if (m.on) { this.extId = m.id | 0; this.extOn(); }
          else if (typeof m.id !== 'number' || m.id >= this.extId) this.extOff();
        }
        else if (m.on) this.keyOn(m); else this.keyOff();
        break;
      case 'latch': {
        // LATCH lit: hold the envelope at SUSTAIN as if the gate were on; unlit with no gate: release (p.31)
        const i = m.env;
        if (m.on) { if (!this.envGate[i]) { this.envGate[i] = 1; this.fire(i, false, 1); } }
        else if (this.envGate[i] && !this.gateOf(i)) { this.envGate[i] = 0; this.release(i); }
        break;
      }
      case 'trig': {
        // envelope SYNC: restart on a clock division while the gate is high (p.31)
        const i = m.env;
        if (this.envGate[i]) this.fire(i, !!m.rst, this.peak[i]);
        break;
      }
      case 'lfo': this.ph[m.i] = typeof m.ph === 'number' ? m.ph : 0; this.wrap[m.i] = 1; break;
      case 'kbr': this.resetPulse = 2; break;
      case 'sn':
        this.seqNote = m.v;
        if (typeof m.vel === 'number') this.seqVel = m.vel;
        break;
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < NCH) return true;
    const n = out[0].length;
    const sr = sampleRate;
    const s = this.s;
    const t0 = currentTime;

    // ---- smoothing: one pole per quantum (tau 6 ms), linear within it -----------------
    const smv = this.smv, sm0 = this.sm0, smd = this.smd, tgt = this.tgt;
    const a = 1 - Math.exp(-n / (0.006 * sr));
    const inv = 1 / n;
    for (let k = 0; k < NSM; k++) {
      const v0 = smv[k];
      const v1 = v0 + (tgt[k] - v0) * a;
      sm0[k] = v0; smv[k] = v1; smd[k] = (v1 - v0) * inv;
    }

    // ---- external CV ----------------------------------------------------------------------
    const cv = inputs[0];
    const cvP = cv && cv.length > 0 ? cv[0] : null, cvF = cv && cv.length > 1 ? cv[1] : null;
    const cvV = cv && cv.length > 2 ? cv[2] : null, cvG = cv && cv.length > 3 && !s.gIgn ? cv[3] : null;

    // ---- per-quantum modulation (times and levels) from the last quantum's bus outputs ------
    const de0 = s.de0, de1 = s.de1, pg0 = s.pg0, pg1 = s.pg1;
    const modOut = this.modOut, stageMod = this.stageMod, susMod = this.susMod;
    let egTimeMod = 0, glideMod = 0;
    for (let k = 0; k < 6; k++) stageMod[k] = 0;
    susMod[0] = 0; susMod[1] = 0;
    for (let b = 0; b < 2; b++) {
      if ((b === 0 ? de0 : de1) !== D_PGM) continue;
      const am = modOut[b] * smv[b === 0 ? S_MA0 : S_MA1] / 5;
      switch (b === 0 ? pg0 : pg1) {
        case P_EGTIME: egTimeMod += am; break;
        case P_GLIDE: glideMod += am; break;
        case P_FATK: stageMod[0] += am; break;
        case P_FDCY: stageMod[1] += am; break;
        case P_FREL: stageMod[2] += am; break;
        case P_AATK: stageMod[3] += am; break;
        case P_ADCY: stageMod[4] += am; break;
        case P_AREL: stageMod[5] += am; break;
        case P_FSUS: susMod[0] += am; break;
        case P_ASUS: susMod[1] += am; break;
        default: break;
      }
    }
    this.glideTimeMul = exp2(EG_TIME_MOD_OCT * glideMod);
    const kbOct = (this.kbNote - 48) / 12;
    for (let i = 0; i < 2; i++) {
      const f = i === 0;
      // EG TIME scales every stage alike (p.24); KB TRACK shortens DECAY and RELEASE up the keyboard (p.32)
      const tScale = exp2(EG_TIME_MOD_OCT * egTimeMod);
      const kScale = exp2(-(f ? s.fkb : s.akb) * kbOct);
      const o = i * 3;
      const A = Math.max(1, (f ? s.fa : s.aa) * tScale * exp2(EG_TIME_MOD_OCT * stageMod[o]) * sr);
      const D = Math.max(1, (f ? s.fd : s.ad) * tScale * kScale * exp2(EG_TIME_MOD_OCT * stageMod[o + 1]) * sr);
      const R = Math.max(1, (f ? s.fr : s.ar) * tScale * kScale * exp2(EG_TIME_MOD_OCT * stageMod[o + 2]) * sr);
      this.cA[i] = A;
      this.cAexp[i] = (f ? s.fexp : s.aexp) ? Math.exp(-LN3 / A) : 0;
      this.cD[i] = Math.exp(-6.9 / D);
      this.cR[i] = Math.exp(-6.9 / R);
      // the AMP EG's DELAY only works with LOOP on (p.33)
      this.cDl[i] = (f ? s.fdl : (s.aloop ? s.adl : 0)) * tScale * sr;
      this.cHd[i] = (f ? s.fh : s.ah) * tScale * sr;
      this.cSus[i] = clamp((f ? s.fs : s.as) + susMod[i], 0, 1);
    }
    const loopF = s.floop, loopA = s.aloop;
    // CONTROLLERS depth (p.50): each amount is the depth reached at full wheel / full velocity;
    // with every amount OFF the bus runs at full depth (MOD 2's default)
    const vel = this.vel;
    const wheel = smv[S_WHEEL];
    const d0 = s.wh0 === 0 && s.ve0 === 0 ? 1 : clamp(s.wh0 * wheel + s.ve0 * vel, -1, 1);
    const d1 = s.wh1 === 0 && s.ve1 === 0 ? 1 : clamp(s.wh1 * wheel + s.ve1 * vel, -1, 1);
    // LFO KBTRACK (p.52): faster up the keyboard
    const inc0 = (s.r0 / sr) * (s.lk0 ? exp2(s.lk0 * kbOct) : 1);
    const inc1 = (s.r1 / sr) * (s.lk1 ? exp2(s.lk1 * kbOct) : 1);
    const cross0 = de1 === D_LFO && smv[S_MA1] !== 0;   // MOD 2 DEST "LFO RATE" moves LFO 1 (p.24)
    const cross1 = de0 === D_LFO && smv[S_MA0] !== 0;   // MOD 1 DEST "LFO RATE" moves LFO 2
    const src0 = s.src0, src1 = s.src1, ps0 = s.ps0, ps1 = s.ps1, pd0 = s.pd0, pd1 = s.pd1;
    const bendUp = s.bendUp / 12, bendDn = s.bendDn / 12;
    const bd = s.bendDest, bend1 = bd === 1 || bd === 3, bend2 = bd === 2 || bd === 3;
    const foot1 = s.foot1, foot2 = s.foot2, drone = s.drone;
    const on1 = s.on1, on2 = s.on2, ons = s.ons, onn = s.onn, onf = s.onf, ext = s.ext;
    const gating = !s.gGated || this.keyGate;
    const volPatched = s.volPatched;

    const o0 = out[0], o1 = out[1], o2 = out[2], o3 = out[3];
    const oT1 = out[4], oS1 = out[5], oP1 = out[6], oW1 = out[7];
    const oT2 = out[8], oS2 = out[9], oP2 = out[10], oW2 = out[11];
    const oSub = out[12], oNoise = out[13], oRes = out[14], oMd = out[15], oFb = out[16], oKbr = out[17], oFm2 = out[18];
    const mw = this.mw;
    const cur = this.cur, dst = this.dst, gStep = this.gStep, gMode = this.gMode;
    const st = this.st, ev = this.ev, peak = this.peak, en = this.en, dstep = this.dstep, envGate = this.envGate;
    const cA = this.cA, cAexp = this.cAexp, cD = this.cD, cR = this.cR, cDl = this.cDl, cHd = this.cHd, cSus = this.cSus;
    const ph = this.ph, wrap = this.wrap, sh = this.sh, na = this.na, nb = this.nb, lfoOut = this.lfoOut;
    const kbSrc = clamp((this.kbNote - 48) / 24, -1.5, 1.5);

    const q = this.q;
    let nextT = q.length ? q[0].time : Infinity;

    for (let i = 0; i < n; i++) {
      if (t0 + i / sr >= nextT) {
        const now = t0 + i / sr;
        while (q.length && q[0].time <= now) this.handle(q.shift());
        nextT = q.length ? q[0].time : Infinity;
      }
      const fi = i + 1;

      // ---- KB GATE CV input (edge detected; ignored while the jack is driven by gate events) ----
      if (cvG) {
        const g = cvG[i];
        if (g >= 0.2 && this.cvGateLast < 0.2) this.extOn();
        else if (g < 0.2 && this.cvGateLast >= 0.2) this.extOff();
        this.cvGateLast = g;
      }

      // ---- glide ----------------------------------------------------------------------------
      if (gating) {
        for (let o = 0; o < 2; o++) {
          const mode = gMode[o];
          if (!mode) continue;
          const c = cur[o], t = dst[o];
          if (mode === 2) {
            const nc = c + (t - c) * gStep[o];
            if (Math.abs(t - nc) < 1e-6) { cur[o] = t; gMode[o] = 0; } else cur[o] = nc;
          } else if (c < t) { const nc = c + gStep[o]; if (nc >= t) { cur[o] = t; gMode[o] = 0; } else cur[o] = nc; }
          else { const nc = c - gStep[o]; if (nc <= t) { cur[o] = t; gMode[o] = 0; } else cur[o] = nc; }
        }
      }

      // ---- envelopes ------------------------------------------------------------------------
      for (let e = 0; e < 2; e++) {
        let v = ev[e];
        const sg = st[e];
        if (sg === IDLE) continue;
        if (sg === DELAY) {
          if (++en[e] >= cDl[e]) { st[e] = ATTACK; en[e] = 0; }
          else continue;
        }
        const loop = e === 0 ? loopF : loopA;
        switch (st[e]) {
          case ATTACK: {
            const pk = peak[e];
            if (v > pk) {
              if (dstep[e] < 0) dstep[e] = (v - pk) / cA[e];
              v -= dstep[e];
              if (v <= pk) { v = pk; st[e] = cHd[e] > 0 ? HOLD : DECAY; en[e] = 0; }
            } else {
              if (cAexp[e] > 0) { const T = pk * 1.5; v = T + (v - T) * cAexp[e]; }
              else v += pk / cA[e];
              if (v >= pk) { v = pk; st[e] = cHd[e] > 0 ? HOLD : DECAY; en[e] = 0; }
            }
            break;
          }
          case HOLD:
            if (++en[e] >= cHd[e]) st[e] = DECAY;
            break;
          case DECAY: {
            const target = cSus[e] * peak[e];
            v = target + (v - target) * cD[e];
            // LOOP (p.31): delay, attack, hold, decay and release repeat while the gate is held
            if (Math.abs(v - target) < 1e-4) { v = target; st[e] = loop && envGate[e] ? RELEASE : SUSTAIN; }
            break;
          }
          case SUSTAIN:
            v = cSus[e] * peak[e];
            if (loop && envGate[e]) st[e] = RELEASE;
            break;
          case RELEASE:
            v *= cR[e];
            if (v < 1e-4) {
              v = 0;
              if (loop && envGate[e]) this.fire(e, false, peak[e]);
              else st[e] = IDLE;
            }
            break;
        }
        ev[e] = v;
      }
      const fEg = ev[0], aEg = ev[1];

      // ---- LFOs -------------------------------------------------------------------------------
      for (let l = 0; l < 2; l++) {
        let inc = l === 0 ? inc0 : inc1;
        if (l === 0 ? cross0 : cross1) {
          const k = l === 0 ? S_MA1 : S_MA0;
          inc *= exp2(LFO_RATE_MOD_OCT * modOut[1 - l] * (sm0[k] + smd[k] * fi) / 5);
        }
        let p = ph[l] + inc;
        if (p >= 1 || wrap[l]) {
          if (p >= 1) p -= Math.floor(p);
          wrap[l] = 0;
          sh[l] = this.rnd(l);
          na[l] = nb[l]; nb[l] = this.rnd(l);
        }
        ph[l] = p;
        let y;
        switch (l === 0 ? src0 : src1) {
          case 1: y = p < 0.5 ? 1 : -1; break;                    // SQR
          case 2: y = 1 - 2 * p; break;                            // SAW (falling)
          case 3: y = 2 * p - 1; break;                            // RAMP (rising, "reverse sawtooth", p.22)
          case 4: y = sh[l]; break;                                // S&H
          default: y = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4; // TRI, from zero (KB RESET)
        }
        lfoOut[l] = y;
      }

      // ---- MOD busses ---------------------------------------------------------------------------
      let pit1 = 0, pit2 = 0, filt = 0, vcaMul = 1;
      let dw1 = 0, dw2 = 0, dNoise = 0, dRes = 0, dMd = 0, dEgAmt = 0, dKbt = 0, dL1 = 0, dLs = 0, dL2 = 0, dLf = 0;
      let dFreq2 = 0, dBeat = 0;
      for (let b = 0; b < 2; b++) {
        let src;
        if ((b === 0 ? src0 : src1) < 5) src = lfoOut[b];
        else {
          // PGM SRC (p.50)
          switch (b === 0 ? ps0 : ps1) {
            case 1: src = aEg; break;                                                  // AMP EG
            case 2: src = 1; break;                                                    // CONST ON
            case 3: src = sin2pi(ph[b]); break;                                        // SINE LFO
            case 4: { const x = ph[b]; src = na[b] + (nb[b] - na[b]) * x * x * (3 - 2 * x); break; } // NOISE LFO
            case 5: src = clamp((cur[0] + foot1 + 1) * 0.5, -1.5, 1.5); break;         // OSC1 PCH (0 at C3)
            case 6: src = clamp(((drone ? 0 : cur[1]) + foot2 + 1) * 0.5, -1.5, 1.5); break; // OSC2 PCH
            case 7: src = this.seqNote; break;                                         // SEQ NOTE
            case 8: src = this.seqVel; break;                                          // SEQ VEL
            case 9: src = this.seqMod; break;                                          // SEQ MOD
            case 10: src = this.pressure; break;                                       // PRESSURE
            case 11: src = kbSrc; break;                                               // KB TRACK (bipolar, note 48)
            case 12: src = vel; break;                                                 // VELOCITY
            default: src = fEg;                                                        // FILTER EG
          }
        }
        const m = src * (b === 0 ? d0 : d1);
        modOut[b] = m;
        if (m === 0) continue;
        const kPa = b === 0 ? S_PA0 : S_PA1, kFa = b === 0 ? S_FA0 : S_FA1, kMa = b === 0 ? S_MA0 : S_MA1;
        const pa = sm0[kPa] + smd[kPa] * fi;
        if (pa !== 0) {
          const x = pa / 5;
          const p = m * x * (x < 0 ? -x : x) * PITCH_MOD_OCT;
          const pd = b === 0 ? pd0 : pd1;
          if (pd !== 2) pit1 += p;
          if (pd !== 1) pit2 += p;
        }
        const fa = sm0[kFa] + smd[kFa] * fi;
        if (fa !== 0) filt += m * fa;
        const ma = sm0[kMa] + smd[kMa] * fi;
        if (ma !== 0) {
          const am = m * ma / 5;
          switch (b === 0 ? de0 : de1) {
            case D_LFO: break;                                // the other LFO's RATE: applied above
            case D_VCA: vcaMul *= clamp(1 + am, 0, 2); break;
            case D_W1: dw1 += am; break;
            case D_W12: dw1 += am; dw2 += am; break;
            case D_W2: dw2 += am; break;
            case D_NOISE: dNoise += 10 * am; break;           // added to the mixer NOISE level (p.24)
            default:                                          // EG TIME / PGM destination
              switch (b === 0 ? pg0 : pg1) {
                case P_RES: dRes += 10 * am; break;
                case P_DRV: dMd += 10 * am; break;
                case P_EGAMT: dEgAmt += 5 * am; break;
                case P_KBAMT: dKbt += 2 * am; break;
                case P_L1: dL1 += 10 * am; break;
                case P_LS: dLs += 10 * am; break;
                case P_L2: dL2 += 10 * am; break;
                case P_LF: dLf += 10 * am; break;
                case P_FREQ2: dFreq2 += 7 * am; break;
                case P_BEAT: dBeat += 3.5 * am; break;
                case P_VOL: vcaMul *= clamp(1 + am, 0, 2); break;
                default: break;                               // times and sustain levels: per quantum
              }
          }
        }
      }

      // ---- outputs ----------------------------------------------------------------------------------
      const tune = sm0[S_TUNE] + smd[S_TUNE] * fi;
      const bw = sm0[S_BEND] + smd[S_BEND] * fi;
      const bend = bw >= 0 ? bw * bendUp : bw * bendDn;
      const cvPitch = cvP ? cvP[i] * 5 : 0;
      o0[i] = cur[0] + foot1 + tune + (bend1 ? bend : 0) + pit1 + cvPitch;
      o1[i] = (drone ? 0 : cur[1]) + foot2 + (sm0[S_FREQ2] + smd[S_FREQ2] * fi + dFreq2) / 12 + tune + (bend2 ? bend : 0) + pit2 + cvPitch;
      oFm2[i] = sm0[S_BEAT] + smd[S_BEAT] * fi + dBeat;
      const egAmt = sm0[S_EGAMT] + smd[S_EGAMT] * fi + dEgAmt;
      const kbt = clamp(sm0[S_KBT] + smd[S_KBT] * fi + dKbt, 0, 2);
      o2[i] = sm0[S_CUT] + smd[S_CUT] * fi + fEg * egAmt * EG_AMT_OCT + kbt * (cur[0] + 1) + filt + (cvF ? cvF[i] * 5 : 0);
      // VOLUME CV: 0-5 V sets the VCA ceiling while a cable is in (normalled to full)
      o3[i] = aEg * vcaMul * (volPatched && cvV ? clamp(cvV[i], 0, 1) : 1);
      morphTo(sm0[S_WAVE1] + smd[S_WAVE1] * fi + dw1, on1 ? mixGain(sm0[S_L1] + smd[S_L1] * fi + dL1) : 0, mw);
      oT1[i] = mw[0]; oS1[i] = mw[1]; oP1[i] = mw[2]; oW1[i] = mw[3];
      morphTo(sm0[S_WAVE2] + smd[S_WAVE2] * fi + dw2, on2 ? mixGain(sm0[S_L2] + smd[S_L2] * fi + dL2) : 0, mw);
      oT2[i] = mw[0]; oS2[i] = mw[1]; oP2[i] = mw[2]; oW2[i] = mw[3];
      oSub[i] = ons ? SQUARE_LEVEL * mixGain(sm0[S_LS] + smd[S_LS] * fi + dLs) : 0;
      oNoise[i] = onn ? mixGain(sm0[S_LN] + smd[S_LN] * fi + dNoise) : 0;
      oRes[i] = resOf(sm0[S_RES] + smd[S_RES] * fi + dRes);
      const md = clamp(sm0[S_MD] + smd[S_MD] * fi + dMd, 0, 10) * 0.1;
      oMd[i] = 1 + (MD_MAX_PRE - 1) * md * md;
      const lf = clamp(sm0[S_LF] + smd[S_LF] * fi + dLf, 0, 10) * 0.1;
      oFb[i] = onf ? (ext ? mixGain(lf * 10) : FB_MAX * Math.pow(lf, 1.3)) : 0;
      if (this.resetPulse > 0) { oKbr[i] = this.resetPulse === 2 ? -2 : 2; this.resetPulse--; }
      else oKbr[i] = 0;
    }

    // ---- guards (NaN on an input must never silence the instrument for good) -------------------
    for (let e = 0; e < 2; e++) {
      const v = ev[e];
      if (!(v === v)) { ev[e] = 0; st[e] = IDLE; }
      else if (v < 1e-20) ev[e] = 0;
    }
    for (let o = 0; o < 2; o++) if (!(cur[o] === cur[o])) { cur[o] = dst[o] === dst[o] ? dst[o] : 0; gMode[o] = 0; }
    for (let l = 0; l < 2; l++) if (!(ph[l] === ph[l])) ph[l] = 0;
    for (let b = 0; b < 2; b++) if (!(modOut[b] === modOut[b])) modOut[b] = 0;
    return true;
  }
}

/**
 * WAVE morph weights for w (0..1; modulation may push it past either end), scaled by the
 * mixer gain g: [tri, saw, pulse, pw - 0.02].
 * 0 - 1/3: triangle -> saw   1/3 - 2/3: saw -> square   2/3 - 1: the square narrows to a 10 % pulse.
 * The VCO's pulse is +1 then -1, so it is used inverted: its low half then lines up with the saw's
 * ramp and the crossfade loses even harmonics on the way to the square (p.25) instead of
 * cancelling the fundamental half way.
 */
function morphTo(w, g, out) {
  let tri = 0, saw = 0, pul = 0, pw = 0.5;
  if (w <= 0) tri = 1;
  else if (w < 0.33333333) { const x = w * 3; tri = 1 - x; saw = x; }
  else if (w < 0.66666667) { const x = (w - 0.33333333) * 3; saw = 1 - x; pul = x; }
  else {
    pul = 1;
    const c = (w - 0.66666667) * 3;
    pw = c <= 1 ? 0.5 + 0.4 * c : Math.min(0.98, 0.9 + 0.4 * (c - 1));
  }
  out[0] = tri * g;
  out[1] = saw * g;
  out[2] = -SQUARE_LEVEL * pul * g;
  out[3] = pw - 0.02;
}

// ============================================================================
// Mixer bus with FDBK / EXT IN
// ============================================================================

class Sub37Mix extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ext = 0;                     // 1 while a cable is in EXT IN
    this.y = 0;                       // last mixer output (the feedback source)
    this.hpx = 0; this.hpy = 0;       // DC blocker on the summed sources
    this.fhx = 0; this.fhy = 0;       // feedback path AC coupling
    this.flp = 0;                     // feedback path band limit
    this.port.onmessage = e => { const m = e.data; if (m && m.t === 'ext') this.ext = m.v ? 1 : 0; };
    const sr = sampleRate;
    this.cDc = Math.exp(-TWO_PI * 6 / sr);
    this.cHp = Math.exp(-TWO_PI * 25 / sr);
    this.cLp = 1 - Math.exp(-TWO_PI * 5000 / sr);
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
    const n = out.length;
    const src = inputs[0] && inputs[0][0];
    const gain = inputs[1] && inputs[1][0];
    const ext = inputs[2] && inputs[2][0];
    const cDc = this.cDc, cHp = this.cHp, cLp = this.cLp;
    let hpx = this.hpx, hpy = this.hpy, fhx = this.fhx, fhy = this.fhy, flp = this.flp, y = this.y;
    const useExt = this.ext;
    for (let i = 0; i < n; i++) {
      const x0 = src ? src[i] : 0;
      // DC blocker: narrow pulses carry DC, and the real mixer is AC coupled
      const hy = x0 - hpx + cDc * hpy; hpx = x0; hpy = hy;
      const g = gain ? gain[i] : 0;
      let fb;
      if (useExt) fb = (ext ? ext[i] : 0) * g;
      else {
        // FEEDBACK (p.27): the mixer output, AC coupled and band limited, back into its own input
        const ac = y - fhx + cHp * fhy; fhx = y; fhy = ac;
        flp += (ac - flp) * cLp;
        fb = flp * g;
      }
      // mixer amp: clean to about unity, then a soft limit near 3x with a little asymmetry
      const u = (hy + fb) * 0.3333;
      y = 3 * tanhF(u + 0.08 * u * u);
      out[i] = y;
    }
    if (!(y === y)) { y = 0; hpx = 0; hpy = 0; fhx = 0; fhy = 0; flp = 0; }
    this.hpx = flush(hpx); this.hpy = flush(hpy); this.fhx = flush(fhx); this.fhy = flush(fhy); this.flp = flush(flp); this.y = flush(y);
    return true;
  }
}

registerProcessor('sub37-ctl', Sub37Ctl);
registerProcessor('sub37-mix', Sub37Mix);
