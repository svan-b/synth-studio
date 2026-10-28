/* eslint-disable */
// ============================================================================
// MOTHER-32 - the whole Moog Mother-32 in one AudioWorkletProcessor ('mother32').
//
//  KB / SEQUENCER / MIDI -> KB CV (GLIDE, bend) -> VCO (FREQUENCY, 1V/OCT, VCO MOD, LIN FM)
//                                                   -> SAW / PULSE -> VCO WAVE -+
//  NOISE (normalled to EXT. AUDIO) -----------------------------------------> MIX
//  GATE (keys / steps, OR the GATE jack) -> EG --+-> VCO MOD (EG normal | jack | LFO) -> FREQ / PW
//                                                +-> VCF MOD (EG | LFO, +/-) -> 4-pole LADDER (LP / HP)
//                                                +-> VCA (EG | ON) + VCA CV -> VOLUME -> out
//  LFO (triangle + square, 0.1-350 Hz, 1 V/oct CV);  VC MIX, MULT and ASSIGN utilities.
//  32-step sequencer: internal clock (TEMPO, 24 divisions, swing), studio transport ticks or
//  the TEMPO jack (4 modes); RUN/STOP, RESET and HOLD jacks; per-step gate length, ratchet,
//  glide, accent and rest.
//
// Why one processor: sample-accurate envelopes and sequencing, zero-latency self-patching (an
// internal patch matrix, one sample late, no Web Audio cycles) and one node per instance with
// no AudioParams at all (each costs CPU every quantum even when idle). Cables from other
// instruments arrive on 18 mono audio inputs (1.0 = 5 V), connected only while patched; clock
// and gate events from EventBus cables arrive as timed messages.
//
// Output: one output, 13 channels (1.0 = 5 V):
//   0 VCA (main, post VOLUME)  1 NOISE  2 VCF  3 VCO SAW  4 VCO PULSE  5 LFO TRI  6 LFO SQ
//   7 VC MIX  8 MULT (both MULT jacks)  9 ASSIGN  10 EG  11 KB  12 GATE
// Internally everything is in volts. Model notes: devices/mother32/REFERENCE.md.
// ============================================================================

// ---------------------------------------------------------------------------
// Fast math (same approximations as synth-processors.js, see docs/DSP.md)
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

/** tanh via [7/6] Pade, max error 1e-4, monotonic, |y| <= 1 */
function tanhF(x) {
  if (x > 4.97) return 1;
  if (x < -4.97) return -1;
  const x2 = x * x;
  return x * (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}

/** tanh(x) / x */
function tanhcF(x) {
  const x2 = x * x;
  if (x2 > 24.7009) return 1 / Math.abs(x);
  return (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}

/** tan(x) for 0 <= x <= 1.42, [5/4] Pade */
function tanF(x) {
  const x2 = x * x;
  return x * (945 + x2 * (-105 + x2)) / (945 + x2 * (-420 + x2 * 15));
}

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

// 4-point polyBLEP (integrated cubic B-spline): corrects W[k-2 .. k+1]; d = samples since the step
function addBlep(W, k, d, h) {
  if (d < 0) d = 0; else if (d > 1) d = 1;
  const d2 = d * d, d3 = d2 * d, d4 = d2 * d2;
  const u = d - 1, u2 = u * u, u3 = u2 * u, u4 = u2 * u2;
  W[k - 2] += h * (d4 * 0.041666666666666664);
  W[k - 1] += h * (0.5 + (4 * u - 2 * u3 - 0.75 * u4) * 0.16666666666666666);
  W[k] += h * (-0.5 + (4 * d - 2 * d3 + 0.75 * d4) * 0.16666666666666666);
  W[k + 1] -= h * (u4 * 0.041666666666666664);
}
const FIR_C = 1.24, FIR_S = -0.12; // presence FIR that flattens the B-spline kernel's top octave
const VL = 4;                       // VCO work-buffer offset of the current sample (3 samples latency)

// ---------------------------------------------------------------------------
// Slots and jacks (keep in sync with devices/mother32/model.ts)
// ---------------------------------------------------------------------------

const K_FREQ = 0, K_WAVE = 1, K_PW = 2, K_MIX = 3, K_CUTOFF = 4, K_RES = 5, K_VCA_MODE = 6, K_VOLUME = 7;
const K_GLIDE = 8, K_VMOD_SRC = 9, K_VMOD_AMT = 10, K_VMOD_DEST = 11, K_VCF_MODE = 12, K_FMOD_SRC = 13;
const K_FMOD_AMT = 14, K_FMOD_POL = 15, K_TEMPO = 16, K_LFO_RATE = 17, K_LFO_WAVE = 18, K_ATTACK = 19;
const K_SUSTAIN = 20, K_DECAY = 21, K_VCMIX = 22, K_RUN = 23, K_SWING = 24, K_DIV = 25, K_ASSIGN = 26;
const K_TEMPO_MODE = 27, K_MODE = 28, K_REC = 29, K_QUALITY = 30, NK = 31;

const I_EXT = 0, I_MIXCV = 1, I_VCACV = 2, I_CUT = 3, I_RES = 4, I_VOCT = 5, I_LINFM = 6, I_VMOD = 7;
const I_LFORATE = 8, I_MIX1 = 9, I_MIX2 = 10, I_VCMIX = 11, I_MULT = 12, I_GATE = 13, I_TEMPO = 14;
const I_RUN = 15, I_RESET = 16, I_HOLD = 17, NIN = 18;

const O_VCA = 0, O_NOISE = 1, O_VCF = 2, O_SAW = 3, O_PULSE = 4, O_TRI = 5, O_SQ = 6, O_VCMIX = 7;
const O_MULT = 8, O_ASSIGN = 9, O_EG = 10, O_KB = 11, O_GATE = 12, NOUT = 13;

// Step divisions in 24-PPQN ticks, slow to fast (devices/mother32/model.ts DIVISIONS)
const DIV_TICKS = [576, 384, 288, 256, 192, 144, 128, 96, 72, 64, 48, 36, 32, 24, 18, 16, 12, 9, 8, 6, 4.5, 4, 3, 2];
const DIV_DEFAULT = 19; // 1/16

// ---------------------------------------------------------------------------
// Scaling (volts). See REFERENCE.md "Model choices".
// ---------------------------------------------------------------------------

const C4 = 261.6255653;       // FREQUENCY centre, KB 0 V
const EG_PEAK = 7.5;          // EG output 0 .. +7.5 V
const VMOD_OCT_PER_V = 0.5;   // VCO MOD (FREQ) at full AMOUNT: EG 3.75 oct, LFO +/-2.5 oct
const VMOD_PW_PER_V = 0.096;  // VCO MOD (PW) at full AMOUNT: LFO +/-5 V = +/-48 % width
const FMOD_OCT_PER_V = 0.9;   // VCF MOD at full AMOUNT: EG 6.75 oct, LFO +/-4.5 oct
const ACCENT_OCT = 1.0;       // accent: cutoff up one octave...
const ACCENT_GAIN = 0.333;    // ...and +2.5 dB at the VCA
const RES_K = 5.4;            // ladder feedback at RESONANCE 100 % (self-oscillates from ~75 %)
const LADDER_HEADROOM = 3;    // ladder input scaling (see the VCF)
const MAIN_GAIN = 0.75;       // VCA jack (1.0 = 5 V) to the studio's main bus
const TRIG_ON = 3.2, TRIG_OFF = 2.4;   // TEMPO / RUN / RESET / HOLD thresholds (volts)
const GATE_ON = 2.0, GATE_OFF = 1.0;   // GATE input thresholds
const DEDUPE = 0.0015;        // an event and an audio pulse closer than this are one pulse

// Smoothed knobs (others jump)
const SMOOTHED = [K_FREQ, K_PW, K_MIX, K_RES, K_VOLUME, K_VMOD_AMT, K_FMOD_AMT, K_VCMIX];
const IS_SMOOTHED = new Uint8Array(NK);
SMOOTHED.forEach(i => { IS_SMOOTHED[i] = 1; });

const ST_IDLE = 0, ST_ATTACK = 1, ST_SUSTAIN = 2, ST_DECAY = 3;
const LN3 = Math.log(3);

// Halfband polyphase IIR for the 2x ladder (synth-processors.js)
const A0 = 0.045362164348961, A1 = 0.337149687979074, A2 = 0.708064136363538;
const B0 = 0.168087481234502, B1 = 0.522377854308354, B2 = 0.897445591172774;
const LADDER_IVS = 0.4;

class Mother32Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    this.sr = sr;
    const k = new Float64Array(NK);
    k[K_WAVE] = 1; k[K_PW] = 0.5; k[K_CUTOFF] = 1200; k[K_RES] = 0.15; k[K_VCA_MODE] = 1; k[K_VOLUME] = 0.7;
    k[K_VMOD_SRC] = 1; k[K_VMOD_DEST] = 1; k[K_VCF_MODE] = 1; k[K_FMOD_AMT] = 0.4; k[K_TEMPO] = 120;
    k[K_LFO_RATE] = 4; k[K_LFO_WAVE] = 1; k[K_ATTACK] = 0.002; k[K_DECAY] = 0.4; k[K_VCMIX] = 0.5;
    k[K_SWING] = 0.5; k[K_DIV] = DIV_DEFAULT; k[K_ASSIGN] = 1; k[K_TEMPO_MODE] = 1; k[K_QUALITY] = 1;
    this.k = k;
    this.s = Float64Array.from(k);    // smoothed copies
    this.cutLog = Math.log2(k[K_CUTOFF]);
    this.smoothA = 1 - Math.exp(-1 / (0.006 * sr));
    this.fresh = true;

    // Patching
    this.patched = new Uint8Array(NIN);
    this.routes = [];
    this.routed = new Uint8Array(NIN);
    this.prev = new Float64Array(NOUT);    // last sample of every output (volts), for self-patches
    this.inV = new Float64Array(NIN);
    this.inArr = new Array(NIN).fill(null);

    // Sequence (devices/mother32/sequence.ts): notes are MIDI numbers, -1 = rest
    this.notes = new Int16Array(32).fill(48);
    this.gate = new Uint8Array(32).fill(4);
    this.glide = new Uint8Array(32);
    this.ratchet = new Uint8Array(32).fill(1);
    this.accent = new Uint8Array(32);
    this.rest = new Uint8Array(32);
    this.len = 16;

    // Sequencer
    this.running = false;
    this.pos = -1;
    this.clockSrc = 0;
    this.nextStepAt = -1;         // internal clock: absolute sample of the next step
    this.pairPos = 0;             // swing: 0 = first step of a pair, 1 = the swung one
    this.stepLen = sr / 8;        // samples of the current step
    this.stepAt = 0;              // absolute sample the current step started
    this.gateQ = [];              // pending [absSample, on, retrigger] triples of the current step
    this.seqGate = false;
    this.seqNote = -1;
    this.tieOpen = false;         // the last step ended in a tie, so the next one is legato
    this.accentOn = 0;
    this.accLevel = 0;
    this.transpose = 0;
    this.holdBtn = false; this.holdJack = false;
    this.resetPending = false; this.resetJack = false;
    this.liveAccent = false; this.liveMute = false;
    this.runJack = false; this.runEvent = false;
    this.audition = false;
    this.synced = false; this.tpPlaying = false; this.syncNext = 0; this.syncFirst = true;
    this.tempoHigh = false; this.lastTempoAudio = -1; this.lastTempoEvent = -1;
    this.lastEdgeAt = -1; this.edgeInterval = sr / 8; this.ppqnCount = 0;
    this.addrStep = -1;
    this.stepCount = 0;
    this.randV = 0;
    this.queue = [];
    this.previewOff = 0;
    this.extGateOff = 0;

    // Keyboard / MIDI
    this.held = [];               // held notes, last = sounding (last-note priority)
    this.kbGate = false;
    this.kbNote = -1;
    this.sus = false;             // CC 64
    this.bend = 0;                // -1 .. 1 = +/-2 semitones
    this.velocity = 1; this.pressure = 0;
    this.cc = new Float64Array(4); // CC 1, 2, 4, 7 (0..1)

    // KB CV with glide (volts, 0 V = C4)
    this.kbTarget = -1;
    this.kbV = -1;
    this.glideOn = false;
    this.glideCoef = 1;

    // Gate / EG
    this.gateIn = false;          // the combined gate the EG sees (internal OR jack)
    this.extGate = false; this.lastGateAudio = -1; this.lastGateEvent = -1;
    this.trigPending = false;     // retrigger request (a new step or note while the gate is high)
    this.eg = 0; this.egStage = ST_IDLE;

    // VCO (4-point BLEP work buffers, fused into the per-sample loop)
    this.vp = Math.random();
    this.pwPrev = 0.5;
    this.Ws = new Float64Array(128 + 16);
    this.Wp = new Float64Array(128 + 16);
    this.drift = 0; this.dr1 = 0; this.dr2 = 0;

    // LFO (2-point BLEP / BLAMP, one sample late)
    this.lp = 0;
    this.sqY = 1; this.sqA = 0; this.sqB = 0;
    this.trY = -1; this.trA = 0; this.trB = 0;

    // Noise
    this.seed = (Math.random() * 0xffffffff) >>> 0 || 7;
    this.rng = (Math.random() * 0xffffffff) >>> 0 || 11;

    // Ladder
    this.z0 = 0; this.z1 = 0; this.z2 = 0; this.z3 = 0;
    this.hb = new Float64Array(24);
    this.cutLast = NaN; this.gCut = 0;
    this.quality = 1;

    // Output DC blocker (main bus only; the jacks are DC coupled like the hardware)
    this.dcX = 0; this.dcY = 0; this.dcR = 1 - (2 * Math.PI * 6) / sr;

    // UI reporting
    this.uiDirty = true; this.uiLast = -1; this.beat = 0; this.beatOffAt = 0;

    this.port.onmessage = e => this.onMessage(e.data);
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  onMessage(m) {
    switch (m.t) {
      case 'k': {
        const i = m.i;
        this.k[i] = m.v;
        if (this.fresh || !IS_SMOOTHED[i]) this.s[i] = m.v;
        if (i === K_CUTOFF && this.fresh) this.cutLog = Math.log2(clamp(m.v, 5, 22000));
        if (i === K_QUALITY) {
          const q = m.v >= 0.5 ? 1 : 0;
          if (q !== this.quality) { this.quality = q; this.hb.fill(0); this.cutLast = NaN; }
        }
        break;
      }
      case 'seq': {
        const n = m.notes, g = m.gate, gl = m.glide, r = m.ratchet, a = m.accent, rs = m.rest;
        for (let i = 0; i < 32; i++) {
          this.notes[i] = n[i]; this.gate[i] = g[i]; this.glide[i] = gl[i];
          this.ratchet[i] = r[i]; this.accent[i] = a[i]; this.rest[i] = rs[i];
        }
        this.len = clamp(m.len | 0, 1, 32);
        if (this.pos >= this.len) this.pos = this.len - 1;
        this.uiDirty = true;
        break;
      }
      case 'patched':
        this.patched[m.i] = m.v ? 1 : 0;
        if (!m.v) {
          if (m.i === I_RUN) { this.runJack = false; this.runEvent = false; }
          if (m.i === I_HOLD) this.holdJack = false;
          if (m.i === I_RESET) this.resetJack = false;
          if (m.i === I_GATE) this.extGate = false;
        }
        if (m.i === I_TEMPO) { this.tempoHigh = false; this.lastEdgeAt = -1; this.addrStep = -1; }
        break;
      case 'routes':
        this.routes = m.routes;
        this.routed.fill(0);
        for (let q = 0; q < m.routes.length; q++) this.routed[m.routes[q][1]] = 1;
        break;
      case 'note': this.push(m.time || 0, m.on ? 'non' : 'noff', m.note, m.vel); break;
      case 'ev': this.push(m.time || 0, m.ch, m.v); break;
      case 'btn': this.push(0, 'b-' + m.b, m.v); break;
      case 'tk': this.push(m.time, 'tick', m.tick, m.dur); break;
      case 'tp': this.push(m.time || 0, m.s ? 'tp-start' : 'tp-stop'); break;
      case 'sync':
        this.synced = !!m.on;
        if (!this.synced) this.tpPlaying = false;
        this.uiDirty = true;
        break;
      case 'bend': this.bend = clamp(+m.v || 0, -1, 1); break;
      case 'sus': this.push(0, 'sus', m.v); break;
      case 'cc': {
        const slot = m.n === 1 ? 0 : m.n === 2 ? 1 : m.n === 4 ? 2 : m.n === 7 ? 3 : -1;
        if (slot >= 0) this.cc[slot] = clamp(+m.v || 0, 0, 1);
        break;
      }
      case 'pressure': this.pressure = clamp(+m.v || 0, 0, 1); break;
    }
  }

  /** Time-sorted event queue */
  push(time, ch, a, b) {
    const q = this.queue;
    const ev = { time, ch, a, b };
    if (!q.length || q[q.length - 1].time <= time) { q.push(ev); return; }
    let i = q.length - 1;
    while (i > 0 && q[i - 1].time > time) i--;
    q.splice(i, 0, ev);
  }

  // -------------------------------------------------------------------------
  // Sequencer
  // -------------------------------------------------------------------------

  /** Samples in one step of the internal clock */
  stepSamples() {
    let bpm = this.k[K_TEMPO];
    if (this.patched[I_TEMPO] && (this.k[K_TEMPO_MODE] | 0) === 0) bpm *= exp2(clamp(this.inV[I_TEMPO], -5, 5));
    bpm = clamp(bpm, 4, 2400);
    const ticks = DIV_TICKS[this.k[K_DIV] | 0] || 6;
    return (60 / bpm) * (ticks / 24) * this.sr;
  }

  /** What advances the steps: 0 internal clock, 1 studio transport, 2 TEMPO edges, 3 step address */
  clockSource() {
    if (this.audition) return 0;
    if (this.patched[I_TEMPO]) {
      const mode = this.k[K_TEMPO_MODE] | 0;
      if (mode === 1 || mode === 2) return 2;
      if (mode === 3) return 3;
    }
    return this.synced ? 1 : 0;
  }

  wantRun() {
    if (this.audition) return true;
    if (this.k[K_REC] > 0.5) return false;
    const base = this.synced ? this.tpPlaying : this.k[K_RUN] > 0.5;
    return base || (!!this.patched[I_RUN] && (this.runJack || this.runEvent));
  }

  /** Apply run-state and clock-source changes at absolute sample `at` */
  updateRun(at) {
    const want = this.wantRun();
    if (want !== this.running) {
      if (want) this.startRun(at); else this.stopRun();
    }
    const src = this.clockSource();
    if (src !== this.clockSrc) {
      this.clockSrc = src;
      if (src === 0 && this.running) this.nextStepAt = at; // back on the internal clock
      if (src === 1) this.syncFirst = true;
    }
  }

  startRun(at) {
    this.running = true;
    this.pos = -1;
    this.pairPos = 0;
    this.stepCount = 0;
    this.syncFirst = true;
    this.ppqnCount = 0;
    this.addrStep = -1;
    this.tieOpen = false;
    this.lastEdgeAt = -1;
    this.nextStepAt = at;         // the internal clock plays step 1 at once
    this.uiDirty = true;
  }

  stopRun() {
    this.running = false;
    this.gateQ.length = 0;
    this.seqGate = false;
    this.tieOpen = false;
    this.accentOn = 0;
    this.nextStepAt = -1;
    this.uiDirty = true;
  }

  /** Play the next step at absolute sample `at`; it lasts `len` samples */
  playStep(at, len) {
    const L = this.len;
    let s;
    if (this.resetJack) s = 0;
    else if ((this.holdBtn || this.holdJack) && this.pos >= 0) s = this.pos;
    else if (this.resetPending) { s = 0; this.resetPending = false; }
    else s = (this.pos + 1) % L;
    if (s >= L || s < 0) s = 0;
    this.pos = s;
    this.stepLen = len;
    this.stepAt = at;
    this.stepCount++;
    this.uiDirty = true;
    // ASSIGN step-random value
    let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0;
    this.randV = (this.rng / 4294967296) * 5;
    // TEMPO LED: on the beat
    const div = DIV_TICKS[this.k[K_DIV] | 0] || 6;
    const beatEvery = Math.max(1, Math.round(24 / div));
    if ((this.stepCount - 1) % beatEvery === 0) { this.beat = 1; this.beatOffAt = at + Math.min(len * 0.5, this.sr * 0.06); }

    const q = this.gateQ;
    q.length = 0;
    const note = this.notes[s];
    if (this.rest[s] || note < 0 || this.liveMute) {
      if (this.seqGate) q.push(at, 0, 0);
      this.tieOpen = false;
      this.accentOn = 0;
      return;
    }
    const n = note + this.transpose;
    this.seqNote = n;
    this.accentOn = (this.accent[s] || this.liveAccent) ? 1 : 0;
    this.setPitch((n - 60) / 12, this.glide[s] && this.k[K_GLIDE] > 0.0005);
    const g = this.gate[s] || 4;
    const r = this.ratchet[s] || 1;
    const legato = this.tieOpen && this.seqGate;
    if (r <= 1) {
      if (!legato) q.push(at, 1, 1);
      if (g >= 8) this.tieOpen = true;
      else { this.tieOpen = false; q.push(at + Math.max(24, Math.round(len * g / 8)), 0, 0); }
    } else {
      this.tieOpen = false;
      const sub = len / r;
      const gl = Math.max(24, Math.round(sub * (g >= 8 ? 0.875 : g / 8)));
      for (let j = 0; j < r; j++) {
        const on = Math.round(at + j * sub);
        if (!(j === 0 && legato)) q.push(on, 1, 1);
        q.push(on + gl, 0, 0);
      }
    }
  }

  setPitch(v, glide) {
    this.kbTarget = v;
    if (glide) {
      this.glideOn = true;
      this.glideCoef = 1 - Math.exp(-3 / (Math.max(0.001, this.k[K_GLIDE]) * this.sr));
    } else {
      this.glideOn = false;
      this.kbV = v;
    }
  }

  /** Studio transport tick (24 PPQN, audio time): steps land on multiples of the division */
  onTick(ev) {
    if (!this.running || this.clockSrc !== 1) return;
    const T = ev.a, dur = ev.b * this.sr;
    const D = DIV_TICKS[this.k[K_DIV] | 0] || 6;
    if (this.syncFirst) { this.syncFirst = false; this.syncNext = Math.ceil(T / D - 1e-9) * D; this.pairPos = 0; }
    const tickAt = ev.time * this.sr;
    let guard = 0;
    while (this.syncNext < T + 1 - 1e-9 && guard++ < 8) {
      if (this.syncNext >= T - 1e-9) {
        const off = this.pairPos ? (2 * this.k[K_SWING] - 1) * D * dur : 0;
        const at = tickAt + (this.syncNext - T) * dur + off;
        this.push(at / this.sr, 'step', at, D * dur);
        this.pairPos ^= 1;
      }
      this.syncNext += D;
    }
  }

  /** A rising edge at the TEMPO jack (Single Clock Advance or Analog Clock) */
  tempoEdge(at) {
    if (this.lastEdgeAt >= 0) this.edgeInterval = clamp(at - this.lastEdgeAt, 64, this.sr * 4);
    this.lastEdgeAt = at;
    if (!this.running || this.clockSrc !== 2) return;
    if ((this.k[K_TEMPO_MODE] | 0) === 2) {
      // Analog clock at 4 PPQN (16th pulses): one step per (division / 16th) pulses
      const D = DIV_TICKS[this.k[K_DIV] | 0] || 6;
      const every = Math.max(1, Math.round(D / 6));
      if (this.ppqnCount++ % every !== 0) return;
      this.playStep(at, this.edgeInterval * every);
      return;
    }
    this.playStep(at, this.edgeInterval);
  }

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  noteOn(note, vel) {
    this.velocity = vel === undefined ? 1 : clamp(vel, 0, 1);
    if (this.running && !this.audition) {
      // KB mode while running: the keys transpose the pattern (C3 = no transposition)
      if ((this.k[K_MODE] | 0) === 0) { this.transpose = clamp(note - 48, -36, 36); this.uiDirty = true; }
      return;
    }
    const legato = this.held.length > 0 || this.kbGate;
    const i = this.held.indexOf(note);
    if (i >= 0) this.held.splice(i, 1);
    this.held.push(note);
    this.kbNote = note;
    this.setPitch((note - 60) / 12, this.k[K_GLIDE] > 0.0005 && this.kbV > -9);
    // SUSTAIN ON plays legato (single trigger), SUSTAIN OFF retriggers every note
    if (!legato || this.k[K_SUSTAIN] > 0.5) this.trigPending = true;
    this.kbGate = true;
    this.previewOff = 0;
    this.uiDirty = true;
  }

  noteOff(note) {
    const i = this.held.indexOf(note);
    if (i >= 0) this.held.splice(i, 1);
    if (this.held.length) {
      const last = this.held[this.held.length - 1];
      if (last !== this.kbNote) {
        this.kbNote = last;
        this.setPitch((last - 60) / 12, this.k[K_GLIDE] > 0.0005);
        if (this.k[K_SUSTAIN] > 0.5) this.trigPending = true;
      }
    } else if (!this.sus) {
      this.kbGate = false;
    }
    this.uiDirty = true;
  }

  handleEvent(ev, now) {
    switch (ev.ch) {
      case 'non': this.noteOn(ev.a, ev.b); break;
      case 'noff': this.noteOff(ev.a); break;
      case 'sus':
        this.sus = ev.a > 0.5;
        if (!this.sus && !this.held.length) this.kbGate = false;
        break;
      case 'b-reset': if (this.running) this.resetPending = true; else this.pos = -1; this.uiDirty = true; break;
      case 'b-hold': this.holdBtn = ev.a > 0.5; break;
      case 'b-accent': this.liveAccent = ev.a > 0.5; break;
      case 'b-mute': this.liveMute = ev.a > 0.5; break;
      case 'b-transpose': this.transpose = ev.a | 0; this.uiDirty = true; break;
      case 'b-audition':
        if (ev.a > 0.5) { if (!this.audition && !this.running) this.audition = true; }
        else this.audition = false;
        break;
      case 'b-preview':
        // A short note (step edit / recording feedback) while the sequencer is stopped
        if (this.running || this.held.length) break;
        this.kbNote = ev.a;
        this.setPitch((ev.a - 60) / 12, false);
        this.kbGate = true; this.trigPending = true;
        this.previewOff = now + Math.round(this.sr * 0.2);
        break;
      case 'tp-start': this.tpPlaying = true; break;
      case 'tp-stop': this.tpPlaying = false; break;
      case 'tick': this.onTick(ev); break;
      case 'step': if (this.running && this.clockSrc === 1) this.playStep(Math.max(now, Math.round(ev.a)), ev.b); break;
      case 'tempo':
        if (Math.abs(ev.time - this.lastTempoAudio) < DEDUPE) break;
        this.lastTempoEvent = ev.time;
        if (ev.a > 0.5) this.tempoEdge(now);
        break;
      case 'run': this.runEvent = ev.a > 0.5; break;
      case 'reset': if (ev.a > 0.5) { if (this.running) this.resetPending = true; else this.pos = -1; } break;
      case 'hold': this.holdJack = ev.a > 0.5; break;
      case 'gate':
        if (Math.abs(ev.time - this.lastGateAudio) < DEDUPE) break;
        this.lastGateEvent = ev.time;
        // Event gates may be pulses with no "off": hold them for 5 ms
        if (ev.a > 0.5) { this.extGate = true; this.trigPending = true; this.extGateOff = now + Math.round(this.sr * 0.005); }
        else { this.extGate = false; this.extGateOff = 0; }
        break;
    }
    this.updateRun(now);
  }

  // -------------------------------------------------------------------------

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < NOUT) return true;
    const n = out[0].length;
    const sr = this.sr;
    const k = this.k, s = this.s;
    const t0 = currentTime;
    const abs0 = Math.round(t0 * sr);
    this.fresh = false;
    const inV = this.inV, prev = this.prev, patched = this.patched, routes = this.routes, nr = routes.length;
    if (this.Ws.length < n + 16) { this.Ws = new Float64Array(n + 16); this.Wp = new Float64Array(n + 16); }
    const Ws = this.Ws, Wp = this.Wp;

    // External inputs with a cable this block
    const inArr = this.inArr;
    let nExt = 0;
    for (let j = 0; j < NIN; j++) {
      const ch = inputs[j];
      const a = ch && ch.length ? ch[0] : null;
      inArr[j] = a;
      if (a) nExt++;
      else if (!this.routed[j]) inV[j] = 0;
    }

    // Smoothing needed this block?
    const sa = this.smoothA;
    const cutTarget = Math.log2(clamp(k[K_CUTOFF], 5, 22000));
    let smoothing = Math.abs(cutTarget - this.cutLog) > 1e-6;
    for (let q = 0; q < SMOOTHED.length && !smoothing; q++) { const id = SMOOTHED[q]; if (Math.abs(k[id] - s[id]) > 1e-7) smoothing = true; }
    if (!smoothing) { for (let q = 0; q < SMOOTHED.length; q++) s[SMOOTHED[q]] = k[SMOOTHED[q]]; this.cutLog = cutTarget; }

    // Per-block switches
    const sawSel = k[K_WAVE] > 0.5;                 // ['PULSE', 'SAW']
    const vmodLfo = k[K_VMOD_SRC] > 0.5;            // ['EG', 'LFO']
    const vmodFreq = k[K_VMOD_DEST] > 0.5;          // ['PW', 'FREQ']
    const lp = k[K_VCF_MODE] > 0.5;                 // ['HP', 'LP']
    const fmodLfo = k[K_FMOD_SRC] > 0.5;            // ['EG', 'LFO']
    const fmodSign = k[K_FMOD_POL] > 0.5 ? -1 : 1;  // ['+', '-']
    const lfoTri = k[K_LFO_WAVE] > 0.5;             // ['SQ', 'TRI']
    const vcaOn = k[K_VCA_MODE] < 0.5;              // ['ON', 'EG']
    const sustainOn = k[K_SUSTAIN] < 0.5;           // ['ON', 'OFF']
    const extOn = !!patched[I_EXT], vmodExt = !!patched[I_VMOD];
    const mix1P = !!patched[I_MIX1], mix2P = !!patched[I_MIX2];
    const assignSrc = k[K_ASSIGN] | 0;
    const quality = this.quality;
    const nyq = 0.45 * sr, wScale = Math.PI / (sr * (quality ? 2 : 1));
    const egAtk = 1 - Math.exp(-LN3 / (Math.max(0.0005, k[K_ATTACK]) * sr));
    const egDec = Math.exp(-4.6 / (Math.max(0.0005, k[K_DECAY]) * sr));

    // Analog drift: slow random wander of about 2 cents, per block
    {
      const a = 1 - Math.exp((-2 * Math.PI * 0.25 * n) / sr);
      let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0;
      const w = (this.rng / 4294967296) * 2 - 1;
      this.dr1 += a * (w - this.dr1);
      this.dr2 += a * (this.dr1 - this.dr2);
      this.drift = clamp(this.dr2 * 9, -3, 3) * (2 / 1200);
    }
    const drift = this.drift;

    const oMain = out[0], oNoise = out[1], oVcf = out[2], oSaw = out[3], oPulse = out[4], oTri = out[5], oSq = out[6];
    const oVcMix = out[7], oMult = out[8], oAssign = out[9], oEg = out[10], oKb = out[11], oGate = out[12];

    let vp = this.vp, pwPrev = this.pwPrev, lph = this.lp;
    let z0 = this.z0, z1 = this.z1, z2 = this.z2, z3 = this.z3;
    const hb = this.hb;
    let eg = this.eg;
    const queue = this.queue;
    this.updateRun(abs0);

    for (let i = 0; i < n; i++) {
      const now = abs0 + i;
      const t = t0 + i / sr;

      // ---- inputs: other instruments (1.0 = 5 V) + self-patches (last sample, volts) ----
      if (nExt) for (let j = 0; j < NIN; j++) { const a = inArr[j]; if (a) inV[j] = a[i] * 5; }
      if (nr) {
        for (let q = 0; q < nr; q++) { const j = routes[q][1]; const a = inArr[j]; inV[j] = a ? a[i] * 5 : 0; }
        for (let q = 0; q < nr; q++) { const rt = routes[q]; inV[rt[1]] += prev[rt[0]] * rt[2]; }
      }

      // ---- smoothing ----
      if (smoothing) {
        for (let q = 0; q < SMOOTHED.length; q++) { const id = SMOOTHED[q]; s[id] += (k[id] - s[id]) * sa; }
        this.cutLog += (cutTarget - this.cutLog) * sa;
      }

      // ---- timed events ----
      while (queue.length && queue[0].time <= t) this.handleEvent(queue.shift(), now);

      // ---- gate-type jacks (edge detection on the audio) ----
      if (patched[I_RUN]) {
        const v = inV[I_RUN];
        if (!this.runJack && v > TRIG_ON) { this.runJack = true; this.updateRun(now); }
        else if (this.runJack && v < TRIG_OFF) { this.runJack = false; this.updateRun(now); }
      }
      if (patched[I_RESET]) { const v = inV[I_RESET]; if (!this.resetJack && v > TRIG_ON) { this.resetJack = true; this.uiDirty = true; } else if (this.resetJack && v < TRIG_OFF) this.resetJack = false; }
      if (patched[I_HOLD]) { const v = inV[I_HOLD]; if (!this.holdJack && v > TRIG_ON) this.holdJack = true; else if (this.holdJack && v < TRIG_OFF) this.holdJack = false; }
      if (patched[I_GATE]) {
        const v = inV[I_GATE];
        if (!this.extGate && v > GATE_ON) { if (Math.abs(t - this.lastGateEvent) >= DEDUPE) { this.lastGateAudio = t; this.extGate = true; this.extGateOff = 0; } }
        else if (this.extGate && !this.extGateOff && v < GATE_OFF) this.extGate = false;
      }
      if (this.extGateOff && now >= this.extGateOff) { this.extGateOff = 0; this.extGate = false; }

      // ---- step clocks ----
      if (patched[I_TEMPO]) {
        const v = inV[I_TEMPO];
        const mode = k[K_TEMPO_MODE] | 0;
        if (mode === 1 || mode === 2) {
          if (!this.tempoHigh && v > TRIG_ON) {
            this.tempoHigh = true;
            if (Math.abs(t - this.lastTempoEvent) >= DEDUPE) { this.lastTempoAudio = t; this.tempoEdge(now); }
          } else if (this.tempoHigh && v < TRIG_OFF) this.tempoHigh = false;
        } else if (mode === 3 && this.running && this.clockSrc === 3) {
          // Step address: the voltage picks the step (-5 .. +5 V across the pattern)
          const st = clamp(Math.floor(((v + 5) / 10) * this.len), 0, this.len - 1);
          if (st !== this.addrStep) {
            this.addrStep = st;
            this.pos = st === 0 ? this.len - 1 : st - 1;
            const hold = this.holdBtn; this.holdBtn = false;
            this.playStep(now, Math.round(this.stepSamples()));
            this.holdBtn = hold;
          }
        }
      }
      if (this.running && this.clockSrc === 0 && this.nextStepAt >= 0 && now >= this.nextStepAt) {
        const P = this.stepSamples();
        const sw = k[K_SWING];
        const len = this.pairPos ? 2 * (1 - sw) * P : 2 * sw * P;
        this.playStep(now, len);
        this.pairPos ^= 1;
        this.nextStepAt = now + Math.max(1, Math.round(len));
      }

      // ---- the current step's gates (gate length, ratchets) ----
      const gq = this.gateQ;
      while (gq.length && gq[0] <= now) {
        if (gq[1]) { this.seqGate = true; if (gq[2]) this.trigPending = true; }
        else this.seqGate = false;
        gq.splice(0, 3);
        this.uiDirty = true;
      }
      if (this.previewOff && now >= this.previewOff) { this.previewOff = 0; if (!this.held.length && !this.sus) { this.kbGate = false; this.uiDirty = true; } }

      // ---- EG gate: keyboard / sequencer OR the GATE jack ----
      const intGate = this.seqGate || this.kbGate;
      const gt = intGate || this.extGate;
      if (gt && (!this.gateIn || this.trigPending)) this.egStage = ST_ATTACK;
      else if (!gt && this.gateIn && (sustainOn ? this.egStage !== ST_IDLE : this.egStage === ST_ATTACK)) this.egStage = ST_DECAY;
      this.trigPending = false;
      this.gateIn = gt;

      // ---- EG: RC attack toward 1.5 x peak, then hold (SUSTAIN ON) or decay ----
      if (this.egStage === ST_ATTACK) {
        eg += (EG_PEAK * 1.5 - eg) * egAtk;
        if (eg >= EG_PEAK) { eg = EG_PEAK; this.egStage = sustainOn ? ST_SUSTAIN : ST_DECAY; }
      } else if (this.egStage === ST_DECAY) {
        eg *= egDec;
        if (eg < 1e-4) { eg = 0; this.egStage = ST_IDLE; }
      } else if (this.egStage === ST_SUSTAIN && !sustainOn) this.egStage = ST_DECAY;

      // ---- KB CV with glide ----
      if (this.glideOn) {
        this.kbV += (this.kbTarget - this.kbV) * this.glideCoef;
        if (Math.abs(this.kbTarget - this.kbV) < 1e-6) { this.kbV = this.kbTarget; this.glideOn = false; }
      }
      const kbOut = this.kbV + this.bend * (2 / 12);

      // ---- accent (smoothed, follows the step) ----
      this.accLevel += ((this.running ? this.accentOn : 0) - this.accLevel) * 0.004;
      const accL = this.accLevel;

      // ---- LFO: triangle and square from one phase, band-limited (one sample late) ----
      let rate = k[K_LFO_RATE];
      if (patched[I_LFORATE]) rate *= exp2(clamp(inV[I_LFORATE], -9, 9));
      if (rate > 600) rate = 600; else if (rate < 0.01) rate = 0.01;
      const ldt = rate / sr;
      const lpOld = lph;
      lph += ldt;
      if (lph >= 1) {
        lph -= 1;
        const d = lph / ldt, e = 1 - d;
        this.sqA += d * d; this.sqB -= e * e;                       // +2 step
        const ds = 8 * ldt; this.trA += ds * d * d * d / 6; this.trB += ds * e * e * e / 6;
      } else if (lpOld < 0.5 && lph >= 0.5) {
        const d = (lph - 0.5) / ldt, e = 1 - d;
        this.sqA -= d * d; this.sqB += e * e;                       // -2 step
        const ds = -8 * ldt; this.trA += ds * d * d * d / 6; this.trB += ds * e * e * e / 6;
      }
      const lfoSq = this.sqY + this.sqA; this.sqY = lph < 0.5 ? 1 : -1; this.sqA = this.sqB; this.sqB = 0;
      const lfoTr = this.trY + this.trA; this.trY = lph < 0.5 ? 4 * lph - 1 : 3 - 4 * lph; this.trA = this.trB; this.trB = 0;
      const lfoV = (lfoTri ? lfoTr : lfoSq) * 5;

      // ---- VCO ----
      const vAmt = s[K_VMOD_AMT] * s[K_VMOD_AMT];
      let pitch = s[K_FREQ] + kbOut + drift;
      if (patched[I_VOCT]) pitch += inV[I_VOCT];
      let pw = s[K_PW];
      if (vAmt > 0) {
        const src = vmodLfo ? lfoV : (vmodExt ? inV[I_VMOD] : eg);
        if (vmodFreq) pitch += src * vAmt * VMOD_OCT_PER_V;
        else pw += src * vAmt * VMOD_PW_PER_V;
      }
      if (pw < 0.02) pw = 0.02; else if (pw > 0.98) pw = 0.98;
      let f = C4 * exp2(pitch > 7 ? 7 : pitch < -9.5 ? -9.5 : pitch);
      if (patched[I_LINFM]) { f *= 1 + inV[I_LINFM] * 0.2; if (f < 0) f = 0; }
      let dt = f / sr;
      if (dt > 0.45) dt = 0.45;
      const kk = i + VL;
      const q1 = vp + dt;
      if (q1 < 1) {
        const g0 = vp - pwPrev, g1 = q1 - pw;
        if ((g0 < 0) !== (g1 < 0)) addBlep(Wp, kk, 1 - g0 / (g0 - g1), g0 < 0 ? -2 : 2); // pulse edge
        vp = q1;
      } else {
        // wrap, with a falling pulse edge possibly just before or just after it
        const tw = (1 - vp) / dt;
        const pwTw = pwPrev + (pw - pwPrev) * tw;
        let g0 = vp - pwPrev, g1 = 1 - pwTw;
        if (g0 < 0) addBlep(Wp, kk, 1 - tw * g0 / (g0 - g1), -2);
        addBlep(Ws, kk, 1 - tw, -2);
        addBlep(Wp, kk, 1 - tw, 2);
        vp = q1 - 1;
        g0 = -pwTw; g1 = vp - pw;
        if (g1 >= 0) addBlep(Wp, kk, 1 - (tw + (1 - tw) * g0 / (g0 - g1)), -2);
      }
      Ws[kk] += 2 * vp - 1;
      Wp[kk] += vp < pw ? 1 : -1;
      pwPrev = pw;
      const saw = FIR_C * Ws[i + 1] + FIR_S * (Ws[i] + Ws[i + 2]);
      const pul = FIR_C * Wp[i + 1] + FIR_S * (Wp[i] + Wp[i + 2]);

      // ---- noise (xorshift32) ----
      let xs = this.seed; xs ^= xs << 13; xs ^= xs >>> 17; xs ^= xs << 5; this.seed = xs >>> 0;
      const noise = ((this.seed / 4294967296) * 2 - 1) * 1.1;

      // ---- mixer: VCO wave <-> NOISE / EXT. AUDIO (linear crossfade; MIX CV sums) ----
      let m = s[K_MIX];
      if (patched[I_MIXCV]) { m += inV[I_MIXCV] * 0.1; if (m < 0) m = 0; else if (m > 1) m = 1; }
      const wave = sawSel ? saw : pul;
      let ext = noise;
      if (extOn) {
        // EXT. AUDIO: unity at Eurorack level, soft-limited like an op-amp input stage near the rails
        ext = inV[I_EXT] * 0.2;
        if (ext > 0.9 || ext < -0.9) ext = 1.35 * tanhF(ext / 1.35);
      }
      const mix = wave + (ext - wave) * m;

      // ---- VCF: cutoff = knob + CV + VCF MOD + accent ----
      const fAmt = s[K_FMOD_AMT] * s[K_FMOD_AMT];
      let cutOct = this.cutLog + accL * ACCENT_OCT;
      if (fAmt > 0) cutOct += fmodSign * (fmodLfo ? lfoV : eg) * fAmt * FMOD_OCT_PER_V;
      if (patched[I_CUT]) cutOct += inV[I_CUT];
      if (cutOct !== this.cutLast) {
        this.cutLast = cutOct;
        let fc = exp2(cutOct > 15 ? 15 : cutOct);
        if (fc < 8) fc = 8; else if (fc > nyq) fc = nyq;
        this.gCut = tanF(fc * wScale);
      }
      let res = s[K_RES];
      if (patched[I_RES]) { res += inV[I_RES] * 0.2; if (res < 0) res = 0; else if (res > 1.15) res = 1.15; }
      // LOW PASS: the resonant 4-pole ladder. HI PASS: the input minus the (non-resonant) ladder
      // low-pass; RESONANCE then lets the low band back in, as the manual warns.
      const kf = lp ? res * RES_K : 0;
      const hpKeep = lp ? 0 : 1 - 0.85 * (res > 1 ? 1 : res);
      // The ladder runs in units of LADDER_HEADROOM volts/5, so the input pair compresses a full VCO
      // only gently and self-oscillation can reach VCO level. A whisper of noise (-100 dB), as in any
      // analog circuit, lets self-oscillation start from silence.
      const xin = (mix + noise * 1e-5) * (1 + 0.5 * res) * (1 / LADDER_HEADROOM);
      const gC = this.gCut;
      let filt;
      if (!quality) {
        const ig = 1 / (1 + gC), G = gC * ig, G2 = G * G, G3 = G2 * G, G4 = G3 * G;
        const sigma = G3 * z0 * ig + G2 * z1 * ig + G * z2 * ig + z3 * ig;
        const y4e = (G4 * xin + sigma) / (1 + kf * G4);
        const u = tanhF(xin - kf * y4e);
        let v = (u - z0) * G; const y1 = v + z0; z0 = y1 + v;
        v = (y1 - z1) * G; const y2 = v + z1; z1 = y2 + v;
        v = (y2 - z2) * G; const y3 = v + z2; z2 = y3 + v;
        v = (y3 - z3) * G; const y4 = v + z3; z3 = y4 + v;
        filt = lp ? y4 : u - hpKeep * y4;
      } else {
        // 2x oversampled transistor core with per-stage tanh ('ladder' quality 1 in synth-processors.js)
        let t1 = A0 * (xin - hb[3]) + hb[0]; hb[0] = xin; hb[3] = t1;
        let t2 = A1 * (t1 - hb[4]) + hb[1]; hb[1] = t1; hb[4] = t2;
        const xa = A2 * (t2 - hb[5]) + hb[2]; hb[2] = t2; hb[5] = xa;
        t1 = B0 * (xin - hb[9]) + hb[6]; hb[6] = xin; hb[9] = t1;
        t2 = B1 * (t1 - hb[10]) + hb[7]; hb[7] = t1; hb[10] = t2;
        const xb = B2 * (t2 - hb[11]) + hb[8]; hb[8] = t2; hb[11] = xb;
        // Stage compression (tanh(v)/v of each stage) is evaluated once per output sample and
        // used for both sub-steps: the states barely move in half a sample, and it halves the cost.
        const T1 = tanhcF(z0 * LADDER_IVS), T2 = tanhcF(z1 * LADDER_IVS), T3 = tanhcF(z2 * LADDER_IVS), T4 = tanhcF(z3 * LADDER_IVS);
        const ge = (4 * gC) / (T1 + T2 + T3 + T4);
        const c1 = 1 / (1 + ge * T1), c2 = 1 / (1 + ge * T2), c3 = 1 / (1 + ge * T3), c4 = 1 / (1 + ge * T4);
        const a1 = ge * c1, a2 = ge * T1 * c2, a3 = ge * T2 * c3, a4 = ge * T3 * c4;
        const P = a1 * a2 * a3 * a4;
        const iP = 1 / (1 + kf * P);
        let za = 0, zb = 0;
        for (let sub = 0; sub < 2; sub++) {
          const xsub = sub === 0 ? xa : xb;
          const b1 = z0 * c1, b2 = z1 * c2, b3 = z2 * c3, b4 = z3 * c4;
          const Q = a4 * (a3 * (a2 * b1 + b2) + b3) + b4;
          const y4e = (P * xsub + Q) * iP;
          const u = tanhF(xsub - kf * y4e);
          const y1 = a1 * u + b1, y2 = a2 * y1 + b2, y3 = a3 * y2 + b3, y4 = a4 * y3 + b4;
          z0 = 2 * y1 - z0; z1 = 2 * y2 - z1; z2 = 2 * y3 - z2; z3 = 2 * y4 - z3;
          const y = lp ? y4 : u - hpKeep * y4;
          if (sub === 0) za = y; else zb = y;
        }
        t1 = A0 * (zb - hb[15]) + hb[12]; hb[12] = zb; hb[15] = t1;
        t2 = A1 * (t1 - hb[16]) + hb[13]; hb[13] = t1; hb[16] = t2;
        const ya = A2 * (t2 - hb[17]) + hb[14]; hb[14] = t2; hb[17] = ya;
        t1 = B0 * (za - hb[21]) + hb[18]; hb[18] = za; hb[21] = t1;
        t2 = B1 * (t1 - hb[22]) + hb[19]; hb[19] = t1; hb[22] = t2;
        const yb = B2 * (t2 - hb[23]) + hb[20]; hb[20] = t2; hb[23] = yb;
        filt = 0.5 * (ya + yb);
      }
      const vcf = filt * LADDER_HEADROOM * (1 + 0.3 * res); // the VCF jack, 1.0 = 5 V (self-oscillation ~ +/-4.5 V)

      // ---- VCA: EG (or ON) + VCA CV and accent; soft clips above full level ----
      let ctl = vcaOn ? 5 : eg * (5 / EG_PEAK);
      if (patched[I_VCACV]) ctl += inV[I_VCACV];
      let vg = ctl * 0.2 * (1 + ACCENT_GAIN * accL);
      let amp = 0;
      if (vg > 0) {
        if (vg > 1) vg = 1 + 0.5 * tanhF((vg - 1) * 2);
        amp = vcf * vg;
        if (amp > 1.1 || amp < -1.1) { const c = 1.1 * tanhF(amp / 1.1); amp = c + (amp - c) * 0.2; }
      }
      const vol = s[K_VOLUME];
      const vca = amp * vol * vol;
      let main = vca * MAIN_GAIN;
      const dc = main - this.dcX + this.dcR * this.dcY;
      this.dcX = main; this.dcY = dc; main = dc;

      // ---- VC MIX (DC coupled): MIX 1 (0 V normal) <-> MIX 2 (+5 V normal) ----
      let p = s[K_VCMIX];
      if (patched[I_VCMIX]) { p += inV[I_VCMIX] * 0.1; if (p < 0) p = 0; else if (p > 1) p = 1; }
      const m1 = mix1P ? inV[I_MIX1] : 0, m2 = mix2P ? inV[I_MIX2] : 5;
      const vcMix = m1 + (m2 - m1) * p;

      // ---- ASSIGN (Setup page 1) ----
      let asg = 0;
      if (assignSrc >= 9) {
        asg = assignSrc === 9 ? this.velocity * 5 : assignSrc === 10 ? this.pressure * 5 : assignSrc === 11 ? this.bend * 5 : this.cc[assignSrc - 12] * 5;
      } else if (this.running && this.pos >= 0) {
        const half = now - this.stepAt < this.stepLen * 0.5;
        const L1 = this.len > 1 ? this.len - 1 : 1;
        switch (assignSrc) {
          case 0: asg = this.accentOn && this.seqGate ? 5 : 0; break;                      // ACCENT
          case 1: asg = half ? 5 : 0; break;                                                // CLOCK
          case 2: asg = half && ((this.stepCount - 1) & 1) === 0 ? 5 : 0; break;            // CLOCK / 2
          case 3: asg = half && ((this.stepCount - 1) & 3) === 0 ? 5 : 0; break;            // CLOCK / 4
          case 4: asg = (this.pos / L1) * 5; break;                                         // STEP RAMP
          case 5: asg = (1 - this.pos / L1) * 5; break;                                     // STEP SAW
          case 6: { const h = this.len / 2; asg = (this.pos < h ? this.pos / h : (this.len - this.pos) / h) * 5; break; } // STEP TRIANGLE
          case 7: asg = this.randV; break;                                                  // STEP RANDOM
          case 8: asg = this.pos === 0 && half ? 5 : 0; break;                              // STEP 1 TRIGGER
        }
      }

      // ---- outputs (1.0 = 5 V) ----
      const gateOut = intGate ? 1 : 0;
      const multV = patched[I_MULT] ? inV[I_MULT] : 0;
      oMain[i] = main;
      oNoise[i] = noise;
      oVcf[i] = vcf;
      oSaw[i] = saw;
      oPulse[i] = pul;
      oTri[i] = lfoTr;
      oSq[i] = lfoSq;
      oVcMix[i] = vcMix * 0.2;
      oMult[i] = multV * 0.2;
      oAssign[i] = asg * 0.2;
      oEg[i] = eg * 0.2;
      oKb[i] = kbOut * 0.2;
      oGate[i] = gateOut;
      if (nr) {
        prev[O_VCA] = vca * 5; prev[O_NOISE] = noise * 5; prev[O_VCF] = vcf * 5; prev[O_SAW] = saw * 5;
        prev[O_PULSE] = pul * 5; prev[O_TRI] = lfoTr * 5; prev[O_SQ] = lfoSq * 5; prev[O_VCMIX] = vcMix;
        prev[O_MULT] = multV; prev[O_ASSIGN] = asg; prev[O_EG] = eg; prev[O_KB] = kbOut; prev[O_GATE] = gateOut * 5;
      }
    }

    // VCO work buffers: carry the latency history and the BLEP taps that reach past the end
    for (let j = 0; j <= VL; j++) { Ws[j] = Ws[n + j]; Wp[j] = Wp[n + j]; }
    for (let j = VL + 1; j < n + VL + 2; j++) { Ws[j] = 0; Wp[j] = 0; }
    if (!(vp === vp) || !(Ws[0] === Ws[0]) || !(Wp[0] === Wp[0])) { vp = 0; Ws.fill(0); Wp.fill(0); }
    this.vp = vp; this.pwPrev = pwPrev === pwPrev ? pwPrev : 0.5;
    this.lp = lph === lph ? lph : 0;
    this.eg = eg === eg ? eg : 0;
    if (!Number.isFinite(z0 + z1 + z2 + z3)) { z0 = z1 = z2 = z3 = 0; hb.fill(0); this.cutLast = NaN; }
    this.z0 = (z0 > 1e-20 || z0 < -1e-20) ? z0 : 0; this.z1 = (z1 > 1e-20 || z1 < -1e-20) ? z1 : 0;
    this.z2 = (z2 > 1e-20 || z2 < -1e-20) ? z2 : 0; this.z3 = (z3 > 1e-20 || z3 < -1e-20) ? z3 : 0;
    for (let j = 0; j < 24; j++) { const v = hb[j]; if (!(v > 1e-20 || v < -1e-20)) hb[j] = 0; }
    if (!(this.dcY > 1e-20 || this.dcY < -1e-20)) this.dcY = 0;
    if (!Number.isFinite(this.sqA + this.trA + this.sqY + this.trY)) { this.sqA = this.sqB = this.trA = this.trB = 0; this.sqY = 1; this.trY = -1; }

    // UI: step, run, sounding key, gate, beat - at most every 20 ms
    const end = abs0 + n;
    if (this.beat && end >= this.beatOffAt) { this.beat = 0; this.uiDirty = true; }
    const tEnd = t0 + n / sr;
    if (this.uiDirty && tEnd - this.uiLast >= 0.02) {
      const intG = this.seqGate || this.kbGate;
      const key = intG ? (this.seqGate ? this.seqNote : this.kbNote) : -1;
      this.port.postMessage({
        t: 's', step: this.pos, run: !this.audition && this.running ? 1 : 0, key, gate: intG ? 1 : 0,
        beat: this.beat, tr: this.transpose, acc: this.accentOn, time: tEnd,
      });
      this.uiDirty = false; this.uiLast = tEnd;
    }
    return true;
  }
}

registerProcessor('mother32', Mother32Processor);
