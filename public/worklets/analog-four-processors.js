/* eslint-disable */
// ============================================================================
// Analog Four MKII AudioWorklet processors
//
//   'a4-voice'  one complete synth voice per node (4 nodes = the 4 tracks):
//                 OSC 1 + SUB 1, OSC 2 + SUB 2 (SAW, TRP transistor pulse, PUL,
//                 TRI; sub dividers 1OCT 2OCT 2PUL 5TH; sync 1>2 2>1 MTL with a
//                 variable amount; AM; per-oscillator PWM LFO; drift), NOISE
//                 (S&H, colour, fade) -> FILTER 1 4-pole ladder low-pass (tanh
//                 feedback, keytrack, ENV F depth, resonance boost) -> OVERDRIVE
//                 -> FILTER 2 2-pole multimode (LP2 LP1 BP HP1 HP2 BS PK) ->
//                 VCA (ENV A, velocity, accent) -> PAN -> VOL -> TRACK LEVEL.
//               Modulation: ENV F and ENV 2 (12 shapes, LEN gate), LFO 1/2 (7
//               waves, FREE TRIG HOLD ONE HALF, fade, start phase, tempo-synced
//               SPD x MUL), vibrato, 5 velocity routes; any continuous voice
//               parameter is a destination. LFO 2 and the envelopes run first,
//               so they can modulate LFO 1 (as on the hardware).
//               Outputs: [0] dry L/R, [1] sends (chorus, delay, reverb),
//               [2] mono multimode-filter output, before the VCA (the next track's NEI input).
//               Input [0]: the neighbour track's mono signal (OSC 2 WAV NEI).
//   'a4-fxmod'  the FX track's parameters: FX locks on the audio clock, the two
//               FX LFOs, and the value mapping. A pure source (no inputs) whose
//               channels drive the shared 'chorus' and 'fdn-reverb' nodes'
//               AudioParams and the 'a4-fx' node, so the graph has no cycles.
//   'a4-fx'     the delay (tempo-synced, ping-pong, filters and saturation in
//               the loop, tape-style time glide), the chorus -> delay / reverb
//               sends, the reverb send and the dry + return mix.
//
// Oscillator band-limiting uses the shared core's 4-point polyBLEP / polyBLAMP
// residuals (integrated cubic B-spline) and its 3-tap presence FIR, with the
// same work-buffer scheme (see synth-processors.js, docs/DSP.md): every wrap,
// pulse-width crossing, triangle corner, sync reset and sub-oscillator toggle
// is corrected at its sub-sample position. 3 samples of latency.
//
// Parameters stay in hardware units (0..127, -64..63...). Nodes receive their
// ordered key list at construction (processorOptions.keys) and are driven by
// port messages scheduled on the audio clock:
//   { t: 'p', list: [i, v, i, v...] }              set now
//   { t: 'at', time, list }                        set at audio time (p-locks)
//   { t: 'on', time, note, vel, acc, slide, live } gate on
//   { t: 'off', time }                             gate off
//   { t: 'ramp', time, t1, list: [i, from, to] }   parameter slide
//   { t: 'off2', list }                            performance-macro offsets
//   { t: 'bpm', v } / { t: 'step', v }             tempo (LFO sync) / step length (LEN)
//   { t: 'rtrg', time, rt }                        lock trig: restart ENV F / ENV 2 / LFO 1 / LFO 2 (bits 1 2 4 8)
//   { t: 'trig', time }                            FX LFO retrigger (FX track)
//   { t: 'cut' }                                   [STOP]: silence now (6 ms), drop everything queued
//   { t: 'reset' }                                 release everything (panic)
//   { t: 'feed', v }                               the next track uses this voice (OSC 2 WAV NEI): keep the
//                                                  oscillators and filters running while the VCA is closed
//   a4-fxmod: { t: 'fade', dur } / { t: 'unfade' } [STOP][STOP]: fade the send effects out / back in
// Control rate: every 16 samples (3 kHz); gains, cutoff coefficients and
// oscillator increments are interpolated per sample in between.
// ============================================================================

const BLOCK = 16;
const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Fast math (from the shared core)
// ---------------------------------------------------------------------------

const POW2 = new Float64Array(129);
for (let i = 0; i <= 128; i++) POW2[i] = Math.pow(2, i - 64);
const ROUND_MAGIC = 6755399441055744.0;
function exp2(x) {
  if (x > 60) x = 60; else if (x < -60) x = -60;
  const k = (x + ROUND_MAGIC) - ROUND_MAGIC;
  const f = x - k;
  return (1.0000000754953540 + f * (0.69314720671060703 + f * (0.24022107355813041 + f * (0.055503272142182529 +
    f * (0.0096760370985559188 + f * 0.0013400432164069483))))) * POW2[(k + 64) | 0];
}
function tanhF(x) {
  if (x > 4.97) return 1;
  if (x < -4.97) return -1;
  const x2 = x * x;
  return x * (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}
function tanF(x) {
  const x2 = x * x;
  return x * (945 + x2 * (-105 + x2)) / (945 + x2 * (-420 + x2 * 15));
}
function sin2pi(p) {
  let u = p - Math.floor(p + 0.5);
  if (u > 0.25) u = 0.5 - u; else if (u < -0.25) u = -0.5 - u;
  const u2 = u * u;
  return u * (6.2831852802603860 + u2 * (-41.341680667564709 + u2 * (81.602480704356452 + u2 * (-76.581283596342473 + u2 * 39.760714499738548))));
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const flush = x => (x > 1e-20 || x < -1e-20 ? x : 0);

// 4-point polyBLEP / polyBLAMP (shared core): d = time in samples since the
// discontinuity at the current sample (0..1), k = index of the current sample.
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
const FIR_C = 1.24, FIR_S = -0.12;
const LAT = 4;

// The saw's waveshape: a second saw whose phase offset grows from the PW centre and returns at
// either extreme, so a single saw sounds at all three (manual p.72)
const sawOff = pw => Math.abs(pw - 0.5) * 2;
const sawSplit = pw => { const o = Math.abs(pw - 0.5) * 2; return o > 0.008 && o < 0.992; };

// Hardware units -> seconds for envelope stages (0 -> 1 ms, 64 -> 0.13 s, 127 -> 16 s)
const envTime = v => 0.001 * exp2((clamp(v, 0, 127) * 14) / 127);
// Filter frequency 0..127, a semitone a step with 440 Hz at 60: 13.75 Hz .. 21 kHz (the Rytm MKII's
// measured law; the A4's own is not published)
const fltHz = v => 13.75 * exp2(v / 12);

const LFO_MUL = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
function lfoHz(spd, mulIdx, bpm) {
  const m = mulIdx < 12 ? LFO_MUL[mulIdx] : LFO_MUL[(mulIdx - 12) % 12];
  return ((spd * m) / 128) * ((mulIdx < 12 ? bpm : 120) / 240);
}

// The fastest an envelope rises: the original's envelopes are computed at a control rate of about
// 1.5 kHz and reach the analog circuits through smoothed control voltages, so even ATK 0 takes about
// a millisecond and a half. (Faster, a snapping filter or VCA would step the waveform.)
var ENV_MIN_RISE = 0.0015;

// Envelope shapes (shape >> 1), manual p.74-75: [attack, decay/release]
//   attack 0 linear, 1 standard (analog RC), 2 exponential (rises faster and faster),
//          3 full (jumps to full level and stays there for the ATK time)
//   decay/release 0 linear, 1 exponential (snappy, with a tail)
const SHAPES = [[0, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1]];

// V8 stores a field created with an integer value (this.v = 0) as a small integer. The first fractional
// value then gives the object a new map, deprecates the old one and throws away the code optimised
// against it - over and over in the first seconds, as each voice reaches new code paths (and TurboFan
// needs 50-200 ms to recompile the big functions). So every numeric state field that ever holds a
// fraction is created holding one (D) before its real initial value is stored.
const D = 0.5;

class Env {
  constructor() {
    this.v = this.x = this.kA = this.tA = this.kD = this.tD = this.kR = this.tR = this.kI = this.eI = this.kE = this.eE = D;
    this.stage = 0; this.v = 0; this.gate = false; this.pending = false; this.gateEnd = Infinity; this.x = 0;
    // memoised stage times and exponentials: input -> value (NaN: nothing yet)
    this.kA = this.kD = this.kR = this.kI = this.kE = NaN;
  }
  trig(shape, now, lenSec) {
    if (shape & 1) this.v = 0;            // (R): restart from zero
    this.stage = 1;
    this.x = SHAPES[shape >> 1][0] === 3 ? 0 : Math.cbrt(this.v); // full: count the ATK time; exponential: continue from the level
    this.gate = true;
    this.pending = false;
    this.gateEnd = lenSec > 0 ? now + lenSec : Infinity;
  }
  release(shape) {
    this.gate = false;
    if (this.stage === 0) return;
    this.stage = 4;
  }
  /**
   * One control tick. vc.E(iA / iD / iS / iR): the voice's attack, decay, sustain and release values,
   * read only for the stage that runs (each stage uses one time; the stage times are memoised).
   */
  tick(dt, vc, iA, iD, iS, iR, shape, now, inf) {
    if (this.gate && now >= this.gateEnd) { this.gateEnd = Infinity; this.release(shape); }
    const s = SHAPES[shape >> 1];
    switch (this.stage) {
      case 1: {
        const atk = this.atk(vc.E(iA));
        if (s[0] === 3) {
          // full: up to full level at once (within the shortest rise), then held for the ATK time
          this.v = Math.min(1, this.v + dt / ENV_MIN_RISE);
          this.x += dt / (atk > ENV_MIN_RISE ? atk : ENV_MIN_RISE);
          if (this.x >= 1 && this.v >= 1) this.stage = 2;
          break;
        }
        const inc = dt / (atk > ENV_MIN_RISE ? atk : ENV_MIN_RISE);
        if (s[0] === 0) this.v += inc;
        else if (s[0] === 1) {
          if (inc !== this.kI) { this.kI = inc; this.eI = 1 - Math.exp(-inc * 1.4); }
          this.v += (1.32 - this.v) * this.eI;
        } else { this.x += inc; this.v = this.x * this.x * this.x; }
        if (this.v >= 1) { this.v = 1; this.stage = 2; }
        break;
      }
      case 2: {
        const dec = this.dec(vc.E(iD)), sus = vc.E(iS) / 127;
        if (s[1] === 0) { this.v -= (dt / dec) * (1 - sus + 1e-3); if (this.v <= sus) { this.v = sus; this.stage = 3; } }
        else { this.v = sus + (this.v - sus) * this.ex((-dt * 5) / dec); if (this.v - sus < 1e-4) { this.v = sus; this.stage = 3; } }
        if (this.stage === 3 && (this.pending || !this.gate)) { this.pending = false; this.stage = 4; }
        break;
      }
      case 3:
        this.v = vc.E(iS) / 127;
        if (!this.gate) this.stage = 4;
        break;
      case 4:
        if (inf) break;
        if (s[1] === 0) this.v -= dt / this.rel(vc.E(iR)); else this.v *= this.ex((-dt * 5) / this.rel(vc.E(iR)));
        if (this.v <= 1e-4) { this.v = 0; this.stage = 0; }
        break;
    }
    return this.v;
  }
  atk(v) { if (v !== this.kA) { this.kA = v; this.tA = envTime(v); } return this.tA; }
  dec(v) { if (v !== this.kD) { this.kD = v; this.tD = envTime(v); } return this.tD; }
  rel(v) { if (v !== this.kR) { this.kR = v; this.tR = envTime(v); } return this.tR; }
  ex(a) { if (a !== this.kE) { this.kE = a; this.eE = Math.exp(a); } return this.eE; }
}

class Lfo {
  constructor() {
    this.ph = this.left = this.hold = this.fade = this.rnd = this.last = this.kF = this.cF = D;
    this.ph = Math.random(); this.run = true; this.left = Infinity; this.hold = 0; this.holding = false; this.fade = 1; this.rnd = Math.random() * 2 - 1; this.last = 0;
    this.kF = NaN;   // memoised fade time: FAD -> 0.02 x 2^(|FAD| / 8)
  }
  trig(mode, sph, fad) {
    this.fade = fad < 0 ? 0 : 1;
    if (mode === 0) return;                                            // FREE
    if (mode === 2) { this.holding = true; this.hold = this.last; return; } // HOLD
    this.holding = false;
    this.ph = sph - Math.floor(sph);
    this.run = true;
    this.left = mode === 3 ? 1 : mode === 4 ? 0.5 : Infinity;          // ONE / HALF
  }
  tick(dt, hz, wave, mode, fad) {
    if (mode !== 2) this.holding = false;
    if (this.run) {
      const d = hz * dt;
      this.ph += d;
      if (this.left !== Infinity) {
        this.left -= d < 0 ? -d : d;
        if (this.left <= 0) { this.run = false; this.ph += d < 0 ? -this.left : this.left; }
      }
      if (this.ph >= 1 || this.ph < 0) { this.ph -= Math.floor(this.ph); this.rnd = Math.random() * 2 - 1; }
    } else if (mode !== 3 && mode !== 4) { this.run = true; this.left = Infinity; }
    if (fad !== 0) {
      if (fad !== this.kF) { this.kF = fad; this.cF = 0.02 * exp2((fad < 0 ? -fad : fad) / 8); }
      const st = dt / this.cF;
      this.fade = fad < 0 ? Math.min(1, this.fade + st) : Math.max(0, this.fade - st);
    } else this.fade = 1;
    const p = this.ph;
    let v;
    switch (wave) {
      case 0: v = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4; break; // TRI
      case 1: v = sin2pi(p); break;                                         // SIN
      case 2: v = p < 0.5 ? 1 : -1; break;                                  // SQR
      case 3: v = 1 - 2 * p; break;                                         // SAW
      case 4: v = Math.exp(-6 * p) * 1.0025 - 0.0025; break;                // EXP
      case 5: v = p; break;                                                 // RMP
      default: v = this.rnd;                                                // RND
    }
    this.last = v;
    return (this.holding ? this.hold : v) * this.fade;
  }
}

const triLfo = p => (p < 0.5 ? 4 * p - 1 : 3 - 4 * p);
const sq127 = v => { const x = v / 127; return x * x; };

function enqueue(q, ev) {
  let i = q.length;
  while (i > 0 && q[i - 1].time > ev.time) i--;
  q.splice(i, 0, ev);
}

// Oscillator event kinds
const E_WRAP = 1, E_PW = 2, E_HALF = 3, E_RESET = 4;
// Sub divider output for count c: 2PUL is high for two counts of four, the others for one
const subHi = (sub, c) => (sub === 2 ? c < 2 : c < 1);

// The parameter indices the code reads by name, as an object literal with a fixed shape. The map the
// nodes get (processorOptions.keys) is built by keyed stores, and with ~100 keys V8 keeps that object
// in dictionary mode: every I.xxx read would be a hash lookup, and a control tick reads ~150 of them.
const voiceIndex = I => ({
  osc1_tun: I.osc1_tun, osc1_fin: I.osc1_fin, osc1_det: I.osc1_det, osc1_trk: I.osc1_trk, osc1_lev: I.osc1_lev,
  osc1_wav: I.osc1_wav, osc1_sub: I.osc1_sub, osc1_pw: I.osc1_pw, osc1_spd: I.osc1_spd, osc1_pwm: I.osc1_pwm,
  osc1_pmod: I.osc1_pmod,
  osc2_tun: I.osc2_tun, osc2_fin: I.osc2_fin, osc2_det: I.osc2_det, osc2_trk: I.osc2_trk, osc2_lev: I.osc2_lev,
  osc2_wav: I.osc2_wav, osc2_sub: I.osc2_sub, osc2_pw: I.osc2_pw, osc2_spd: I.osc2_spd, osc2_pwm: I.osc2_pwm,
  osc2_pmod: I.osc2_pmod,
  noise_snh: I.noise_snh, noise_col: I.noise_col, noise_fad: I.noise_fad, noise_lev: I.noise_lev,
  osc_am1: I.osc_am1, osc_am2: I.osc_am2, osc_smd: I.osc_smd, osc_snc: I.osc_snc, osc_bnd: I.osc_bnd,
  osc_sli: I.osc_sli, osc_trg: I.osc_trg, osc_vfa: I.osc_vfa, osc_vsp: I.osc_vsp, osc_vib: I.osc_vib,
  flt1_frq: I.flt1_frq, flt1_res: I.flt1_res, flt1_ovr: I.flt1_ovr, flt1_trk: I.flt1_trk, flt1_dep: I.flt1_dep,
  flt2_frq: I.flt2_frq, flt2_res: I.flt2_res, flt2_typ: I.flt2_typ, flt2_trk: I.flt2_trk, flt2_dep: I.flt2_dep,
  amp_atk: I.amp_atk, amp_dec: I.amp_dec, amp_sus: I.amp_sus, amp_rel: I.amp_rel, amp_shp: I.amp_shp,
  amp_cho: I.amp_cho, amp_del: I.amp_del, amp_rev: I.amp_rev, amp_pan: I.amp_pan, amp_vol: I.amp_vol,
  envf_atk: I.envf_atk, envf_dec: I.envf_dec, envf_sus: I.envf_sus, envf_rel: I.envf_rel, envf_shp: I.envf_shp,
  envf_len: I.envf_len, envf_dsta: I.envf_dsta, envf_depa: I.envf_depa, envf_dstb: I.envf_dstb, envf_depb: I.envf_depb,
  env2_atk: I.env2_atk, env2_dec: I.env2_dec, env2_sus: I.env2_sus, env2_rel: I.env2_rel, env2_shp: I.env2_shp,
  env2_len: I.env2_len, env2_dsta: I.env2_dsta, env2_depa: I.env2_depa, env2_dstb: I.env2_dstb, env2_depb: I.env2_depb,
  lfo1_spd: I.lfo1_spd, lfo1_mul: I.lfo1_mul, lfo1_fad: I.lfo1_fad, lfo1_sph: I.lfo1_sph, lfo1_mod: I.lfo1_mod,
  lfo1_wav: I.lfo1_wav, lfo1_dsta: I.lfo1_dsta, lfo1_depa: I.lfo1_depa, lfo1_dstb: I.lfo1_dstb, lfo1_depb: I.lfo1_depb,
  lfo2_spd: I.lfo2_spd, lfo2_mul: I.lfo2_mul, lfo2_fad: I.lfo2_fad, lfo2_sph: I.lfo2_sph, lfo2_mod: I.lfo2_mod,
  lfo2_wav: I.lfo2_wav, lfo2_dsta: I.lfo2_dsta, lfo2_depa: I.lfo2_depa, lfo2_dstb: I.lfo2_dstb, lfo2_depb: I.lfo2_depb,
  snd_acc: I.snd_acc, snd_leg: I.snd_leg, snd_prt: I.snd_prt, snd_drf: I.snd_drf, snd_bst: I.snd_bst, level: I.level,
});

// ============================================================================
// Voice
// ============================================================================

class A4Voice extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // the fractional state fields, created as doubles (see D)
    this.bpm = this.pitch = this.glideFrom = this.glideT = this.glideTime = this.bendAmt = this.bendT = this.bendTime = D;
    this.vibPh = this.vibFade = this.pwm1 = this.pwm2 = this.noiseFade = this.drift1 = this.drift2 = this.snc = D;
    this.rng = this.nVal = this.nHp = this.pk0 = this.pk1 = this.pk2 = this.nRed = this.p1 = this.p2 = D;
    this.l0 = this.l1 = this.l2 = this.l3 = this.ic1 = this.ic2 = this.lp1 = this.fb = D;
    this.gain = this.sendC = this.sendD = this.sendR = this.gS = D;
    // set by each control tick (created here, so the object's shape never changes)
    this.w1 = 0; this.w2 = 0; this.sub1 = 0; this.sub2 = 0; this.smd = 0; this.snc = 0; this.am1 = false; this.am2 = false; this.type2 = 0;
    // Memoised control-rate functions, input -> value (k*: the input, NaN = nothing yet). Most inputs
    // stay put between control ticks; each value is the same expression of the same input as before.
    this.kVsp = this.cVsp = this.kVfa = this.cVfa = this.kN1 = this.cN1 = this.kN2 = this.cN2 = D;
    this.kSp1 = this.cSp1 = this.kSp2 = this.cSp2 = this.kNfa = this.cNfa = this.kCol = this.cHpK = D;
    this.kF1 = this.cG1 = this.kF2 = this.cG2 = this.kR1 = this.cK1 = this.kR2 = this.cK2 = D;
    this.kOvr = this.cDrive = this.cOvr = this.cInDrive = this.cInComp = this.kPan = this.cPanL = this.cPanR = D;
    this.kVsp = this.kVfa = this.kN1 = this.kN2 = this.kSp1 = this.kSp2 = this.kNfa = this.kCol = NaN;
    this.kF1 = this.kF2 = this.kR1 = this.kR2 = this.kOvr = this.kPan = NaN;
    this.redK = 1 - Math.exp((-TWO_PI * 20) / sampleRate);   // red noise pole (20 Hz)
    this.fdbK = 1 - Math.exp((-TWO_PI * 25) / sampleRate);   // FDB AC coupling (25 Hz)
    // the modulation entries the last control tick wrote (the rest of M is zero)
    this.mIdx = new Int32Array(64); this.mN = 0;
    const o = (options && options.processorOptions) || {};
    const keys = o.keys || [];
    const I = {};
    keys.forEach((k, i) => (I[k] = i));
    this.I = voiceIndex(I);
    this.N = keys.length;
    this.P = new Float32Array(this.N);
    this.O = new Float32Array(this.N);
    this.M = new Float32Array(this.N);
    this.mins = Float32Array.from(o.mins || []);
    this.maxs = Float32Array.from(o.maxs || []);
    (o.defs || []).forEach((v, i) => (this.P[i] = v));
    this.dests = (o.dests || []).map(d => ({ idx: d.keys.map(k => I[k]).filter(x => x !== undefined), range: d.range }));
    this.vmDst = [1, 2, 3, 4, 5].map(n => I['vmod_dst' + n]);
    this.vmDep = [1, 2, 3, 4, 5].map(n => I['vmod_dep' + n]);
    this.q = [];
    this.ramps = [];
    this.bpm = 120;
    this.stepSec = 0.125;

    this.note = 60; this.pitch = 60; this.glideFrom = 60; this.glideT = 0; this.glideTime = 0;
    this.bendAmt = 0; this.bendT = 0; this.bendTime = 0;   // auto bend (OSC 1&2 BND)
    this.vel = 100 / 127; this.acc = 0; this.gate = false;
    this.envA = new Env(); this.envF = new Env(); this.env2 = new Env();
    this.lfo1 = new Lfo(); this.lfo2 = new Lfo();
    this.vibPh = 0; this.vibFade = 1; this.pwm1 = Math.random(); this.pwm2 = Math.random();
    this.noiseFade = 1; this.drift1 = 0; this.drift2 = 0;
    this.rng = ((Math.random() * 4294967295) >>> 0) || 1;
    this.nCount = 0; this.nVal = 0; this.nHp = 0; this.pk0 = 0; this.pk1 = 0; this.pk2 = 0; this.nRed = 0;
    // NEI: the next track takes this voice's multimode output, which (like the analog original's)
    // keeps running while the VCA is closed - so a feeding voice never sleeps
    this.feed = false;
    this.p1 = Math.random(); this.p2 = Math.random();
    this.s1 = 1; this.s2 = 1; this.c1 = 0; this.c2 = 0;   // sub dividers
    // ladder stages, multimode integrators, FDB coupling (lp1: the DC level the feedback path blocks), ladder output
    this.l0 = 0; this.l1 = 0; this.l2 = 0; this.l3 = 0; this.ic1 = 0; this.ic2 = 0; this.lp1 = 0; this.fb = 0;
    this.gain = 0; this.panL = Math.SQRT1_2; this.panR = Math.SQRT1_2; this.sendC = 0; this.sendD = 0; this.sendR = 0;
    this.g1 = 0.5; this.g2 = 0.5; this.dt1 = 0.005; this.dt2 = 0.005;
    this.idle = true;
    this.velMod = this.vel;
    this.cutLeft = 0; this.cutN = 1;   // STOP: control blocks left of the cut-off fade
    this.gS = 0;                       // smoothed VCA gain
    this.kGain = 1 - Math.exp(-BLOCK / (sampleRate * 0.0005));
    this.nb = 8; // control blocks per quantum
    this.alloc(128);
    this.port.onmessage = e => this.msg(e.data);
  }

  alloc(n) {
    this.n = n;
    const nb = Math.ceil(n / BLOCK);
    this.nb = nb;
    const f = () => new Float64Array(nb + 1);
    // PW starts at the centre: the oscillator pass also runs over the idle blocks before a voice's
    // first control tick, and a width of exactly 0 or 1 gives the triangle and transistor pulse
    // infinite slopes (NaN in the band-limiting buffers)
    this.bDt1 = f(); this.bDt2 = f(); this.bPw1 = f().fill(0.5); this.bPw2 = f().fill(0.5); this.bG1 = f(); this.bG2 = f();
    this.bInDrive = f().fill(1); this.bInComp = f().fill(1);
    this.bGain = f(); this.bPanL = f(); this.bPanR = f(); this.bSC = f(); this.bSD = f(); this.bSR = f();
    this.bK1 = f(); this.bComp = f(); this.bDrive = f(); this.bOvr = f(); this.bK2 = f(); this.bPk = f();
    this.bLev1 = f(); this.bLev2 = f(); this.bNLev = f(); this.bNHold = f(); this.bNCol = f(); this.bNHpK = f(); this.bNHpG = f();
    const cap = 8 * n + 16;
    this.evI = new Int32Array(cap); this.evK = new Int32Array(cap); this.evO = new Int8Array(cap);
    this.evD = new Float64Array(cap); this.evH = new Float64Array(cap); this.evS = new Float64Array(cap);
    this.W1 = new Float64Array(n + LAT + 1);
    this.W2 = new Float64Array(n + LAT + 1);
  }

  msg(m) {
    switch (m.t) {
      case 'p': { const l = m.list; for (let k = 0; k < l.length; k += 2) this.P[l[k]] = l[k + 1]; break; }
      case 'off2': { this.O.fill(0); const l = m.list; for (let k = 0; k < l.length; k += 2) this.O[l[k]] = l[k + 1]; break; }
      case 'bpm': this.bpm = m.v; break;
      case 'step': this.stepSec = m.v; break;
      case 'feed': this.feed = !!m.v; break;
      case 'reset':
        this.q.length = 0; this.ramps.length = 0;
        if (this.gate) this.noteOff();
        break;
      case 'cut':
        // [STOP]: the sound is cut off (manual p.38); nothing queued ahead may sound after it
        this.q.length = 0; this.ramps.length = 0;
        this.gate = false;
        if (!this.idle || this.envA.stage !== 0) { this.cutN = Math.max(1, Math.round((0.006 * sampleRate) / BLOCK)); this.cutLeft = this.cutN; }
        break;
      default: enqueue(this.q, A4Voice.event(m));
    }
  }

  /**
   * A queued event, in one shape for every kind (the messages' shapes differ by kind and sender), so
   * the code that reads the queue on the audio clock sees a single object map
   */
  static event(m) {
    return { t: m.t, time: m.time, t1: m.t1, list: m.list, note: m.note, vel: m.vel, acc: m.acc, slide: m.slide, live: m.live, leg: m.leg, rt: m.rt };
  }

  /**
   * The sequencer ends an overlapping note at the instant the next one starts. With ARP LEG on, that
   * next note plays legato (manual p.44): its gate takes over and the envelopes run on.
   */
  static legatoNext(q, time) {
    for (let i = 0; i < q.length && q[i].time <= time + 1e-6; i++) if (q[i].t === 'on') return !!q[i].leg;
    return false;
  }

  /** The end of a cut: every envelope at rest, no gate */
  silence() {
    for (const e of [this.envA, this.envF, this.env2]) { e.v = 0; e.stage = 0; e.gate = false; e.pending = false; e.gateEnd = Infinity; }
    this.gate = false;
    this.glideTime = 0;
    this.bendAmt = 0;
    this.gS = 0;
  }

  E(i) {
    const v = this.P[i] + this.O[i] + this.M[i];
    return v < this.mins[i] ? this.mins[i] : v > this.maxs[i] ? this.maxs[i] : v;
  }

  noteOn(ev, now) {
    const I = this.I, P = this.P;
    if (this.cutLeft > 0) { this.cutLeft = 0; this.silence(); }
    const wasGate = this.gate;
    this.note = ev.note;
    this.vel = Math.max(1, ev.vel) / 127;
    this.acc = ev.acc ? 1 : 0;
    const prt = P[I.snd_prt];
    const legMode = P[I.snd_leg] >= 0.5;
    // SOUND SETTINGS PORTAMENTO acts only on notes played on the keyboard (or from MIDI), never on
    // the sequencer's; LEG glides between overlapping played notes and needs LEGATO MODE on (manual
    // p.35). Slide trigs always glide (p.52).
    const glide = ev.slide || (ev.live && (prt === 1 || (prt === 2 && legMode && wasGate)));
    if (glide && !this.idle) {
      this.glideFrom = this.pitch;
      this.glideTime = A4Voice.slideSec(this.E(I.osc_sli));
      this.glideT = 0;
    } else { this.pitch = ev.note; this.glideTime = 0; }
    const legato = wasGate && ((ev.slide) || ev.leg || (legMode && ev.live));
    this.gate = true;
    if (!legato) {
      // ev.rt: the NOTE page retrig switches (1 ENV F, 2 ENV 2, 4 LFO 1, 8 LFO 2; all on by default)
      const rt = ev.rt === undefined ? 15 : ev.rt;
      this.envA.trig(Math.round(P[I.amp_shp]), now, 0);
      this.retrig(rt, now);
      this.vibFade = P[I.osc_vfa] < 0 ? 0 : 1;
      this.noiseFade = P[I.noise_fad] < 0 ? 0 : 1;
      // BND, the auto bend: every trigged note starts offset by BND and glides to its pitch in the
      // SLI time (manual p.88); 0.5 semitone a step, so +/-64 is about +/-2.7 octaves
      const bnd = this.E(I.osc_bnd);
      this.bendAmt = bnd * 0.5; this.bendT = 0; this.bendTime = A4Voice.slideSec(this.E(I.osc_sli));
      if (P[I.osc_trg] >= 0.5) { this.p1 = 0; this.p2 = 0; this.c1 = 0; this.c2 = 0; this.s1 = 1; this.s2 = 1; }
    }
    this.velMod = this.vel;
    this.idle = false;
  }

  /** Restart the modulators a trig asks for (a note, or a lock trig with retrig switches locked on) */
  retrig(rt, now) {
    const P = this.P, I = this.I;
    const lsec = v => (v > 0 ? 0.125 * exp2(((v - 1) / 126) * 10) * this.stepSec : 0);
    // without a sounding note, a retrigged envelope runs for one step
    const gate = v => lsec(v) || (this.gate ? 0 : this.stepSec);
    if (rt & 1) this.envF.trig(Math.round(P[I.envf_shp]), now, gate(P[I.envf_len]));
    if (rt & 2) this.env2.trig(Math.round(P[I.env2_shp]), now, gate(P[I.env2_len]));
    if (rt & 4) this.lfo1.trig(Math.round(P[I.lfo1_mod]), this.E(I.lfo1_sph) / 128, P[I.lfo1_fad]);
    if (rt & 8) this.lfo2.trig(Math.round(P[I.lfo2_mod]), this.E(I.lfo2_sph) / 128, P[I.lfo2_fad]);
  }

  noteOff() {
    const P = this.P, I = this.I;
    this.gate = false;
    this.envA.release(Math.round(P[I.amp_shp]));
    if (this.envF.gateEnd === Infinity) this.envF.release(Math.round(P[I.envf_shp]));
    if (this.env2.gateEnd === Infinity) this.env2.release(Math.round(P[I.env2_shp]));
  }

  route(dstIdx, amount) {
    if (!dstIdx || amount === 0) return;
    const d = this.dests[dstIdx];
    if (!d) return;
    const a = amount * d.range;
    const idx = d.idx, M = this.M, mIdx = this.mIdx;
    for (let k = 0; k < idx.length; k++) { M[idx[k]] += a; mIdx[this.mN++] = idx[k]; }
  }

  /** A modulator's route: destination P[iDst], amount E(iDep) / 128 x value (the depth is read only when routed) */
  route2(iDst, iDep, x) {
    const d = Math.round(this.P[iDst]);
    if (d) this.route(d, (this.E(iDep) / 128) * x);
  }

  /** One control tick: modulation, envelopes, coefficients for block b */
  control(now, dt, b) {
    const I = this.I, P = this.P, sr = sampleRate;
    // clear last tick's modulation: only the entries it wrote are non-zero
    const M = this.M, mIdx = this.mIdx;
    for (let k = 0, n = this.mN; k < n; k++) M[mIdx[k]] = 0;
    this.mN = 0;
    const vm = this.velMod;
    for (let n = 0; n < 5; n++) {
      const dep = P[this.vmDep[n]];
      if (dep !== 0) this.route(Math.round(P[this.vmDst[n]]), (dep / 128) * vm);
    }
    const ef = this.envF.tick(dt, this, I.envf_atk, I.envf_dec, I.envf_sus, I.envf_rel, Math.round(P[I.envf_shp]), now, P[I.envf_rel] >= 127);
    const e2 = this.env2.tick(dt, this, I.env2_atk, I.env2_dec, I.env2_sus, I.env2_rel, Math.round(P[I.env2_shp]), now, P[I.env2_rel] >= 127);
    this.route2(I.envf_dsta, I.envf_depa, ef);
    this.route2(I.envf_dstb, I.envf_depb, ef);
    this.route2(I.env2_dsta, I.env2_depa, e2);
    this.route2(I.env2_dstb, I.env2_depb, e2);
    const l2 = this.lfo2.tick(dt, lfoHz(this.E(I.lfo2_spd), Math.round(P[I.lfo2_mul]), this.bpm), Math.round(P[I.lfo2_wav]), Math.round(P[I.lfo2_mod]), this.E(I.lfo2_fad));
    this.route2(I.lfo2_dsta, I.lfo2_depa, l2);
    this.route2(I.lfo2_dstb, I.lfo2_depb, l2);
    const l1 = this.lfo1.tick(dt, lfoHz(this.E(I.lfo1_spd), Math.round(P[I.lfo1_mul]), this.bpm), Math.round(P[I.lfo1_wav]), Math.round(P[I.lfo1_mod]), this.E(I.lfo1_fad));
    this.route2(I.lfo1_dsta, I.lfo1_depa, l1);
    this.route2(I.lfo1_dstb, I.lfo1_depb, l1);

    const ea = this.envA.tick(dt, this, I.amp_atk, I.amp_dec, I.amp_sus, I.amp_rel, Math.round(P[I.amp_shp]), now, P[I.amp_rel] >= 127);

    // Glide (constant time, smooth ends)
    if (this.glideTime > 0) {
      this.glideT += dt;
      const k = Math.min(1, this.glideT / this.glideTime);
      this.pitch = this.glideFrom + (this.note - this.glideFrom) * (k * k * (3 - 2 * k));
      if (k >= 1) this.glideTime = 0;
    } else this.pitch = this.note;

    // Vibrato, drift (phase wraps by subtracting 0 or 1: no branch that runs only now and then)
    const vsp = this.E(I.osc_vsp);
    if (vsp !== this.kVsp) { this.kVsp = vsp; this.cVsp = exp2(vsp / 26); }
    this.vibPh += 0.5 * this.cVsp * dt;
    this.vibPh -= this.vibPh >= 1 ? 1 : 0;
    const vfa = P[I.osc_vfa];
    if (vfa !== 0) {
      if (vfa !== this.kVfa) { this.kVfa = vfa; this.cVfa = 0.02 * exp2((vfa < 0 ? -vfa : vfa) / 8); }
      const st = dt / this.cVfa;
      this.vibFade = vfa < 0 ? Math.min(1, this.vibFade + st) : Math.max(0, this.vibFade - st);
    } else this.vibFade = 1;
    // depth 0 gives a vibrato of (+/-)0, which leaves the pitch sums below unchanged
    const vdep = this.E(I.osc_vib);
    const vib = vdep !== 0 ? sin2pi(this.vibPh) * (vdep / 127) * 0.6 * this.vibFade : 0;
    if (P[I.snd_drf] >= 0.5) {
      this.drift1 = this.drift1 * 0.9995 + (Math.random() - 0.5) * 0.002;
      this.drift2 = this.drift2 * 0.9995 + (Math.random() - 0.5) * 0.002;
    } else { this.drift1 = 0; this.drift2 = 0; }

    // Auto bend (BND): from the offset back to the note over the SLI time, fast at first. With sync on
    // only the synced oscillator bends: OSC 2 for 1>2, OSC 1 for 2>1, both for metal (manual p.88)
    let bend1 = 0, bend2 = 0;
    if (this.bendAmt !== 0) {
      this.bendT += dt;
      const k = this.bendTime > 0 ? Math.min(1, this.bendT / this.bendTime) : 1;
      const b = this.bendAmt * (1 - k) * (1 - k);
      const smd = Math.round(P[I.osc_smd]);
      if (smd !== 1) bend1 = b;
      if (smd !== 2) bend2 = b;
      if (k >= 1) this.bendAmt = 0;
    }

    // Oscillator increments
    const n1 = (P[I.osc1_trk] >= 0.5 ? this.pitch : 60) + this.E(I.osc1_tun) + this.E(I.osc1_fin) / 128 + this.M[I.osc1_pmod] + vib + bend1 + this.drift1 * 0.05;
    const n2 = (P[I.osc2_trk] >= 0.5 ? this.pitch : 60) + this.E(I.osc2_tun) + this.E(I.osc2_fin) / 128 + this.M[I.osc2_pmod] + vib + bend2 + this.drift2 * 0.05;
    if (n1 !== this.kN1) { this.kN1 = n1; this.cN1 = 440 * exp2((n1 - 69) / 12); }
    if (n2 !== this.kN2) { this.kN2 = n2; this.cN2 = 440 * exp2((n2 - 69) / 12); }
    const hz1 = this.cN1 + this.E(I.osc1_det) * 0.125;
    const hz2 = this.cN2 + this.E(I.osc2_det) * 0.125;
    this.bDt1[b + 1] = clamp(hz1, 0.1, sr * 0.45) / sr;
    this.bDt2[b + 1] = clamp(hz2, 0.1, sr * 0.45) / sr;

    // PWM LFOs (triangle) and pulse widths
    const sp1 = this.E(I.osc1_spd), sp2 = this.E(I.osc2_spd);
    if (sp1 !== this.kSp1) { this.kSp1 = sp1; this.cSp1 = 0.1 * exp2(sp1 / 16); }
    if (sp2 !== this.kSp2) { this.kSp2 = sp2; this.cSp2 = 0.1 * exp2(sp2 / 16); }
    this.pwm1 += this.cSp1 * dt; this.pwm1 -= this.pwm1 >= 1 ? 1 : 0;
    this.pwm2 += this.cSp2 * dt; this.pwm2 -= this.pwm2 >= 1 ? 1 : 0;
    // PW shapes every waveform; 0 is the plain wave, the extremes mute the pulses (manual p.72, p.87)
    this.bPw1[b + 1] = clamp(0.5 + (this.E(I.osc1_pw) / 64) * 0.5 + triLfo(this.pwm1) * (this.E(I.osc1_pwm) / 127) * 0.45, 0.002, 0.998);
    this.bPw2[b + 1] = clamp(0.5 + (this.E(I.osc2_pw) / 64) * 0.5 + triLfo(this.pwm2) * (this.E(I.osc2_pwm) / 127) * 0.45, 0.002, 0.998);
    this.bLev1[b] = this.E(I.osc1_lev) / 127;
    this.bLev2[b] = this.E(I.osc2_lev) / 127;

    // Noise
    const fad = P[I.noise_fad];
    if (fad !== 0) {
      if (fad !== this.kNfa) { this.kNfa = fad; this.cNfa = 0.005 * exp2((fad < 0 ? -fad : fad) / 7); }
      const st = dt / this.cNfa;
      this.noiseFade = fad > 0 ? Math.max(0, this.noiseFade - st) : Math.min(1, this.noiseFade + st);
    } else this.noiseFade = 1;
    const nLev = (this.E(I.noise_lev) / 127) * this.noiseFade * 0.9;
    this.bNLev[b] = nLev;
    // the sample loop reads the other noise settings of a block only when its level is above 0
    if (nLev > 0) {
      const snh = this.E(I.noise_snh) / 127;
      this.bNHold[b] = snh <= 0 ? 1 : Math.round(1 + snh * snh * 360);
      // COL (manual p.87): 0 white; negative low-passed, -32 pink (-3 dB/oct), -64 red (-6 dB/oct);
      // positive high-passed (30 Hz .. 8 kHz, level compensated)
      const col = clamp(this.E(I.noise_col) / 64, -1, 1);
      this.bNCol[b] = col;
      if (col !== this.kCol) { this.kCol = col; this.cHpK = col > 0 ? 1 - Math.exp((-TWO_PI * 30 * exp2(col * 8.06)) / sr) : 0; }
      this.bNHpK[b] = this.cHpK;
      this.bNHpG[b] = 1 + 1.5 * col * col * col * col;
    }

    // Filter 1: ladder (keytrack: 32 = 1:1; DEP 64 = the full range). An accent trig opens the filter
    // envelope further as well as raising the level (manual p.51): DEP x (1 + 0.8 x ACC/127).
    // Without an accent (acc 0) both accent factors are exactly 1.
    const semis = this.pitch - 60;
    const accF = this.acc !== 0 ? 1 + this.acc * 0.8 * (this.E(I.snd_acc) / 127) : 1;
    const f1 = this.E(I.flt1_frq) + (this.E(I.flt1_trk) / 32) * semis + this.E(I.flt1_dep) * 2 * ef * accF;
    if (f1 !== this.kF1) { this.kF1 = f1; this.cG1 = tanF((Math.PI * Math.min(sr * 0.45, fltHz(clamp(f1, -24, 140)))) / sr); }
    this.bG1[b + 1] = this.cG1;
    const r1 = this.E(I.flt1_res) / 127;
    if (r1 !== this.kR1) { this.kR1 = r1; this.cK1 = 4.3 * Math.pow(r1, 1.3); }
    const k1 = this.cK1;
    this.bK1[b] = k1;
    this.bComp[b] = P[I.snd_bst] >= 0.5 ? 1 + k1 * 0.45 : 1 + k1 * 0.08;
    const ovr = this.E(I.flt1_ovr);
    if (ovr !== this.kOvr) {
      this.kOvr = ovr;
      const op = ovr > 0 ? Math.min(1, ovr / 63) : 0, on = ovr < 0 ? Math.min(1, -ovr / 64) : 0;
      this.cDrive = 1 + op * op * 24;
      this.cOvr = Math.min(1, op * 12);
      this.cInDrive = 1 + on * on * 7;
      this.cInComp = 1 / Math.sqrt(1 + on * on * 2.5);
    }
    this.bDrive[b] = this.cDrive;
    this.bOvr[b] = this.cOvr;
    this.bInDrive[b] = this.cInDrive;
    this.bInComp[b] = this.cInComp;
    // Filter 2: multimode
    const f2 = this.E(I.flt2_frq) + (this.E(I.flt2_trk) / 32) * semis + this.E(I.flt2_dep) * 2 * ef * accF;
    if (f2 !== this.kF2) { this.kF2 = f2; this.cG2 = tanF((Math.PI * Math.min(sr * 0.45, fltHz(clamp(f2, -24, 140)))) / sr); }
    this.bG2[b + 1] = this.cG2;
    const r2 = this.E(I.flt2_res) / 127;
    const type2 = Math.round(P[I.flt2_typ]);
    this.type2 = type2;
    if (r2 !== this.kR2) { this.kR2 = r2; this.cK2 = 2 - 1.94 * Math.pow(r2, 0.8); }
    this.bK2[b] = type2 === 6 ? 1.2 : this.cK2;
    this.bPk[b] = type2 === 6 ? r2 * 3 : 0;

    // VCA: envelope x velocity x accent x volume x track level; pan; sends. The VCA's control
    // voltage is smoothed (as on the analog original), so no modulation steps the gain faster
    // than about half a millisecond - a square LFO on VOL gates without clicking.
    const vol = this.E(I.amp_vol) / 127, lvl = this.E(I.level) / 127;
    const acc = this.acc !== 0 ? 1 + this.acc * (this.E(I.snd_acc) / 127) : 1;
    const gT = ea * (0.08 + 0.92 * this.vel) * acc * vol * vol * 1.6 * lvl * lvl * 1.6;
    this.gS += (gT - this.gS) * this.kGain;
    this.bGain[b + 1] = this.gS;
    const pan = (clamp(this.E(I.amp_pan), -64, 64) + 64) / 128;
    if (pan !== this.kPan) { this.kPan = pan; this.cPanL = Math.cos(pan * Math.PI * 0.5); this.cPanR = Math.sin(pan * Math.PI * 0.5); }
    this.bPanL[b + 1] = this.cPanL;
    this.bPanR[b + 1] = this.cPanR;
    this.bSC[b + 1] = sq127(this.E(I.amp_cho));
    this.bSD[b + 1] = sq127(this.E(I.amp_del));
    this.bSR[b + 1] = sq127(this.E(I.amp_rev));

    this.w1 = Math.round(P[I.osc1_wav]); this.w2 = Math.round(P[I.osc2_wav]);
    this.sub1 = Math.round(P[I.osc1_sub]); this.sub2 = Math.round(P[I.osc2_sub]);
    this.smd = Math.round(P[I.osc_smd]);
    this.snc = this.E(I.osc_snc) / 127;
    this.am1 = P[I.osc_am1] >= 0.5; this.am2 = P[I.osc_am2] >= 0.5;
    return ea;
  }

  /** SLI 0..127 -> seconds (8 ms .. 4 s): note slides, portamento and the auto bend */
  static slideSec(sli) { return 0.008 * exp2((clamp(sli, 0, 127) / 127) * 9); }

  // Naive waveform value / slope (per unit phase) at phase p. Every wave has a variable shape (PW):
  //   SAW  a second, phase-offset saw joins the first (64 = one saw, the ends = an octave up)
  //   TRP  the transistor pulse's width          PUL  the pulse width
  //   TRI  the symmetry (64 = triangle, the ends = ramps)
  static wave(w, p, pw) {
    switch (w) {
      case 0: {
        if (!sawSplit(pw)) return 2 * p - 1;
        let q = p + sawOff(pw); if (q >= 1) q -= 1;
        return p + q - 1;
      }
      case 1: return p < pw ? 1 - 0.7 * (p / pw) - (pw * 0.65 - (1 - pw)) : -1 - (pw * 0.65 - (1 - pw)); // TRP, DC removed
      case 2: return (p < pw ? 1 : -1) - (2 * pw - 1);                                                   // PUL, DC removed
      case 3: return p < pw ? -1 + (2 * p) / pw : 1 - (2 * (p - pw)) / (1 - pw);
      default: return 0;
    }
  }
  static slope(w, p, pw) {
    switch (w) {
      case 0: return 2;
      case 1: return p < pw ? -0.7 / pw : 0;
      case 3: return p < pw ? 2 / pw : -2 / (1 - pw);
      default: return 0;
    }
  }

  push(e, i, d, kind, h, s, osc) {
    this.evI[e] = i; this.evD[e] = d < 0 ? 0 : d > 1 ? 1 : d; this.evK[e] = kind; this.evH[e] = h; this.evS[e] = s; this.evO[e] = osc;
  }

  /** Oscillator pass over the quantum: naive values into W1/W2, events for every discontinuity */
  oscPass(n) {
    const W1 = this.W1, W2 = this.W2;
    const c1 = W1[LAT], c2 = W2[LAT];
    let p1 = this.p1, p2 = this.p2;
    let s1 = this.s1, s2 = this.s2, cnt1 = this.c1, cnt2 = this.c2;
    const w1 = this.w1, w2 = this.w2, sub1 = this.sub1, sub2 = this.sub2, smd = this.smd, snc = this.snc;
    const bDt1 = this.bDt1, bDt2 = this.bDt2, bPw1 = this.bPw1, bPw2 = this.bPw2;
    const edged1 = w1 <= 3, edged2 = w2 <= 3;
    const div1 = sub1 === 1 ? 2 : sub1 === 4 ? 3 : 4, div2 = sub2 === 1 ? 2 : sub2 === 4 ? 3 : 4;
    const subDc1 = sub1 === 3 ? -0.5 : sub1 === 4 ? -0.333 : 0, subDc2 = sub2 === 3 ? -0.5 : sub2 === 4 ? -0.333 : 0;
    const SUB = 0.7;
    let e = 0;
    const W = A4Voice.wave, S = A4Voice.slope;
    // per control block: the start values and steps of the per-sample interpolations
    for (let b = 0, i = 0; i < n; b++) {
      const end = i + BLOCK < n ? i + BLOCK : n, i0 = b * BLOCK;
      const dt1a = bDt1[b], dt1d = bDt1[b + 1] - dt1a, dt2a = bDt2[b], dt2d = bDt2[b + 1] - dt2a;
      const pw1a = bPw1[b], pw1d = bPw1[b + 1] - pw1a, pw2a = bPw2[b], pw2d = bPw2[b + 1] - pw2a;
      for (; i < end; i++) {
        const f = (i - i0 + 1) / BLOCK;
        const dt1 = dt1a + dt1d * f;
        const dt2 = dt2a + dt2d * f;
        const pw1 = pw1a + pw1d * f;
        const pw2 = pw2a + pw2d * f;
        // advance both phases; d = time since a wrap within this sample (-1: none)
        let q1 = p1 + dt1, d1 = -1;
        if (q1 >= 1) { q1 -= 1; d1 = q1 / dt1; }
        let q2 = p2 + dt2, d2 = -1;
        if (q2 >= 1) { q2 -= 1; d2 = q2 / dt2; }
        // pulse-width crossings / triangle corners before any reset
        let r1 = -1, r2 = -1; // reset times (since the event) for each oscillator
        if ((smd === 1 || smd === 3) && d1 >= 0 && snc > 0) r2 = d1;
        if ((smd === 2 || smd === 3) && d2 >= 0 && snc > 0 && r2 < 0) r1 = d2;

        // ---- OSC 1
        if (r1 >= 0) {
          // reset at r1 samples ago: phase then (pre-reset), scaled by the sync amount
          let qs = p1 + dt1 * (1 - r1); qs -= Math.floor(qs);
          const pn = qs * (1 - snc);
          if (edged1) {
            this.push(e++, i, r1, E_RESET, W(w1, pn, pw1) - W(w1, qs, pw1), (S(w1, pn, pw1) - S(w1, qs, pw1)) * dt1, 1);
          }
          q1 = pn + dt1 * r1;
          d1 = r1;
        } else if (edged1) {
          const split1 = w1 === 0 && sawSplit(pw1);
          const ep1 = split1 ? 1 - sawOff(pw1) : pw1;          // the second edge / corner
          const pulse1 = w1 === 1 || w1 === 2 || split1;
          const corner1 = w1 === 3 ? (2 / pw1 + 2 / (1 - pw1)) * dt1 : 0;
          const eh1 = w1 === 1 ? -1.3 : w1 === 2 ? -2 : -1;
          const es1 = w1 === 1 ? (0.7 / pw1) * dt1 : 0;
          if (d1 >= 0) {
            if (w1 === 0) this.push(e++, i, d1, E_WRAP, split1 ? -1 : -2, 0, 1);
            else if (w1 === 3) this.push(e++, i, d1, E_WRAP, 0, corner1, 1);
            else this.push(e++, i, d1, E_WRAP, 2, w1 === 1 ? (-0.7 / pw1) * dt1 : 0, 1);
            if (pulse1 && q1 >= ep1) this.push(e++, i, (q1 - ep1) / dt1, E_PW, eh1, es1, 1);
            if (w1 === 3 && q1 >= ep1) this.push(e++, i, (q1 - ep1) / dt1, E_HALF, 0, -corner1, 1);
          } else if (pulse1 && p1 < ep1 && q1 >= ep1) {
            this.push(e++, i, (q1 - ep1) / dt1, E_PW, eh1, es1, 1);
          } else if (w1 === 3 && p1 < ep1 && q1 >= ep1) {
            this.push(e++, i, (q1 - ep1) / dt1, E_HALF, 0, -corner1, 1);
          }
        }
        if (sub1 === 4) {
          // half-cycle steps: high for one of every three (2/3 f, 33%)
          const hd = d1 >= 0 ? d1 : p1 < 0.5 && q1 >= 0.5 ? (q1 - 0.5) / dt1 : -1;
          if (hd >= 0) {
            cnt1 = (cnt1 + 1) % 3;
            const ns = cnt1 === 0 ? 1 : -1;
            if (ns !== s1) { this.push(e++, i, hd, E_WRAP, (ns - s1) * SUB, 0, 3); s1 = ns; }
          }
        } else if (sub1 && d1 >= 0) {
          cnt1 = (cnt1 + 1) % div1;
          const ns = subHi(sub1, cnt1) ? 1 : -1;
          if (ns !== s1) { this.push(e++, i, d1, E_WRAP, (ns - s1) * SUB, 0, 3); s1 = ns; }
        }

        // ---- OSC 2
        if (r2 >= 0) {
          let qs = p2 + dt2 * (1 - r2); qs -= Math.floor(qs);
          const pn = qs * (1 - snc);
          if (edged2) this.push(e++, i, r2, E_RESET, W(w2, pn, pw2) - W(w2, qs, pw2), (S(w2, pn, pw2) - S(w2, qs, pw2)) * dt2, 2);
          q2 = pn + dt2 * r2;
          d2 = r2;
        } else if (edged2) {
          const split2 = w2 === 0 && sawSplit(pw2);
          const ep2 = split2 ? 1 - sawOff(pw2) : pw2;          // the second edge / corner
          const pulse2 = w2 === 1 || w2 === 2 || split2;
          const corner2 = w2 === 3 ? (2 / pw2 + 2 / (1 - pw2)) * dt2 : 0;
          const eh2 = w2 === 1 ? -1.3 : w2 === 2 ? -2 : -1;
          const es2 = w2 === 1 ? (0.7 / pw2) * dt2 : 0;
          if (d2 >= 0) {
            if (w2 === 0) this.push(e++, i, d2, E_WRAP, split2 ? -1 : -2, 0, 2);
            else if (w2 === 3) this.push(e++, i, d2, E_WRAP, 0, corner2, 2);
            else this.push(e++, i, d2, E_WRAP, 2, w2 === 1 ? (-0.7 / pw2) * dt2 : 0, 2);
            if (pulse2 && q2 >= ep2) this.push(e++, i, (q2 - ep2) / dt2, E_PW, eh2, es2, 2);
            if (w2 === 3 && q2 >= ep2) this.push(e++, i, (q2 - ep2) / dt2, E_HALF, 0, -corner2, 2);
          } else if (pulse2 && p2 < ep2 && q2 >= ep2) {
            this.push(e++, i, (q2 - ep2) / dt2, E_PW, eh2, es2, 2);
          } else if (w2 === 3 && p2 < ep2 && q2 >= ep2) {
            this.push(e++, i, (q2 - ep2) / dt2, E_HALF, 0, -corner2, 2);
          }
        }
        if (sub2 === 4) {
          // half-cycle steps: high for one of every three (2/3 f, 33%)
          const hd = d2 >= 0 ? d2 : p2 < 0.5 && q2 >= 0.5 ? (q2 - 0.5) / dt2 : -1;
          if (hd >= 0) {
            cnt2 = (cnt2 + 1) % 3;
            const ns = cnt2 === 0 ? 1 : -1;
            if (ns !== s2) { this.push(e++, i, hd, E_WRAP, (ns - s2) * SUB, 0, 4); s2 = ns; }
          }
        } else if (sub2 && d2 >= 0) {
          cnt2 = (cnt2 + 1) % div2;
          const ns = subHi(sub2, cnt2) ? 1 : -1;
          if (ns !== s2) { this.push(e++, i, d2, E_WRAP, (ns - s2) * SUB, 0, 4); s2 = ns; }
        }
        p1 = q1; p2 = q2;
        const k = i + LAT;
        W1[k] = (edged1 ? W(w1, p1, pw1) : 0) + (sub1 ? s1 * SUB - subDc1 * SUB : 0);
        W2[k] = (edged2 ? W(w2, p2, pw2) : 0) + (sub2 ? s2 * SUB - subDc2 * SUB : 0);
      }
    }
    W1[LAT] += c1; W1[n + LAT] = 0;
    W2[LAT] += c2; W2[n + LAT] = 0;
    // band-limit every discontinuity at its sub-sample position
    const evI = this.evI, evD = this.evD, evH = this.evH, evS = this.evS, evO = this.evO;
    for (let j = 0; j < e; j++) {
      const k = evI[j] + LAT, d = evD[j], W_ = evO[j] === 1 || evO[j] === 3 ? W1 : W2;
      if (evH[j] !== 0) addBlep(W_, k, d, evH[j]);
      if (evS[j] !== 0) addBlamp(W_, k, d, evS[j]);
    }
    if (!(p1 === p1) || !(p2 === p2)) { p1 = 0; p2 = 0; W1.fill(0); W2.fill(0); }
    this.p1 = p1; this.p2 = p2; this.s1 = s1; this.s2 = s2; this.c1 = cnt1; this.c2 = cnt2;
  }

  process(inputs, outputs) {
    const out0 = outputs[0], out1 = outputs[1], out2 = outputs[2];
    const L = out0[0], R = out0[1] || out0[0];
    const SC = out1 && out1[0], SD = out1 && out1[1], SRv = out1 && out1[2];
    const MO = out2 && out2[0];
    const nbIn = inputs[0] && inputs[0][0];
    const n = L.length;
    if (n !== this.n) this.alloc(n);
    // control ticks (events at block starts, then targets for each block); a voice that stays
    // silent all quantum (and was silent at its start) skips the DSP
    if (!this.ticks() && this.bGain[0] === 0) {
      L.fill(0); if (R !== L) R.fill(0);
      if (SC) { SC.fill(0); SD.fill(0); SRv.fill(0); }
      if (MO) MO.fill(0);
      this.W1.fill(0); this.W2.fill(0);
      return true;
    }
    this.oscPass(n);                                  // oscillators (band-limited)
    this.render(n, L, R, SC, SD, SRv, MO, nbIn);      // noise, filters, VCA per sample
    return true;
  }

  /** The control ticks of a quantum; false when the voice was silent in every block */
  ticks() {
    const sr = sampleRate, t0 = currentTime, dtBlock = BLOCK / sr, nb = this.nb;
    let any = false;
    this.bDt1[0] = this.dt1; this.bDt2[0] = this.dt2; this.bPw1[0] = this.bPw1[nb]; this.bPw2[0] = this.bPw2[nb];
    this.bG1[0] = this.g1; this.bG2[0] = this.g2; this.bGain[0] = this.gain;
    this.bPanL[0] = this.panL; this.bPanR[0] = this.panR; this.bSC[0] = this.sendC; this.bSD[0] = this.sendD; this.bSR[0] = this.sendR;
    for (let b = 0; b < nb; b++) {
      const now = t0 + (b * BLOCK) / sr;
      const q = this.q;
      if (q.length && q[0].time <= now + 1e-6) this.events(now);
      if (this.ramps.length) this.applyRamps(now);
      if (this.idle && this.envA.stage === 0 && !this.feed) { this.idleBlock(b, dtBlock); continue; }
      any = true;
      const ea = this.control(now, dtBlock, b);
      if (this.cutLeft > 0) this.cutStep(b);
      if (this.envA.stage === 0 && ea <= 1e-5 && !this.gate && this.gS < 1e-5) this.idle = true;
    }
    // carry the last targets into the next quantum
    this.dt1 = this.bDt1[nb]; this.dt2 = this.bDt2[nb]; this.g1 = this.bG1[nb]; this.g2 = this.bG2[nb];
    this.gain = this.bGain[nb]; this.panL = this.bPanL[nb]; this.panR = this.bPanR[nb];
    this.sendC = this.bSC[nb]; this.sendD = this.bSD[nb]; this.sendR = this.bSR[nb];
    return any;
  }

  /** The queued events due at `now` */
  events(now) {
    const q = this.q, P = this.P;
    while (q.length && q[0].time <= now + 1e-6) {
      const ev = q.shift();
      if (ev.t === 'at') { const l = ev.list; for (let k = 0; k < l.length; k += 2) P[l[k]] = l[k + 1]; }
      else if (ev.t === 'on') this.noteOn(ev, now);
      else if (ev.t === 'rtrg') { this.retrig(ev.rt, now); this.idle = false; }
      else if (ev.t === 'off') { if (!A4Voice.legatoNext(q, ev.time)) this.noteOff(); }
      else if (ev.t === 'ramp') { const l = ev.list; for (let k = 0; k < l.length; k += 3) this.ramps.push({ i: l[k], from: l[k + 1], to: l[k + 2], t0: ev.time, t1: ev.t1 }); }
    }
  }

  /** Parameter slides */
  applyRamps(now) {
    const P = this.P;
    for (let r = this.ramps.length - 1; r >= 0; r--) {
      const rp = this.ramps[r];
      const k = rp.t1 > rp.t0 ? clamp((now - rp.t0) / (rp.t1 - rp.t0), 0, 1) : 1;
      P[rp.i] = rp.from + (rp.to - rp.from) * k;
      if (k >= 1) this.ramps.splice(r, 1);
    }
  }

  /** A block of a silent voice: keep the free-running LFOs moving, hold the targets */
  idleBlock(b, dtBlock) {
    const I = this.I, P = this.P;
    const d1 = lfoHz(P[I.lfo1_spd], Math.round(P[I.lfo1_mul]), this.bpm) * dtBlock;
    const d2 = lfoHz(P[I.lfo2_spd], Math.round(P[I.lfo2_mul]), this.bpm) * dtBlock;
    this.lfo1.ph -= Math.floor(this.lfo1.ph += d1);
    this.lfo2.ph -= Math.floor(this.lfo2.ph += d2);
    this.bDt1[b + 1] = this.bDt1[b]; this.bDt2[b + 1] = this.bDt2[b]; this.bPw1[b + 1] = this.bPw1[b]; this.bPw2[b + 1] = this.bPw2[b];
    this.bG1[b + 1] = this.bG1[b]; this.bG2[b + 1] = this.bG2[b];
    this.bGain[b + 1] = 0; this.bPanL[b + 1] = this.bPanL[b]; this.bPanR[b + 1] = this.bPanR[b];
    this.bSC[b + 1] = 0; this.bSD[b + 1] = 0; this.bSR[b + 1] = 0;
  }

  /** [STOP]: one block of the cut-off fade */
  cutStep(b) {
    this.cutLeft--;
    this.bGain[b + 1] *= this.cutLeft / this.cutN;
    if (this.cutLeft === 0) this.silence();
  }

  /**
   * Noise, filters, VCA per sample over the quantum. Each control block's settings and the start
   * values and steps of its interpolations are read once per block.
   */
  render(n, L, R, SC, SD, SRv, MO, nbIn) {
    const W1 = this.W1, W2 = this.W2;
    let l0 = this.l0, l1 = this.l1, l2 = this.l2, l3 = this.l3, ic1 = this.ic1, ic2 = this.ic2, lp1 = this.lp1, fb = this.fb;
    let rng = this.rng, nCount = this.nCount, nVal = this.nVal, nHp = this.nHp, pk0 = this.pk0, pk1 = this.pk1, pk2 = this.pk2, nRed = this.nRed;
    const w1 = this.w1, w2 = this.w2, am1 = this.am1, am2 = this.am2, type2 = this.type2;
    const osc1 = w1 <= 3 || this.sub1, osc2 = w2 <= 3 || this.sub2;
    const redK = this.redK, fdbK = this.fdbK;
    const bG1 = this.bG1, bG2 = this.bG2, bGain = this.bGain, bPanL = this.bPanL, bPanR = this.bPanR, bSC = this.bSC, bSD = this.bSD, bSR = this.bSR;
    for (let b = 0, i = 0; i < n; b++) {
      const end = i + BLOCK < n ? i + BLOCK : n, i0 = b * BLOCK;
      const g1a = bG1[b], g1d = bG1[b + 1] - g1a, g2a = bG2[b], g2d = bG2[b + 1] - g2a, ga = bGain[b], gd = bGain[b + 1] - ga;
      const pLa = bPanL[b], pLd = bPanL[b + 1] - pLa, pRa = bPanR[b], pRd = bPanR[b + 1] - pRa;
      const sCa = bSC[b], sCd = bSC[b + 1] - sCa, sDa = bSD[b], sDd = bSD[b + 1] - sDa, sRa = bSR[b], sRd = bSR[b + 1] - sRa;
      const nLev = this.bNLev[b], nHold = this.bNHold[b], nCol = this.bNCol[b], nHpK = this.bNHpK[b], nHpG = this.bNHpG[b];
      const lev1 = this.bLev1[b], lev2 = this.bLev2[b];
      const k1 = this.bK1[b], comp = this.bComp[b], inDrive = this.bInDrive[b], inComp = this.bInComp[b];
      const om = this.bOvr[b], dr = this.bDrive[b], odK = 1.4 / (1 + 0.04 * (dr - 1));
      const k2 = this.bK2[b], pk = this.bPk[b];
      for (; i < end; i++) {
        const f = (i - i0 + 1) / BLOCK;
        const g1 = g1a + g1d * f;
        const g2 = g2a + g2d * f;
        const gain = ga + gd * f;
        // oscillators: delay-compensated output with the presence FIR
        let o1 = osc1 ? FIR_C * W1[i + 1] + FIR_S * (W1[i] + W1[i + 2]) : 0;
        let o2 = osc2 ? FIR_C * W2[i + 1] + FIR_S * (W2[i] + W2[i + 2]) : 0;
        // FDB: the ladder's output, AC-coupled (25 Hz), becomes OSC 1 (manual p.73). LEV sets the loop
        // gain: moderate levels thicken and overload what OSC 2 sends in; above about 100 the loop
        // self-oscillates, its pitch and tone set by the cutoff and resonance
        if (w1 === 6) { lp1 += (fb - lp1) * fdbK; o1 += (fb - lp1) * 2.6; }
        if (w2 === 6) o2 += nbIn ? nbIn[i] * 2.5 : 0;          // NEI: the neighbour track
        if (am1 || am2) {
          const ag1 = 0.5 + 0.5 * tanhF(o1 * 8), ag2 = 0.5 + 0.5 * tanhF(o2 * 8);
          if (am1) o1 *= ag2;
          if (am2) o2 *= ag1;
        }
        // noise
        let nz = 0;
        if (nLev > 0) {
          if (++nCount >= nHold) {
            nCount = 0;
            rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
            nVal = ((rng >>> 0) / 4294967296) * 2 - 1;
          }
          let wn = nVal;
          if (nCol < 0) {
            // white -> pink (Kellet's 3-pole approximation) -> red (one pole at 20 Hz), equal RMS
            pk0 = 0.99765 * pk0 + nVal * 0.099046; pk1 = 0.963 * pk1 + nVal * 0.2965164; pk2 = 0.57 * pk2 + nVal * 1.0526913;
            const pink = (pk0 + pk1 + pk2 + nVal * 0.1848) * 0.335;
            nRed += (nVal - nRed) * redK;
            const m = -2 * nCol;
            wn = m <= 1 ? nVal + (pink - nVal) * m : pink + (nRed * 26 - pink) * (m - 1);
          } else if (nCol > 0) {
            nHp += (nVal - nHp) * nHpK;
            wn = (nVal - nHp) * nHpG;
          }
          nz = wn * nLev;
        }
        const x = (o1 * lev1 + o2 * lev2 + nz) * 0.5;

        // Filter 1: 4-pole ladder (TPT stages, linear feedback estimate, tanh at the input pair)
        const G = g1 / (1 + g1), ig = 1 / (1 + g1);
        const G2 = G * G, G3 = G2 * G, G4 = G3 * G;
        const sigma = G3 * l0 * ig + G2 * l1 * ig + G * l2 * ig + l3 * ig;
        const xin = x * comp * inDrive;
        const u = tanhF(xin - (k1 * (G4 * xin + sigma)) / (1 + k1 * G4));
        let v = (u - l0) * G; const a1 = v + l0; l0 = a1 + v;
        v = (a1 - l1) * G; const a2 = v + l1; l1 = a2 + v;
        v = (a2 - l2) * G; const a3 = v + l2; l2 = a3 + v;
        v = (a3 - l3) * G; const a4 = v + l3; l3 = a4 + v;
        fb = a4;
        let y = a4 * 1.9 * inComp;
        // Overdrive between the filters
        if (om > 0) y += (tanhF(y * dr) * odK - y) * om;
        // Filter 2: multimode
        const A1 = 1 / (1 + g2 * (g2 + k2)), A2 = g2 * A1, A3 = g2 * A2;
        const v3 = y - ic2;
        const v1 = A1 * ic1 + A2 * v3;
        const v2 = ic2 + A2 * ic1 + A3 * v3;
        ic1 = 2 * v1 - ic1;
        ic2 = 2 * v2 - ic2;
        switch (type2) {
          case 0: y = v2; break;
          case 1: y = v2 + v1; break;                      // LP1: low + band
          case 2: y = v1 * k2; break;
          case 3: y = y - k2 * v1 - v2 + v1; break;        // HP1: high + band
          case 4: y = y - k2 * v1 - v2; break;
          case 5: y = y - k2 * v1; break;
          case 6: y = y + pk * k2 * v1; break;
          default: y = v2;
        }
        // VCA, pan, sends
        const vo = y * gain;
        L[i] = vo * (pLa + pLd * f);
        R[i] = vo * (pRa + pRd * f);
        if (SC) {
          SC[i] = vo * (sCa + sCd * f);
          SD[i] = vo * (sDa + sDd * f);
          SRv[i] = vo * (sRa + sRd * f);
        }
        if (MO) MO[i] = y;
      }
    }
    // carry the oscillator work buffers (latency history and BLEP taps)
    W1[0] = W1[n]; W1[1] = W1[n + 1]; W1[2] = W1[n + 2]; W1[3] = W1[n + 3]; W1[4] = W1[n + 4];
    W2[0] = W2[n]; W2[1] = W2[n + 1]; W2[2] = W2[n + 2]; W2[3] = W2[n + 3]; W2[4] = W2[n + 4];
    l0 = flush(l0); l1 = flush(l1); l2 = flush(l2); l3 = flush(l3); ic1 = flush(ic1); ic2 = flush(ic2); lp1 = flush(lp1);
    if (!Number.isFinite(l0 + l1 + l2 + l3 + ic1 + ic2 + lp1)) { l0 = l1 = l2 = l3 = ic1 = ic2 = lp1 = 0; fb = 0; }
    this.l0 = l0; this.l1 = l1; this.l2 = l2; this.l3 = l3; this.ic1 = ic1; this.ic2 = ic2; this.lp1 = lp1; this.fb = fb;
    this.rng = rng; this.nCount = nCount; this.nVal = nVal; this.nHp = flush(nHp);
    this.pk0 = flush(pk0); this.pk1 = flush(pk1); this.pk2 = flush(pk2); this.nRed = flush(nRed);
  }
}

// ============================================================================
// FX parameters: the FX track's base values, locks, FX LFOs and value mapping.
// Output 0 channels (absolute values, constant per render quantum):
// ============================================================================

const FXC = {
  CHO_RATE: 0, CHO_DEPTH: 1, CHO_DELAY: 2, CHO_FB: 3, CHO_WIDTH: 4,
  REV_PRE: 5, REV_DECAY: 6, REV_SIZE: 7, REV_DAMP: 8, REV_WIDTH: 9,
  DEL_TIME: 10, DEL_X: 11, DEL_WID: 12, DEL_FB: 13, DEL_HP: 14, DEL_LP: 15, DEL_DRIVE: 16, DEL_TOREV: 17, DEL_VOL: 18,
  CHO_TODEL: 19, CHO_TOREV: 20, CHO_VOL: 21, RET: 22, REV_VOL: 23, FADE: 24,
};
const FX_CHANNELS = 25;
// AudioParam minimums the outputs are offset against (the params' intrinsic value is set to these)
const FX_MIN = { 0: 0.01, 1: 0, 2: 0.0005, 3: -0.95, 4: 0, 5: 0, 6: 0.1, 7: 0, 8: 200, 9: 0 };

class A4FxMod extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bpm = this.fade = this.fadeTo = this.fadeSec = D;   // doubles from the start (see D)
    const o = (options && options.processorOptions) || {};
    const keys = o.keys || [];
    const I = {};
    keys.forEach((k, i) => (I[k] = i));
    this.I = I;
    this.N = keys.length;
    this.P = new Float32Array(this.N);
    this.O = new Float32Array(this.N);
    this.M = new Float32Array(this.N);
    this.mins = Float32Array.from(o.mins || []);
    this.maxs = Float32Array.from(o.maxs || []);
    (o.defs || []).forEach((v, i) => (this.P[i] = v));
    this.dests = (o.dests || []).map(d => ({ idx: d.key ? I[d.key] : undefined, range: d.range }));
    this.q = [];
    this.bpm = 120;
    this.lfo = [new Lfo(), new Lfo()];
    this.li = [1, 2].map(n => {
      const pre = `fxlfo${n}_`;
      return { spd: I[pre + 'spd'], mul: I[pre + 'mul'], fad: I[pre + 'fad'], sph: I[pre + 'sph'], mod: I[pre + 'mod'], wav: I[pre + 'wav'],
        dst: [I[pre + 'dsta'], I[pre + 'dstb']], dep: [I[pre + 'depa'], I[pre + 'depb']] };
    });
    this.val = new Float64Array(FX_CHANNELS);
    this.fade = 1; this.fadeTo = 1; this.fadeSec = 0.3;
    this.port.onmessage = e => {
      const m = e.data;
      if (m.t === 'fade') { this.fadeTo = 0; this.fadeSec = m.dur || 0.3; }
      else if (m.t === 'unfade') { this.fadeTo = 1; this.fadeSec = m.dur || 0.02; }
      else if (m.t === 'p') { const l = m.list; for (let k = 0; k < l.length; k += 2) this.P[l[k]] = l[k + 1]; }
      else if (m.t === 'off2') { this.O.fill(0); const l = m.list; for (let k = 0; k < l.length; k += 2) this.O[l[k]] = l[k + 1]; }
      else if (m.t === 'bpm') this.bpm = m.v;
      else enqueue(this.q, m);
    };
  }
  E(k) {
    const i = this.I[k];
    if (i === undefined) return 0;
    const v = this.P[i] + this.O[i] + this.M[i];
    return v < this.mins[i] ? this.mins[i] : v > this.maxs[i] ? this.maxs[i] : v;
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const n = out[0].length;
    const sr = sampleRate;
    const now = currentTime;
    const P = this.P, I = this.I;
    const q = this.q;
    while (q.length && q[0].time <= now + n / sr) {
      const ev = q.shift();
      if (ev.t === 'at') { const l = ev.list; for (let k = 0; k < l.length; k += 2) P[l[k]] = l[k + 1]; }
      else if (ev.t === 'trig') for (let k = 0; k < 2; k++) {
        const li = this.li[k];
        this.lfo[k].trig(Math.round(P[li.mod]), P[li.sph] / 128, P[li.fad]);
      }
    }
    // FX LFOs (per quantum)
    this.M.fill(0);
    const dt = n / sr;
    for (let k = 0; k < 2; k++) {
      const li = this.li[k];
      const v = this.lfo[k].tick(dt, lfoHz(P[li.spd], Math.round(P[li.mul]), this.bpm), Math.round(P[li.wav]), Math.round(P[li.mod]), P[li.fad]);
      for (let s = 0; s < 2; s++) {
        const d = this.dests[Math.round(P[li.dst[s]])];
        const dep = P[li.dep[s]];
        if (d && d.idx !== undefined && dep !== 0) this.M[d.idx] += (dep / 128) * v * d.range;
      }
    }
    const E = k => this.E(k);
    const sq = v => sq127(v) * 1.25;
    const val = this.val;
    // chorus (shared 'chorus' node)
    val[FXC.CHO_RATE] = 0.03 * exp2(E('cho_spd') / 14);
    val[FXC.CHO_DEPTH] = (E('cho_dep') / 127) * 0.006;
    val[FXC.CHO_DELAY] = 0.0015 + (E('cho_pre') / 127) * 0.028;
    val[FXC.CHO_FB] = (E('cho_fb') / 127) * 0.85;
    val[FXC.CHO_WIDTH] = E('cho_wid') / 127;
    // reverb (shared 'fdn-reverb' node)
    const dec = E('rev_dec');
    val[FXC.REV_PRE] = (E('rev_pre') / 127) * 0.3;
    val[FXC.REV_DECAY] = dec >= 127 ? 30 : 0.25 * exp2((dec / 127) * 6.2);
    val[FXC.REV_SIZE] = clamp(0.35 + (dec / 127) * 0.6, 0, 1);
    const shelfHz = 400 * exp2(E('rev_frq') / 22);
    val[FXC.REV_DAMP] = clamp(shelfHz * exp2((E('rev_gai') / 127) * 5), 200, 20000);
    val[FXC.REV_WIDTH] = 1;
    // delay (a4-fx)
    val[FXC.DEL_TIME] = Math.min(3.95, (E('del_tim') * (240 / this.bpm)) / 128) * sr;
    val[FXC.DEL_X] = P[I.del_x] >= 0.5 ? 1 : 0;
    val[FXC.DEL_WID] = E('del_wid') / 63;
    val[FXC.DEL_FB] = (E('del_fb') / 127) * 1.08;
    val[FXC.DEL_HP] = E('del_hpf') > 0 ? 1 - Math.exp((-TWO_PI * fltHz(E('del_hpf') * 0.8)) / sr) : 0;
    val[FXC.DEL_LP] = 1 - Math.exp((-TWO_PI * Math.min(20000, fltHz(E('del_lpf')))) / sr);
    const ovr = E('del_ovr') / 127;
    val[FXC.DEL_DRIVE] = 1 + ovr * ovr * 10;
    val[FXC.DEL_TOREV] = sq(E('del_rev')) * 0.8;
    val[FXC.DEL_VOL] = sq(E('del_vol'));
    val[FXC.CHO_TODEL] = sq(E('cho_del')) * 0.8;
    val[FXC.CHO_TOREV] = sq(E('cho_rev')) * 0.8;
    val[FXC.CHO_VOL] = sq(E('cho_vol'));
    const lvl = E('level') / 127;
    val[FXC.RET] = lvl * lvl * 1.6;
    // the send-FX fade: the reverb return follows it, and a faded reverb empties fast
    const fs = dt / Math.max(0.005, this.fadeSec);
    this.fade = this.fadeTo > this.fade ? Math.min(this.fadeTo, this.fade + fs) : Math.max(this.fadeTo, this.fade - fs);
    val[FXC.FADE] = this.fade;
    val[FXC.REV_VOL] = sq(E('rev_vol')) * val[FXC.RET] * this.fade;
    if (this.fade <= 0) val[FXC.REV_DECAY] = FX_MIN[6];
    for (let c = 0; c < FX_CHANNELS && c < out.length; c++) {
      const x = val[c] - (FX_MIN[c] || 0);
      out[c].fill(x);
    }
    return true;
  }
}

/** Output noise floor: uniform, peak NOISE_FLOOR (1e-5 = -100 dBFS) */
const NOISE_FLOOR = 1e-5;
const NOISE_FLOOR_STEP = (2 * NOISE_FLOOR) / 65535;

// ============================================================================
// FX: delay + effect sends + mix. Inputs: [0] sends (cho, del, rev),
// [1] chorus return (stereo), [2] dry (stereo), [3] parameters (a4-fxmod).
// Outputs: [0] dry + chorus + delay (stereo), [1] reverb send (stereo).
// ============================================================================

class A4Fx extends AudioWorkletProcessor {
  constructor() {
    super();
    this.time = this.lpL = this.lpR = this.hpL = this.hpR = this.fd = this.nz = D;   // doubles from the start (see D)
    const sr = sampleRate;
    this.len = Math.ceil(sr * 4);
    this.dL = new Float32Array(this.len); this.dR = new Float32Array(this.len);
    this.w = 0; this.time = 0.375 * sr; this.lpL = 0; this.lpR = 0; this.hpL = 0; this.hpR = 0;
    this.fd = 1; this.empty = false;
    // the analog output stage's noise floor, about -100 dBFS (the manual gives 102 dB S/N, p.85):
    // like the hardware, the output is never digital silence between notes
    this.nz = 0x9e3779b9 | 0;
  }
  read(buf, w, d) {
    let pos = w - d;
    if (pos < 0) pos += this.len;
    const i0 = pos | 0, f = pos - i0;
    const i1 = i0 + 1 >= this.len ? 0 : i0 + 1;
    return buf[i0] + (buf[i1] - buf[i0]) * f;
  }
  process(inputs, outputs) {
    const sends = inputs[0], cho = inputs[1], dry = inputs[2], par = inputs[3];
    const o0 = outputs[0], o1 = outputs[1];
    const OL = o0[0], OR = o0[1], RL = o1[0], RR = o1[1];
    const n = OL.length;
    const pv = c => (par && par[c] ? par[c][0] : 0);
    const tgt = pv(FXC.DEL_TIME) || this.time;
    const X = pv(FXC.DEL_X) > 0.5, wid = pv(FXC.DEL_WID), fbk = pv(FXC.DEL_FB), hp = pv(FXC.DEL_HP), lp = pv(FXC.DEL_LP) || 1;
    const drive = pv(FXC.DEL_DRIVE) || 1, dNorm = 1 / Math.sqrt(drive);
    const toRev = pv(FXC.DEL_TOREV), dVol = pv(FXC.DEL_VOL), cToD = pv(FXC.CHO_TODEL), cToR = pv(FXC.CHO_TOREV), cVol = pv(FXC.CHO_VOL), ret = pv(FXC.RET);
    const fdTo = par && par[FXC.FADE] ? par[FXC.FADE][0] : 1;
    if (fdTo <= 0 && this.fd <= 0) {
      if (!this.empty) { this.dL.fill(0); this.dR.fill(0); this.lpL = this.lpR = this.hpL = this.hpR = 0; this.empty = true; }
    } else this.empty = false;
    let fd = this.fd;
    const fdStep = (fdTo - fd) / OL.length;
    const sD = sends && sends[1], sR = sends && sends[2];
    const cL = cho && cho[0], cR = cho && (cho[1] || cho[0]);
    const dLi = dry && dry[0], dRi = dry && (dry[1] || dry[0]);
    const widOff = Math.abs(wid) * 0.012 * sampleRate;
    const dl = this.dL, dr = this.dR, len = this.len;
    let w = this.w, time = this.time, lpL = this.lpL, lpR = this.lpR, hpL = this.hpL, hpR = this.hpR, nz = this.nz;
    for (let i = 0; i < n; i++) {
      time += (tgt - time) * 0.00035; // tape-style glide when the time changes
      const chl = cL ? cL[i] : 0, chr = cR ? cR[i] : 0;
      const din = (sD ? sD[i] : 0) + 0.5 * (chl + chr) * cToD;
      const eL = this.read(dl, w, Math.max(2, time + (wid < 0 ? widOff : 0)));
      const eR = this.read(dr, w, Math.max(2, time + (wid > 0 ? widOff : 0)));
      let fl = X ? eR : eL, fr = X ? eL : eR;
      lpL += (fl - lpL) * lp; lpR += (fr - lpR) * lp; fl = lpL; fr = lpR;
      if (hp > 0) { hpL += (fl - hpL) * hp; hpR += (fr - hpR) * hp; fl -= hpL; fr -= hpR; }
      fl = tanhF(fl * fbk * drive) * dNorm;
      fr = tanhF(fr * fbk * drive) * dNorm;
      dl[w] = din + fl;
      dr[w] = (X ? 0 : din) + fr;
      w = w + 1 >= len ? 0 : w + 1;
      fd += fdStep;
      const rs = (sR ? sR[i] : 0);
      RL[i] = (rs + chl * cToR + eL * toRev) * fd;
      RR[i] = (rs + chr * cToR + eR * toRev) * fd;
      nz ^= nz << 13; nz ^= nz >>> 17; nz ^= nz << 5;
      const nL = (nz & 0xffff) * NOISE_FLOOR_STEP - NOISE_FLOOR, nR = ((nz >>> 16) & 0xffff) * NOISE_FLOOR_STEP - NOISE_FLOOR;
      OL[i] = (dLi ? dLi[i] : 0) + (chl * cVol + eL * dVol) * ret * fd + nL;
      OR[i] = (dRi ? dRi[i] : 0) + (chr * cVol + eR * dVol) * ret * fd + nR;
    }
    this.nz = nz;
    this.fd = fdTo;
    lpL = flush(lpL); lpR = flush(lpR); hpL = flush(hpL); hpR = flush(hpR);
    if (!Number.isFinite(lpL + lpR + hpL + hpR + time)) { dl.fill(0); dr.fill(0); lpL = lpR = hpL = hpR = 0; time = tgt; }
    this.w = w; this.time = time; this.lpL = lpL; this.lpR = lpR; this.hpL = hpL; this.hpR = hpR;
    return true;
  }
}

registerProcessor('a4-voice', A4Voice);
registerProcessor('a4-fxmod', A4FxMod);
registerProcessor('a4-fx', A4Fx);
