/* eslint-disable */
// ============================================================================
// Analog Four MKII AudioWorklet processors
//
//   'a4-voice'  one complete synth voice per node (4 nodes = 4 tracks):
//                 OSC 1 + SUB 1, OSC 2 + SUB 2 (saw, transistor pulse, pulse,
//                 triangle; sub dividers 1OCT 2OCT 2PUL 5TH; hard/soft sync
//                 1>2, 2>1, metal; AM; per-osc PWM LFO; drift), NOISE (S&H,
//                 colour, fade) -> FILTER 1 4-pole ladder low-pass (tanh
//                 feedback, keytrack, ENV F depth) -> OVERDRIVE -> FILTER 2
//                 2-pole multimode (LP2 LP1 BP HP1 HP2 BS PK) -> VCA (ENV A)
//                 -> PAN -> VOL -> TRACK LEVEL.
//               Modulation: ENV F, ENV 2 (12 shapes, LEN gate), LFO 1/2 (7
//               waves, 5 trig modes, fade, start phase, tempo-synced speed x
//               multiplier), vibrato, velocity mod (5 routes); LFO 2 and the
//               envelopes run first so they can modulate LFO 1.
//               Outputs: [0] dry L/R, [1] sends (chorus, delay, reverb),
//               [2] mono post-VCA signal (the neighbour track's NEI input).
//               Input [0]: the neighbour track's mono signal.
//   'a4-fx'     the FX track and master: chorus -> delay -> reverb (sends and
//               the chorus/delay -> next-effect sends), two FX LFOs, the
//               dry mix, MAIN VOLUME and a soft clip.
//
// Parameters stay in hardware units (0..127, -64..63...). The node receives
// the ordered key list at construction (processorOptions.keys) and is driven
// by port messages, scheduled on the audio clock:
//   { t: 'p', list: [i, v, i, v...] }            set now (smoothed by the DSP)
//   { t: 'at', time, list }                      set at audio time (locks)
//   { t: 'on', time, note, vel, acc, slide }     gate on
//   { t: 'off', time }                           gate off
//   { t: 'ramp', t0, t1, list: [i, from, to...] } parameter slide
//   { t: 'off2', list }                          performance offsets
//   { t: 'bpm', v } / { t: 'step', v }           tempo for synced LFOs / LEN
//   { t: 'reset' }                               silence (stop)
// Control rate: every 16 samples (about 3 kHz); gains, cutoff coefficients
// and oscillator increments are interpolated per sample in between.
// ============================================================================

const BLOCK = 16;
const TWO_PI = Math.PI * 2;

// Fast tanh (Pade), exact enough for saturation stages
function ftanh(x) {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Hardware units -> seconds for envelope stages (0 -> 1 ms, 64 -> 0.13 s, 127 -> 16 s)
const envTime = v => 0.001 * Math.pow(2, (clamp(v, 0, 127) * 14) / 127);
// Filter frequency 0..127 (one semitone a step): 13 Hz .. 20 kHz
const fltHz = v => 13.0 * Math.pow(2, v / 12);

// LFO multipliers (x synced, . fixed at 120 BPM)
const LFO_MUL = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

// Envelope shapes: pairs (shape >> 1) -> [attack curve, decay/release curve, full]
//   attack: 0 linear, 1 analog (fast start), 2 exponential (slow start)
//   decay/release: 0 linear, 1 exponential
const SHAPES = [
  [0, 0, false], // Linear ADR
  [1, 1, false], // Standard
  [2, 0, false], // Exp. attack / linear DR
  [2, 1, false], // Exponential ADR
  [1, 1, true],  // Full ADR (attack and decay always complete)
  [0, 1, true],  // Full attack / exp. DR
];

class Env {
  constructor() {
    this.stage = 0; // 0 idle 1 attack 2 decay 3 sustain 4 release
    this.v = 0;
    this.gate = false;
    this.pendingRelease = false;
    this.gateEnd = Infinity; // LEN gate (sample clock seconds)
    this.x = 0; // attack progress for the exponential curve
  }
  trig(shape, now, lenSec) {
    const restart = (shape & 1) === 1;
    if (restart) { this.v = 0; }
    this.stage = 1;
    this.x = this.v;
    this.gate = true;
    this.pendingRelease = false;
    this.gateEnd = lenSec > 0 ? now + lenSec : Infinity;
  }
  release(shape) {
    const full = SHAPES[shape >> 1][2];
    this.gate = false;
    if (this.stage === 0) return;
    if (full && (this.stage === 1 || this.stage === 2)) { this.pendingRelease = true; return; }
    this.stage = 4;
  }
  // Advance by dt seconds. Returns the new value.
  tick(dt, atk, dec, sus, rel, shape, now, infRelease) {
    if (this.gateEnd !== Infinity && now >= this.gateEnd && this.gate) { this.gateEnd = Infinity; this.release(shape); }
    const s = SHAPES[shape >> 1];
    switch (this.stage) {
      case 1: {
        if (atk <= 0.0011) { this.v = 1; this.stage = 2; break; }
        const inc = dt / atk;
        if (s[0] === 0) this.v += inc;
        else if (s[0] === 1) this.v += (1.32 - this.v) * (1 - Math.exp(-inc * 1.4));
        else { this.x += inc; this.v = Math.max(this.v, this.x * this.x * this.x); }
        if (this.v >= 1) { this.v = 1; this.stage = 2; }
        break;
      }
      case 2: {
        if (s[1] === 0) {
          this.v -= (dt / dec) * (1 - sus + 1e-3);
          if (this.v <= sus) { this.v = sus; this.stage = 3; }
        } else {
          this.v = sus + (this.v - sus) * Math.exp((-dt * 5.0) / dec);
          if (this.v - sus < 1e-4) { this.v = sus; this.stage = 3; }
        }
        if (this.stage === 3 && (this.pendingRelease || !this.gate)) { this.pendingRelease = false; this.stage = 4; }
        break;
      }
      case 3:
        this.v = sus;
        if (!this.gate) this.stage = 4;
        break;
      case 4: {
        if (infRelease) break;
        if (s[1] === 0) this.v -= dt / rel;
        else this.v *= Math.exp((-dt * 5.0) / rel);
        if (this.v <= 1e-4) { this.v = 0; this.stage = 0; }
        break;
      }
      default:
        break;
    }
    return this.v;
  }
}

class Lfo {
  constructor() {
    this.ph = Math.random();
    this.run = true;
    this.left = 0; // remaining travel for ONE / HALF
    this.hold = 0;
    this.holding = false;
    this.fade = 1;
    this.rnd = Math.random() * 2 - 1;
    this.last = 0;
  }
  trig(mode, sph, fad) {
    this.fade = fad < 0 ? 0 : 1;
    if (mode === 0) return;           // FREE
    if (mode === 2) { this.holding = true; this.hold = this.last; return; } // HOLD
    this.holding = false;
    this.ph = sph;
    this.run = true;
    this.left = mode === 3 ? 1 : mode === 4 ? 0.5 : Infinity;
  }
  // Advance; returns the bipolar (or unipolar for EXP/RMP) value
  tick(dt, hz, wave, mode, fad) {
    if (mode !== 2) this.holding = false;
    if (this.run) {
      const d = hz * dt;
      this.ph += d;
      const ad = d < 0 ? -d : d;
      if (this.left !== Infinity) {
        this.left -= ad;
        if (this.left <= 0) { this.run = false; this.ph -= d < 0 ? this.left : -this.left; }
      }
      if (this.ph >= 1 || this.ph < 0) { this.ph -= Math.floor(this.ph); this.rnd = Math.random() * 2 - 1; }
    } else if (mode !== 3 && mode !== 4) this.run = true;
    if (fad !== 0) {
      const secs = 0.02 * Math.pow(2, Math.abs(fad) / 8);
      const st = dt / secs;
      this.fade = fad < 0 ? Math.min(1, this.fade + st) : Math.max(0, this.fade - st);
    } else this.fade = 1;
    const p = this.ph;
    let v;
    switch (wave) {
      case 0: v = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4; break;      // TRI (starts at 0)
      case 1: v = Math.sin(TWO_PI * p); break;                                   // SIN
      case 2: v = p < 0.5 ? 1 : -1; break;                                       // SQR
      case 3: v = 1 - 2 * p; break;                                              // SAW (falling)
      case 4: v = Math.exp(-6 * p) * 1.0025 - 0.0025; break;                     // EXP (1 -> 0)
      case 5: v = p; break;                                                      // RMP (0 -> 1)
      default: v = this.rnd;                                                     // RND
    }
    this.last = v;
    return (this.holding ? this.hold : v) * this.fade;
  }
}

function lfoHz(spd, mulIdx, bpm) {
  const m = mulIdx < 12 ? LFO_MUL[mulIdx] : LFO_MUL[mulIdx - 12];
  const tempo = mulIdx < 12 ? bpm : 120;
  return ((spd * m) / 128) * (tempo / 240);
}

// ----------------------------------------------------------------------------
// Event queue (sorted by time; most messages arrive in time order)
// ----------------------------------------------------------------------------
function enqueue(q, ev) {
  let i = q.length;
  while (i > 0 && q[i - 1].time > ev.time) i--;
  q.splice(i, 0, ev);
}

// ============================================================================
// Voice
// ============================================================================

class A4Voice extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    const keys = o.keys || [];
    const I = {};
    keys.forEach((k, i) => (I[k] = i));
    this.I = I;
    this.N = keys.length;
    this.P = new Float32Array(this.N);
    this.O = new Float32Array(this.N);   // performance offsets
    this.M = new Float32Array(this.N);   // modulation sums (per control tick)
    this.mins = new Float32Array(o.mins || this.N);
    this.maxs = new Float32Array(o.maxs || this.N);
    (o.defs || []).forEach((v, i) => (this.P[i] = v));
    // Modulation destinations: index -> [param indices], range
    this.dests = (o.dests || []).map(d => ({ idx: d.keys.map(k => I[k]).filter(x => x !== undefined), range: d.range }));
    this.q = [];
    this.ramps = []; // { i, from, to, t0, t1 }
    this.bpm = 120;
    this.stepSec = 0.125;

    // Voice state
    this.note = 60; this.pitch = 60; this.glideFrom = 60; this.glideT = 0; this.glideTime = 0;
    this.vel = 100 / 127; this.acc = 0; this.gate = false;
    this.envA = new Env(); this.envF = new Env(); this.env2 = new Env();
    this.lfo1 = new Lfo(); this.lfo2 = new Lfo();
    this.vibPh = 0; this.vibFade = 1;
    this.pwm1 = Math.random(); this.pwm2 = Math.random();
    this.noiseFade = 1;
    this.drift1 = 0; this.drift2 = 0;
    this.rng = (Math.random() * 0xffffffff) >>> 0 || 1;
    this.nHold = 0; this.nCount = 0; this.nLp = 0;

    // Oscillators: phase, BLEP delayed sample, divider counter, sub state
    this.p1 = Math.random(); this.y1 = 0; this.c1 = 0; this.s1 = -1;
    this.p2 = Math.random(); this.y2 = 0; this.c2 = 0; this.s2 = -1;
    this.dt1 = 0; this.dt2 = 0;
    this.fb = 0; // last ladder output (FDB waveform)
    // Filters
    this.l0 = 0; this.l1 = 0; this.l2 = 0; this.l3 = 0;
    this.ic1 = 0; this.ic2 = 0; this.lp1 = 0;
    this.g1 = 0.1; this.g2 = 0.1;
    // VCA / pan / sends (per-sample interpolation from the last control tick)
    this.gain = 0; this.panL = Math.SQRT1_2; this.panR = Math.SQRT1_2;
    this.sendC = 0; this.sendD = 0; this.sendR = 0;
    this.idle = true;
    this.velMod = 0;

    this.port.onmessage = e => this.msg(e.data);
  }

  msg(m) {
    switch (m.t) {
      case 'p': { const l = m.list; for (let k = 0; k < l.length; k += 2) this.P[l[k]] = l[k + 1]; break; }
      case 'off2': { this.O.fill(0); const l = m.list; for (let k = 0; k < l.length; k += 2) this.O[l[k]] = l[k + 1]; break; }
      case 'bpm': this.bpm = m.v; break;
      case 'step': this.stepSec = m.v; break;
      case 'reset': this.q.length = 0; this.ramps.length = 0; this.gate = false; this.envA.release(2); this.envF.release(2); this.env2.release(2); break;
      default: enqueue(this.q, m);
    }
  }

  // Effective value of a parameter (base + performance offset + modulation), clamped
  E(i) {
    const v = this.P[i] + this.O[i] + this.M[i];
    return v < this.mins[i] ? this.mins[i] : v > this.maxs[i] ? this.maxs[i] : v;
  }

  noteOn(ev, now) {
    const I = this.I, P = this.P;
    const legato = ev.slide && this.gate;
    this.note = ev.note;
    this.vel = Math.max(1, ev.vel) / 127;
    this.acc = ev.acc ? 1 : 0;
    // Glide: slide trigs always, portamento ON always, LEG between overlapping notes
    const prt = P[I.snd_prt];
    const glide = ev.slide || prt === 1 || (prt === 2 && this.gate && ev.live);
    if (glide) {
      const sli = this.E(I.osc_sli);
      this.glideFrom = this.pitch;
      this.glideTime = 0.008 * Math.pow(2, (sli / 127) * 9);
      this.glideT = 0;
    } else {
      this.pitch = ev.note; this.glideTime = 0;
    }
    const retrigEnv = !(legato || (P[I.snd_leg] >= 0.5 && this.gate && ev.live));
    this.gate = true;
    if (retrigEnv) {
      const lenF = P[I.envf_len], len2 = P[I.env2_len];
      const lsec = v => (v > 0 ? 0.125 * Math.pow(2, ((v - 1) / 126) * 10) * this.stepSec : 0);
      this.envA.trig(Math.round(P[I.amp_shp]), now, 0);
      this.envF.trig(Math.round(P[I.envf_shp]), now, lsec(lenF));
      this.env2.trig(Math.round(P[I.env2_shp]), now, lsec(len2));
      this.lfo1.trig(Math.round(P[I.lfo1_mod]), this.E(I.lfo1_sph) / 128, P[I.lfo1_fad]);
      this.lfo2.trig(Math.round(P[I.lfo2_mod]), this.E(I.lfo2_sph) / 128, P[I.lfo2_fad]);
      this.vibFade = P[I.osc_vfa] < 0 ? 0 : 1;
      const fad = P[I.noise_fad];
      this.noiseFade = fad > 0 ? 1 : fad < 0 ? 0 : 1;
      if (P[I.osc_trg] >= 0.5) { this.p1 = 0; this.p2 = 0; this.c1 = 0; this.c2 = 0; }
    }
    // Velocity modulation is fixed per note
    this.velMod = this.vel;
    this.idle = false;
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
    for (let k = 0; k < d.idx.length; k++) this.M[d.idx[k]] += a;
  }

  // One control tick: modulation, envelopes, coefficients
  control(now, dt) {
    const I = this.I, P = this.P, M = this.M;
    M.fill(0);
    // Velocity modulation (5 routes)
    const vm = this.velMod;
    for (let n = 1; n <= 5; n++) {
      const dep = P[I['vmod_dep' + n]];
      if (dep !== 0) this.route(Math.round(P[I['vmod_dst' + n]]), (dep / 128) * vm);
    }
    // ENV F and ENV 2 (their own params may be modulated by velocity)
    const ef = this.envF.tick(dt, envTime(this.E(I.envf_atk)), envTime(this.E(I.envf_dec)), this.E(I.envf_sus) / 127,
      envTime(this.E(I.envf_rel)), Math.round(P[I.envf_shp]), now, P[I.envf_rel] >= 127);
    const e2 = this.env2.tick(dt, envTime(this.E(I.env2_atk)), envTime(this.E(I.env2_dec)), this.E(I.env2_sus) / 127,
      envTime(this.E(I.env2_rel)), Math.round(P[I.env2_shp]), now, P[I.env2_rel] >= 127);
    this.route(Math.round(P[I.envf_dsta]), (this.E(I.envf_depa) / 128) * ef);
    this.route(Math.round(P[I.envf_dstb]), (this.E(I.envf_depb) / 128) * ef);
    this.route(Math.round(P[I.env2_dsta]), (this.E(I.env2_depa) / 128) * e2);
    this.route(Math.round(P[I.env2_dstb]), (this.E(I.env2_depb) / 128) * e2);
    // LFO 2, then LFO 1 (which LFO 2 and the envelopes may modulate)
    const l2 = this.lfo2.tick(dt, lfoHz(this.E(I.lfo2_spd), Math.round(P[I.lfo2_mul]), this.bpm), Math.round(P[I.lfo2_wav]), Math.round(P[I.lfo2_mod]), this.E(I.lfo2_fad));
    this.route(Math.round(P[I.lfo2_dsta]), (this.E(I.lfo2_depa) / 128) * l2);
    this.route(Math.round(P[I.lfo2_dstb]), (this.E(I.lfo2_depb) / 128) * l2);
    const l1 = this.lfo1.tick(dt, lfoHz(this.E(I.lfo1_spd), Math.round(P[I.lfo1_mul]), this.bpm), Math.round(P[I.lfo1_wav]), Math.round(P[I.lfo1_mod]), this.E(I.lfo1_fad));
    this.route(Math.round(P[I.lfo1_dsta]), (this.E(I.lfo1_depa) / 128) * l1);
    this.route(Math.round(P[I.lfo1_dstb]), (this.E(I.lfo1_depb) / 128) * l1);

    // Amp envelope
    const ea = this.envA.tick(dt, envTime(this.E(I.amp_atk)), envTime(this.E(I.amp_dec)), this.E(I.amp_sus) / 127,
      envTime(this.E(I.amp_rel)), Math.round(P[I.amp_shp]), now, P[I.amp_rel] >= 127);

    // Glide
    if (this.glideTime > 0) {
      this.glideT += dt;
      const k = Math.min(1, this.glideT / this.glideTime);
      const s = k * k * (3 - 2 * k);
      this.pitch = this.glideFrom + (this.note - this.glideFrom) * s;
      if (k >= 1) this.glideTime = 0;
    } else this.pitch = this.note;

    // Vibrato and drift
    const vsp = 0.5 * Math.pow(2, this.E(I.osc_vsp) / 26);
    this.vibPh += vsp * dt; if (this.vibPh >= 1) this.vibPh -= 1;
    const vfa = P[I.osc_vfa];
    if (vfa !== 0) {
      const secs = 0.02 * Math.pow(2, Math.abs(vfa) / 8);
      this.vibFade = vfa < 0 ? Math.min(1, this.vibFade + dt / secs) : Math.max(0, this.vibFade - dt / secs);
    } else this.vibFade = 1;
    const vib = Math.sin(TWO_PI * this.vibPh) * (this.E(I.osc_vib) / 127) * 0.6 * this.vibFade;
    if (P[I.snd_drf] >= 0.5) {
      this.drift1 = this.drift1 * 0.9996 + (Math.random() - 0.5) * 0.0016;
      this.drift2 = this.drift2 * 0.9996 + (Math.random() - 0.5) * 0.0016;
    } else { this.drift1 = 0; this.drift2 = 0; }

    // Oscillator frequencies
    const base1 = (P[I.osc1_trk] >= 0.5 ? this.pitch : 60) + this.E(I.osc1_tun) + this.E(I.osc1_fin) / 128 + this.M[I.osc1_pmod] + vib + this.drift1 * 0.06;
    const base2 = (P[I.osc2_trk] >= 0.5 ? this.pitch : 60) + this.E(I.osc2_tun) + this.E(I.osc2_fin) / 128 + this.M[I.osc2_pmod] + vib + this.drift2 * 0.06;
    const hz1 = Math.max(0.5, 440 * Math.pow(2, (base1 - 69) / 12) + this.E(I.osc1_det) * 0.125);
    const hz2 = Math.max(0.5, 440 * Math.pow(2, (base2 - 69) / 12) + this.E(I.osc2_det) * 0.125);
    this.tdt1 = Math.min(0.45, hz1 / sampleRate);
    this.tdt2 = Math.min(0.45, hz2 / sampleRate);

    // PWM LFOs (triangle)
    this.pwm1 += 0.1 * Math.pow(2, this.E(I.osc1_spd) / 16) * dt; if (this.pwm1 >= 1) this.pwm1 -= 1;
    this.pwm2 += 0.1 * Math.pow(2, this.E(I.osc2_spd) / 16) * dt; if (this.pwm2 >= 1) this.pwm2 -= 1;
    const tri = p => (p < 0.5 ? 4 * p - 1 : 3 - 4 * p);
    this.pw1 = clamp(0.5 + (this.E(I.osc1_pw) / 64) * 0.47 + tri(this.pwm1) * (this.E(I.osc1_pwm) / 127) * 0.45, 0.02, 0.98);
    this.pw2 = clamp(0.5 + (this.E(I.osc2_pw) / 64) * 0.47 + tri(this.pwm2) * (this.E(I.osc2_pwm) / 127) * 0.45, 0.02, 0.98);
    this.lev1 = this.E(I.osc1_lev) / 127;
    this.lev2 = this.E(I.osc2_lev) / 127;

    // Noise
    const fad = P[I.noise_fad];
    if (fad !== 0) {
      const secs = 0.005 * Math.pow(2, Math.abs(fad) / 7);
      this.noiseFade = fad > 0 ? Math.max(0, this.noiseFade - dt / secs) : Math.min(1, this.noiseFade + dt / secs);
    } else this.noiseFade = 1;
    this.nLev = (this.E(I.noise_lev) / 127) * this.noiseFade * 0.9;
    const snh = this.E(I.noise_snh) / 127;
    this.nHold = snh <= 0 ? 1 : Math.round(1 + snh * snh * 360);
    const col = this.E(I.noise_col) / 64;
    // colour: one-pole low-pass at a cutoff that falls for negative and a high-pass blend for positive
    this.nColLp = col < 0 ? 1 - Math.exp(-TWO_PI * (18000 * Math.pow(0.012, -col)) / sampleRate) : 1;
    this.nColHp = col > 0 ? col : 0;
    this.nHpCoef = 1 - Math.exp(-TWO_PI * 600 / sampleRate);

    // Filter 1 (ladder)
    const semis = this.pitch - 60;
    const f1 = this.E(I.flt1_frq) + (this.E(I.flt1_trk) / 32) * semis + this.E(I.flt1_dep) * 2 * ef;
    const fc1 = Math.min(sampleRate * 0.45, fltHz(clamp(f1, -20, 140)));
    this.tg1 = Math.tan((Math.PI * fc1) / sampleRate);
    const r1 = this.E(I.flt1_res) / 127;
    this.k1 = 4.3 * Math.pow(r1, 1.3);
    this.comp1 = P[I.snd_bst] >= 0.5 ? 1 + this.k1 * 0.45 : 1 + this.k1 * 0.08;
    const ovr = this.E(I.flt1_ovr) / 127;
    this.drive = 1 + ovr * ovr * 24;
    this.ovrMix = Math.min(1, ovr * 12);
    // Filter 2 (multimode)
    const f2 = this.E(I.flt2_frq) + (this.E(I.flt2_trk) / 32) * semis + this.E(I.flt2_dep) * 2 * ef;
    const fc2 = Math.min(sampleRate * 0.45, fltHz(clamp(f2, -20, 140)));
    this.tg2 = Math.tan((Math.PI * fc2) / sampleRate);
    const r2 = this.E(I.flt2_res) / 127;
    this.type2 = Math.round(P[I.flt2_typ]);
    this.k2 = this.type2 === 6 ? 1.2 : 2 - 1.94 * Math.pow(r2, 0.8);
    this.pk = this.type2 === 6 ? r2 * 3 : 0;

    // VCA: envelope x velocity x accent x volume x track level
    const vol = this.E(I.amp_vol) / 127, lvl = this.E(I.level) / 127;
    const acc = 1 + this.acc * (this.E(I.snd_acc) / 127);
    this.tgain = ea * (0.08 + 0.92 * this.vel) * acc * vol * vol * 1.6 * lvl * lvl * 1.6;
    const pan = (clamp(this.E(I.amp_pan), -64, 64) + 64) / 128;
    this.tpanL = Math.cos(pan * Math.PI * 0.5);
    this.tpanR = Math.sin(pan * Math.PI * 0.5);
    const sg = v => { const x = v / 127; return x * x; };
    this.tsendC = sg(this.E(I.amp_cho));
    this.tsendD = sg(this.E(I.amp_del));
    this.tsendR = sg(this.E(I.amp_rev));

    // Switches
    this.w1 = Math.round(P[I.osc1_wav]); this.w2 = Math.round(P[I.osc2_wav]);
    this.sub1 = Math.round(P[I.osc1_sub]); this.sub2 = Math.round(P[I.osc2_sub]);
    this.smd = Math.round(P[I.osc_smd]);
    this.snc = this.E(I.osc_snc) / 127;
    this.am1 = P[I.osc_am1] >= 0.5; this.am2 = P[I.osc_am2] >= 0.5;

    return ea;
  }

  process(inputs, outputs) {
    const out0 = outputs[0], out1 = outputs[1], out2 = outputs[2];
    const L = out0[0], R = out0[1] || out0[0];
    const SC = out1 && out1[0], SD = out1 && out1[1], SR_ = out1 && out1[2];
    const MO = out2 && out2[0];
    const nb = inputs[0] && inputs[0][0];
    const n = L.length;
    const sr = sampleRate;
    const t0 = currentTime;
    const dtBlock = BLOCK / sr;
    const I = this.I, P = this.P;

    for (let b = 0; b < n; b += BLOCK) {
      const now = t0 + b / sr;
      // Events due now
      const q = this.q;
      while (q.length && q[0].time <= now + 1e-6) {
        const ev = q.shift();
        if (ev.t === 'at') { const l = ev.list; for (let k = 0; k < l.length; k += 2) P[l[k]] = l[k + 1]; }
        else if (ev.t === 'on') this.noteOn(ev, now);
        else if (ev.t === 'off') this.noteOff();
        else if (ev.t === 'ramp') { const l = ev.list; for (let k = 0; k < l.length; k += 3) this.ramps.push({ i: l[k], from: l[k + 1], to: l[k + 2], t0: ev.time, t1: ev.t1 }); }
      }
      if (this.ramps.length) {
        for (let r = this.ramps.length - 1; r >= 0; r--) {
          const rp = this.ramps[r];
          const k = rp.t1 > rp.t0 ? clamp((now - rp.t0) / (rp.t1 - rp.t0), 0, 1) : 1;
          P[rp.i] = rp.from + (rp.to - rp.from) * k;
          if (k >= 1) this.ramps.splice(r, 1);
        }
      }

      // Idle voice: nothing sounding, skip the audio (LFOs keep their phase loosely)
      if (this.idle && this.envA.stage === 0) {
        for (let i = b; i < b + BLOCK && i < n; i++) {
          L[i] = 0; R[i] = 0; if (SC) { SC[i] = 0; SD[i] = 0; SR_[i] = 0; } if (MO) MO[i] = 0;
        }
        this.lfo1.ph = (this.lfo1.ph + lfoHz(P[I.lfo1_spd], Math.round(P[I.lfo1_mul]), this.bpm) * dtBlock) % 1;
        if (this.lfo1.ph < 0) this.lfo1.ph += 1;
        this.lfo2.ph = (this.lfo2.ph + lfoHz(P[I.lfo2_spd], Math.round(P[I.lfo2_mul]), this.bpm) * dtBlock) % 1;
        if (this.lfo2.ph < 0) this.lfo2.ph += 1;
        this.gain = 0;
        continue;
      }

      const ea = this.control(now, dtBlock);
      if (this.envA.stage === 0 && ea <= 1e-5 && !this.gate) this.idle = true;

      // Per-sample interpolation targets
      const inv = 1 / BLOCK;
      const dG = (this.tgain - this.gain) * inv;
      const dPL = (this.tpanL - this.panL) * inv, dPR = (this.tpanR - this.panR) * inv;
      const dSC = (this.tsendC - this.sendC) * inv, dSD = (this.tsendD - this.sendD) * inv, dSR = (this.tsendR - this.sendR) * inv;
      const dg1 = (this.tg1 - this.g1) * inv, dg2 = (this.tg2 - this.g2) * inv;
      const dd1 = (this.tdt1 - this.dt1) * inv, dd2 = (this.tdt2 - this.dt2) * inv;

      let p1 = this.p1, p2 = this.p2, y1 = this.y1, y2 = this.y2;
      let c1 = this.c1, c2 = this.c2, s1 = this.s1, s2 = this.s2;
      let l0 = this.l0, l1 = this.l1, l2 = this.l2, l3 = this.l3, ic1 = this.ic1, ic2 = this.ic2, lp1 = this.lp1;
      let gain = this.gain, panL = this.panL, panR = this.panR, sC = this.sendC, sD = this.sendD, sR = this.sendR;
      let g1 = this.g1, g2 = this.g2, dt1 = this.dt1, dt2 = this.dt2;
      const w1 = this.w1, w2 = this.w2, sub1 = this.sub1, sub2 = this.sub2, smd = this.smd, snc = this.snc;
      const pw1 = this.pw1, pw2 = this.pw2, lev1 = this.lev1, lev2 = this.lev2;
      const k1 = this.k1, comp1 = this.comp1, drive = this.drive, ovrMix = this.ovrMix, driveNorm = 1 / (1 + 0.04 * (this.drive - 1));
      const k2 = this.k2, type2 = this.type2, pk = this.pk;
      const am1 = this.am1, am2 = this.am2;
      let rng = this.rng, nCount = this.nCount, nVal = this.nVal || 0, nLp = this.nLp, nHpS = this.nHpS || 0;
      const nHold = this.nHold, nLev = this.nLev, nColLp = this.nColLp, nColHp = this.nColHp, nHpCoef = this.nHpCoef;
      let fb = this.fb;

      for (let i = b; i < b + BLOCK && i < n; i++) {
        gain += dG; panL += dPL; panR += dPR; sC += dSC; sD += dSD; sR += dSR;
        g1 += dg1; g2 += dg2; dt1 += dd1; dt2 += dd2;

        // ---- Oscillators (polyBLEP with one sample of delay: corrections go to the previous and current sample)
        let cur1 = 0, cur2 = 0;
        let wrap1 = -1, wrap2 = -1; // fraction since wrap, -1 = none
        // OSC 1
        let q1 = p1 + dt1;
        if (q1 >= 1) { q1 -= 1; wrap1 = q1 / dt1; }
        let q2 = p2 + dt2;
        if (q2 >= 1) { q2 -= 1; wrap2 = q2 / dt2; }

        // Sync (1>2: osc1 resets osc2; 2>1: osc2 resets osc1; metal: both)
        let reset2 = -1, reset1 = -1;
        if ((smd === 1 || smd === 3) && wrap1 >= 0 && snc > 0) reset2 = wrap1;
        else if ((smd === 2 || smd === 3) && wrap2 >= 0 && snc > 0) reset1 = wrap2;

        // osc 1 value and edges
        if (reset1 >= 0) {
          const pAt = p1 + dt1 * (1 - reset1);
          const pat = pAt - Math.floor(pAt);
          const pNew = pat * (1 - snc);
          const J = this.wave(w1, pNew, pw1) - this.wave(w1, pat, pw1);
          y1 += 0.5 * J * reset1 * reset1;
          cur1 -= 0.5 * J * (1 - reset1) * (1 - reset1);
          q1 = pNew + dt1 * reset1;
          wrap1 = reset1; // the divider counts the reset
        } else {
          cur1 += this.edges(w1, p1, q1, dt1, wrap1, pw1, 1);
          y1 += this.preCorr; // corrections for the previous sample
        }
        cur1 += this.wave(w1, q1, pw1);
        if (sub1 && wrap1 >= 0) {
          c1 = (c1 + 1) % (sub1 === 1 ? 2 : sub1 === 4 ? 3 : 4);
          const ns = (sub1 === 1 ? c1 < 1 : sub1 === 2 ? c1 < 2 : c1 < 1) ? 1 : -1;
          if (ns !== s1) {
            const J = (ns - s1) * 0.7;
            y1 += 0.5 * J * wrap1 * wrap1;
            cur1 -= 0.5 * J * (1 - wrap1) * (1 - wrap1);
            s1 = ns;
          }
        }
        if (sub1) cur1 += s1 * 0.7 - (sub1 === 3 ? -0.35 : sub1 === 4 ? -0.233 : 0);

        // osc 2
        if (reset2 >= 0) {
          const pAt = p2 + dt2 * (1 - reset2);
          const pat = pAt - Math.floor(pAt);
          const pNew = pat * (1 - snc);
          const J = this.wave(w2, pNew, pw2) - this.wave(w2, pat, pw2);
          y2 += 0.5 * J * reset2 * reset2;
          cur2 -= 0.5 * J * (1 - reset2) * (1 - reset2);
          q2 = pNew + dt2 * reset2;
          wrap2 = reset2;
        } else {
          cur2 += this.edges(w2, p2, q2, dt2, wrap2, pw2, 2);
          y2 += this.preCorr;
        }
        cur2 += this.wave(w2, q2, pw2);
        if (sub2 && wrap2 >= 0) {
          c2 = (c2 + 1) % (sub2 === 1 ? 2 : sub2 === 4 ? 3 : 4);
          const ns = (sub2 === 1 ? c2 < 1 : sub2 === 2 ? c2 < 2 : c2 < 1) ? 1 : -1;
          if (ns !== s2) {
            const J = (ns - s2) * 0.7;
            y2 += 0.5 * J * wrap2 * wrap2;
            cur2 -= 0.5 * J * (1 - wrap2) * (1 - wrap2);
            s2 = ns;
          }
        }
        if (sub2) cur2 += s2 * 0.7 - (sub2 === 3 ? -0.35 : sub2 === 4 ? -0.233 : 0);
        p1 = q1; p2 = q2;

        // Special waveforms: filter feedback (osc 1), neighbour (osc 2)
        let o1 = y1, o2 = y2;
        if (w1 === 6) o1 = fb * 1.6;
        else if (w1 >= 4) o1 = 0;
        if (w2 === 6) o2 = nb ? nb[i] * 2.5 : 0;
        else if (w2 >= 4) o2 = 0;
        y1 = cur1; y2 = cur2;
        // AM
        if (am1) o1 = o1 * (0.5 + 0.5 * o2);
        if (am2) o2 = o2 * (0.5 + 0.5 * y1);

        // Noise
        let nz = 0;
        if (nLev > 0) {
          if (++nCount >= nHold) {
            nCount = 0;
            rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
            nVal = ((rng >>> 0) / 4294967296) * 2 - 1;
          }
          nLp += (nVal - nLp) * nColLp;
          nHpS += (nLp - nHpS) * nHpCoef;
          nz = (nLp + (nLp - nHpS) * nColHp * 1.5) * nLev;
        }

        const x = (o1 * lev1 + o2 * lev2 + nz) * 0.5;

        // ---- Filter 1: 4-pole ladder (TPT stages, tanh in the feedback path)
        const G = g1 / (1 + g1);
        const ig = 1 / (1 + g1);
        const S1 = l0 * ig, S2 = l1 * ig, S3 = l2 * ig, S4 = l3 * ig;
        const G2 = G * G, G3 = G2 * G, G4 = G3 * G;
        const sigma = G3 * S1 + G2 * S2 + G * S3 + S4;
        const xin = x * comp1;
        const y4e = (G4 * xin + sigma) / (1 + k1 * G4);
        const u = ftanh(xin - k1 * y4e);
        let v = (u - l0) * G; const a1 = v + l0; l0 = a1 + v;
        v = (a1 - l1) * G; const a2 = v + l1; l1 = a2 + v;
        v = (a2 - l2) * G; const a3 = v + l2; l2 = a3 + v;
        v = (a3 - l3) * G; const a4 = v + l3; l3 = a4 + v;
        fb = a4;
        let y = a4 * 1.9;

        // ---- Overdrive (between the filters)
        if (ovrMix > 0) y = y + (ftanh(y * drive) * driveNorm * 1.4 - y) * ovrMix;

        // ---- Filter 2: 2-pole multimode (TPT SVF) / one-poles
        if (type2 === 1 || type2 === 3) {
          const Gp = g2 / (1 + g2);
          const vv = (y - lp1) * Gp;
          const lo = vv + lp1;
          lp1 = lo + vv;
          y = type2 === 1 ? lo : y - lo;
        } else {
          const A1 = 1 / (1 + g2 * (g2 + k2));
          const A2 = g2 * A1, A3 = g2 * A2;
          const v3 = y - ic2;
          const v1 = A1 * ic1 + A2 * v3;
          const v2 = ic2 + A2 * ic1 + A3 * v3;
          ic1 = 2 * v1 - ic1;
          ic2 = 2 * v2 - ic2;
          switch (type2) {
            case 0: y = v2; break;                       // LP2
            case 2: y = v1 * k2; break;                  // BP (unity at the peak)
            case 4: y = y - k2 * v1 - v2; break;         // HP2
            case 5: y = y - k2 * v1; break;              // BS
            case 6: y = y + pk * k2 * v1; break;         // PK
            default: y = v2;
          }
        }

        // ---- VCA, pan, sends
        const vo = y * gain;
        L[i] = vo * panL;
        R[i] = vo * panR;
        if (SC) { SC[i] = vo * sC; SD[i] = vo * sD; SR_[i] = vo * sR; }
        if (MO) MO[i] = vo;
      }

      if (!Number.isFinite(l0 + l1 + l2 + l3 + ic1 + ic2 + lp1 + y1 + y2)) {
        l0 = l1 = l2 = l3 = ic1 = ic2 = lp1 = 0; y1 = y2 = 0; fb = 0;
      }
      this.p1 = p1; this.p2 = p2; this.y1 = y1; this.y2 = y2;
      this.c1 = c1; this.c2 = c2; this.s1 = s1; this.s2 = s2;
      this.l0 = l0; this.l1 = l1; this.l2 = l2; this.l3 = l3; this.ic1 = ic1; this.ic2 = ic2; this.lp1 = lp1;
      this.gain = gain; this.panL = panL; this.panR = panR; this.sendC = sC; this.sendD = sD; this.sendR = sR;
      this.g1 = g1; this.g2 = g2; this.dt1 = dt1; this.dt2 = dt2;
      this.rng = rng; this.nCount = nCount; this.nVal = nVal; this.nLp = nLp; this.nHpS = nHpS; this.fb = fb;
    }
    return true;
  }

  // Naive waveform value at phase p
  wave(w, p, pw) {
    switch (w) {
      case 0: return 2 * p - 1;                                        // SAW
      case 1: return p < pw ? 1 - 0.7 * (p / pw) - (pw * 0.65 - (1 - pw)) * 0 - this.trpDc(pw) : -1 - this.trpDc(pw); // TRP
      case 2: return (p < pw ? 1 : -1) - (2 * pw - 1);                  // PUL (DC removed)
      case 3: return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;                  // TRI
      default: return 0;
    }
  }

  trpDc(pw) {
    // mean of the transistor pulse: pw * (1 - 0.35) - (1 - pw)
    return pw * 0.65 - (1 - pw);
  }

  // BLEP corrections for the edges between phase p (previous) and q (current).
  // Returns the correction for the current sample; leaves the previous-sample
  // correction in this.preCorr.
  edges(w, p, q, dt, wrapFrac, pw, which) {
    let cur = 0, pre = 0;
    if (w === 0) {
      if (wrapFrac >= 0) { const J = -2; pre += 0.5 * J * wrapFrac * wrapFrac; cur -= 0.5 * J * (1 - wrapFrac) * (1 - wrapFrac); }
    } else if (w === 1 || w === 2) {
      const hiEnd = w === 1 ? 0.3 : 1; // value at the end of the high segment
      if (wrapFrac >= 0) {
        // rising edge at the wrap: from -1 to +1
        const J = 2;
        pre += 0.5 * J * wrapFrac * wrapFrac; cur -= 0.5 * J * (1 - wrapFrac) * (1 - wrapFrac);
        if (q >= pw) { const d = (q - pw) / dt; const J2 = -(hiEnd + 1); pre += 0.5 * J2 * d * d; cur -= 0.5 * J2 * (1 - d) * (1 - d); }
      } else if (p < pw && q >= pw) {
        const d = (q - pw) / dt; const J = -(hiEnd + 1);
        pre += 0.5 * J * d * d; cur -= 0.5 * J * (1 - d) * (1 - d);
      }
    }
    this.preCorr = pre;
    void which;
    return cur;
  }
}

// ============================================================================
// FX track: chorus, delay, reverb, FX LFOs, master
// ============================================================================

const REV_LENS = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]; // samples at 44.1 kHz (Freeverb-like primes)

class A4Fx extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    const keys = o.keys || [];
    const I = {};
    keys.forEach((k, i) => (I[k] = i));
    this.I = I;
    this.N = keys.length;
    this.P = new Float32Array(this.N);
    this.O = new Float32Array(this.N);
    this.M = new Float32Array(this.N);
    this.mins = new Float32Array(o.mins || this.N);
    this.maxs = new Float32Array(o.maxs || this.N);
    (o.defs || []).forEach((v, i) => (this.P[i] = v));
    this.dests = (o.dests || []).map(d => ({ idx: d.key ? I[d.key] : undefined, range: d.range }));
    this.q = [];
    this.bpm = 120;
    this.mvol = 0.6;
    const sr = sampleRate;

    // Chorus: two modulated lines
    this.choLen = Math.ceil(sr * 0.06);
    this.choL = new Float32Array(this.choLen); this.choR = new Float32Array(this.choLen);
    this.choW = 0; this.choPh = 0; this.choFbL = 0; this.choFbR = 0;
    this.choHpL = 0; this.choHpR = 0; this.choLpL = 0; this.choLpR = 0;
    // Delay: stereo, up to 4 s
    this.delLen = Math.ceil(sr * 4);
    this.dL = new Float32Array(this.delLen); this.dR = new Float32Array(this.delLen);
    this.dW = 0; this.dTime = 0.375 * sr; this.dLpL = 0; this.dLpR = 0; this.dHpL = 0; this.dHpR = 0;
    // Reverb: 8-line FDN with a pre-delay
    const scale = sr / 44100;
    this.revBuf = REV_LENS.map(l => new Float32Array(Math.ceil(l * scale * 1.6) + 4));
    this.revLen = REV_LENS.map(l => Math.round(l * scale));
    this.revIdx = REV_LENS.map(() => 0);
    this.revLp = new Float32Array(8);
    this.preLen = Math.ceil(sr * 0.35);
    this.pre = new Float32Array(this.preLen); this.preW = 0;
    this.rinHp = 0; this.rinLp = 0;
    this.revModPh = 0;
    // FX LFOs
    this.lfo = [new Lfo(), new Lfo()];
    this.port.onmessage = e => this.msg(e.data);
  }

  msg(m) {
    switch (m.t) {
      case 'p': { const l = m.list; for (let k = 0; k < l.length; k += 2) this.P[l[k]] = l[k + 1]; break; }
      case 'off2': { this.O.fill(0); const l = m.list; for (let k = 0; k < l.length; k += 2) this.O[l[k]] = l[k + 1]; break; }
      case 'bpm': this.bpm = m.v; break;
      case 'mvol': this.mvol = m.v; break;
      default: enqueue(this.q, m);
    }
  }

  E(i) {
    if (i === undefined) return 0;
    const v = this.P[i] + this.O[i] + this.M[i];
    return v < this.mins[i] ? this.mins[i] : v > this.maxs[i] ? this.maxs[i] : v;
  }

  control(dt) {
    const I = this.I, P = this.P, M = this.M;
    M.fill(0);
    for (let n = 0; n < 2; n++) {
      const pre = `fxlfo${n + 1}_`;
      const l = this.lfo[n].tick(dt, lfoHz(P[I[pre + 'spd']], Math.round(P[I[pre + 'mul']]), this.bpm), Math.round(P[I[pre + 'wav']]), Math.round(P[I[pre + 'mod']]), P[I[pre + 'fad']]);
      for (const s of ['a', 'b']) {
        const d = this.dests[Math.round(P[I[pre + 'dst' + s]])];
        const dep = P[I[pre + 'dep' + s]];
        if (d && d.idx !== undefined && dep !== 0) M[d.idx] += (dep / 128) * l * d.range;
      }
    }
    const sr = sampleRate;
    const E = i => this.E(I[i]);
    // Chorus
    this.cBase = (0.0015 + (E('cho_pre') / 127) * 0.025) * sr;
    this.cDepth = (E('cho_dep') / 127) * 0.006 * sr;
    this.cRate = 0.03 * Math.pow(2, E('cho_spd') / 14);
    this.cWid = E('cho_wid') / 127;
    this.cFb = (E('cho_fb') / 127) * 0.85;
    this.cHp = 1 - Math.exp(-TWO_PI * fltHz(E('cho_hpf') * 0.85) / sr) * (E('cho_hpf') > 0 ? 1 : 0);
    this.cLp = 1 - Math.exp(-TWO_PI * Math.min(20000, fltHz(E('cho_lpf'))) / sr);
    const vg = v => { const x = v / 127; return x * x * 1.25; };
    this.cVol = vg(E('cho_vol'));
    this.cToD = vg(E('cho_del')) * 0.8;
    this.cToR = vg(E('cho_rev')) * 0.8;
    // Delay
    const tim = E('del_tim');
    this.dTarget = Math.min(this.delLen - 4, ((tim * (240 / this.bpm)) / 128) * sr);
    this.dX = P[I.del_x] >= 0.5;
    const wid = E('del_wid') / 63;
    this.dWid = wid;
    this.dFb = (E('del_fb') / 127) * 1.08;
    this.dHp = E('del_hpf') > 0 ? 1 - Math.exp(-TWO_PI * fltHz(E('del_hpf') * 0.8) / sr) : 0;
    this.dLp = 1 - Math.exp(-TWO_PI * Math.min(20000, fltHz(E('del_lpf'))) / sr);
    const ovr = E('del_ovr') / 127;
    this.dDrive = 1 + ovr * ovr * 10;
    this.dVol = vg(E('del_vol'));
    this.dToR = vg(E('del_rev')) * 0.8;
    // Reverb
    const dec = E('rev_dec');
    const rt = dec >= 127 ? 1e6 : 0.2 * Math.pow(2, (dec / 127) * 6.5);
    this.rG = this.revLen.map(l => Math.pow(10, (-3 * l) / (rt * sr)));
    this.rPre = Math.min(this.preLen - 2, Math.round((E('rev_pre') / 127) * 0.3 * sr) + 1);
    // Shelving: a low-pass in the loop at FRQ, mixed by GAI (-64 = full damping, +63 = none)
    this.rDampCoef = 1 - Math.exp(-TWO_PI * Math.min(18000, 200 * Math.pow(2, E('rev_frq') / 16)) / sr);
    this.rDamp = clamp(0.5 - E('rev_gai') / 128, 0, 1);
    this.rInHp = E('rev_hpf') > 0 ? 1 - Math.exp(-TWO_PI * fltHz(E('rev_hpf') * 0.85) / sr) : 0;
    this.rInLp = 1 - Math.exp(-TWO_PI * Math.min(20000, fltHz(E('rev_lpf'))) / sr);
    this.rVol = vg(E('rev_vol'));
    const lvl = E('level') / 127;
    this.retLevel = lvl * lvl * 1.6;
  }

  process(inputs, outputs) {
    const sends = inputs[0];
    const dry = inputs[1];
    const out = outputs[0];
    const OL = out[0], OR = out[1] || out[0];
    const n = OL.length;
    const sr = sampleRate;
    const t0 = currentTime;
    const sC = sends && sends[0], sD = sends && sends[1], sRv = sends && sends[2];
    const dL = dry && dry[0], dR = dry && (dry[1] || dry[0]);
    const I = this.I, P = this.P;

    for (let b = 0; b < n; b += BLOCK) {
      const now = t0 + b / sr;
      const q = this.q;
      while (q.length && q[0].time <= now + 1e-6) {
        const ev = q.shift();
        if (ev.t === 'at') { const l = ev.list; for (let k = 0; k < l.length; k += 2) P[l[k]] = l[k + 1]; }
        else if (ev.t === 'trig') {
          for (let k = 0; k < 2; k++) {
            const pre = `fxlfo${k + 1}_`;
            this.lfo[k].trig(Math.round(P[I[pre + 'mod']]), P[I[pre + 'sph']] / 128, P[I[pre + 'fad']]);
          }
        }
      }
      this.control(BLOCK / sr);
      const cBase = this.cBase, cDepth = this.cDepth, cWid = this.cWid, cFb = this.cFb, cHp = this.cHp, cLp = this.cLp;
      const cVol = this.cVol, cToD = this.cToD, cToR = this.cToR;
      const dFb = this.dFb, dHp = this.dHp, dLp = this.dLp, dDrive = this.dDrive, dX = this.dX, dVol = this.dVol, dToR = this.dToR;
      const dNorm = 1 / Math.sqrt(dDrive);
      const rG = this.rG, rDampCoef = this.rDampCoef, rDamp = this.rDamp, rInHp = this.rInHp, rInLp = this.rInLp, rVol = this.rVol;
      const retLevel = this.retLevel, mvol = this.mvol;
      const choLen = this.choLen, delLen = this.delLen, preLen = this.preLen;
      const choL = this.choL, choR = this.choR, dLb = this.dL, dRb = this.dR, pre = this.pre;
      const revBuf = this.revBuf, revLen = this.revLen, revIdx = this.revIdx, revLp = this.revLp;
      const cInc = this.cRate / sr;
      const widOff = Math.abs(this.dWid) * 0.012 * sr;

      for (let i = b; i < b + BLOCK && i < n; i++) {
        const inC = sC ? sC[i] : 0, inD = sD ? sD[i] : 0, inR = sRv ? sRv[i] : 0;

        // ---- Chorus (two voices in quadrature)
        this.choPh += cInc; if (this.choPh >= 1) this.choPh -= 1;
        const lf = Math.sin(TWO_PI * this.choPh);
        const lf2 = Math.cos(TWO_PI * this.choPh);
        const w = this.choW;
        choL[w] = inC + this.choFbL * cFb;
        choR[w] = inC + this.choFbR * cFb;
        const rdL = cBase + cDepth * (0.5 + 0.5 * lf), rdR = cBase + cDepth * (0.5 + 0.5 * lf2);
        let cl = this.readFrac(choL, choLen, w, rdL), cr = this.readFrac(choR, choLen, w, rdR);
        this.choW = w + 1 >= choLen ? 0 : w + 1;
        this.choFbL = cl; this.choFbR = cr;
        // width: crossfade the two voices towards mono
        const mid = 0.5 * (cl + cr);
        cl = mid + (cl - mid) * cWid; cr = mid + (cr - mid) * cWid;
        if (cHp > 0) { this.choHpL += (cl - this.choHpL) * cHp; this.choHpR += (cr - this.choHpR) * cHp; cl -= this.choHpL; cr -= this.choHpR; }
        this.choLpL += (cl - this.choLpL) * cLp; this.choLpR += (cr - this.choLpR) * cLp;
        cl = this.choLpL; cr = this.choLpR;

        // ---- Delay (tape-style smoothed time)
        this.dTime += (this.dTarget - this.dTime) * 0.0004;
        const dw = this.dW;
        const tL = this.dTime + (this.dWid < 0 ? widOff : 0), tR = this.dTime + (this.dWid > 0 ? widOff : 0);
        const echoL = this.readFrac(dLb, delLen, dw, Math.max(2, tL));
        const echoR = this.readFrac(dRb, delLen, dw, Math.max(2, tR));
        const dIn = inD + 0.5 * (cl + cr) * cToD;
        let fl = dX ? echoR : echoL, fr = dX ? echoL : echoR;
        // feedback path: low-pass, high-pass, saturation
        this.dLpL += (fl - this.dLpL) * dLp; this.dLpR += (fr - this.dLpR) * dLp;
        fl = this.dLpL; fr = this.dLpR;
        if (dHp > 0) { this.dHpL += (fl - this.dHpL) * dHp; this.dHpR += (fr - this.dHpR) * dHp; fl -= this.dHpL; fr -= this.dHpR; }
        fl = ftanh(fl * dFb * dDrive) * dNorm;
        fr = ftanh(fr * dFb * dDrive) * dNorm;
        dLb[dw] = (dX ? dIn : dIn) + fl;
        dRb[dw] = (dX ? 0 : dIn) + fr;
        this.dW = dw + 1 >= delLen ? 0 : dw + 1;

        // ---- Reverb (pre-delay, input filters, 8-line FDN with Hadamard mixing)
        let rin = inR + 0.5 * (cl + cr) * cToR + 0.5 * (echoL + echoR) * dToR;
        if (rInHp > 0) { this.rinHp += (rin - this.rinHp) * rInHp; rin -= this.rinHp; }
        this.rinLp += (rin - this.rinLp) * rInLp; rin = this.rinLp;
        pre[this.preW] = rin;
        let rp = this.preW - this.rPre; if (rp < 0) rp += preLen;
        const rdel = pre[rp];
        this.preW = this.preW + 1 >= preLen ? 0 : this.preW + 1;
        // read the 8 lines
        const s0 = revBuf[0][revIdx[0]], s1 = revBuf[1][revIdx[1]], s2 = revBuf[2][revIdx[2]], s3 = revBuf[3][revIdx[3]];
        const s4 = revBuf[4][revIdx[4]], s5 = revBuf[5][revIdx[5]], s6 = revBuf[6][revIdx[6]], s7 = revBuf[7][revIdx[7]];
        // fast Hadamard transform (8 points), normalised
        let a0 = s0 + s1, a1 = s0 - s1, a2 = s2 + s3, a3 = s2 - s3, a4 = s4 + s5, a5 = s4 - s5, a6 = s6 + s7, a7 = s6 - s7;
        let b0 = a0 + a2, b1 = a1 + a3, b2 = a0 - a2, b3 = a1 - a3, b4 = a4 + a6, b5 = a5 + a7, b6 = a4 - a6, b7 = a5 - a7;
        const h = 0.35355339;
        const m0 = (b0 + b4) * h, m1 = (b1 + b5) * h, m2 = (b2 + b6) * h, m3 = (b3 + b7) * h;
        const m4 = (b0 - b4) * h, m5 = (b1 - b5) * h, m6 = (b2 - b6) * h, m7 = (b3 - b7) * h;
        const mixed = [m0, m1, m2, m3, m4, m5, m6, m7];
        for (let k = 0; k < 8; k++) {
          let x = mixed[k] * rG[k];
          revLp[k] += (x - revLp[k]) * rDampCoef;
          x = revLp[k] + (x - revLp[k]) * (1 - rDamp);
          const len = revLen[k];
          let wi = revIdx[k] + len; // write position = read position + length (circular)
          const buf = revBuf[k];
          const bl = buf.length;
          if (wi >= bl) wi -= bl;
          buf[wi] = x + (k < 4 ? rdel : -rdel) * 0.5;
          revIdx[k] = revIdx[k] + 1 >= bl ? 0 : revIdx[k] + 1;
        }
        const rl = (s0 + s2 + s4 + s6) * 0.6, rr = (s1 + s3 + s5 + s7) * 0.6;

        // ---- Mix: dry + returns, main volume, soft clip
        let L = (dL ? dL[i] : 0) + (cl * cVol + echoL * dVol + rl * rVol) * retLevel;
        let R = (dR ? dR[i] : 0) + (cr * cVol + echoR * dVol + rr * rVol) * retLevel;
        L *= mvol; R *= mvol;
        OL[i] = L > 0.9 || L < -0.9 ? Math.sign(L) * (0.9 + 0.1 * ftanh((Math.abs(L) - 0.9) * 10)) : L;
        OR[i] = R > 0.9 || R < -0.9 ? Math.sign(R) * (0.9 + 0.1 * ftanh((Math.abs(R) - 0.9) * 10)) : R;
      }
      // Denormal / blow-up guard
      if (!Number.isFinite(this.choFbL + this.choFbR + this.dLpL + this.dLpR + revLp[0] + revLp[5])) {
        this.choL.fill(0); this.choR.fill(0); this.dL.fill(0); this.dR.fill(0);
        this.revBuf.forEach(bf => bf.fill(0)); revLp.fill(0);
        this.choFbL = this.choFbR = this.dLpL = this.dLpR = this.dHpL = this.dHpR = 0;
      }
    }
    return true;
  }

  readFrac(buf, len, w, delay) {
    let pos = w - delay;
    while (pos < 0) pos += len;
    const i0 = Math.floor(pos);
    const f = pos - i0;
    const i1 = i0 + 1 >= len ? 0 : i0 + 1;
    return buf[i0] + (buf[i1] - buf[i0]) * f;
  }
}

registerProcessor('a4-voice', A4Voice);
registerProcessor('a4-fx', A4Fx);
