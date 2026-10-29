/* eslint-disable */
// ============================================================================
// MOTHER-32 - the whole Moog Mother-32 in one AudioWorkletProcessor ('mother32').
//
//  KB / SEQUENCER / MIDI -> KB CV (GLIDE, bend) -> VCO (FREQUENCY, 1V/OCT, VCO MOD, LIN FM)
//                                                   -> SAW / PULSE -> VCO WAVE -+
//  NOISE (normalled to EXT. AUDIO) -------------------------------------> MIX (AC coupled)
//  GATE (keys / steps, OR the GATE jack) -> EG --+-> VCO MOD (EG normal | jack | LFO) -> FREQ / PW
//                                                +-> VCF MOD (EG | LFO, +/-) -> 4-pole LADDER (LP / HP)
//                                                +-> VCA (EG | ON) + VCA CV -> VOLUME -> VCA jack / out
//  LFO (triangle + square, 0.1-350 Hz, 1 V/oct CV, 600 Hz max);  VC MIX, MULT and ASSIGN utilities.
//  32-step sequencer (Mother-32 manual v2 pp.18-45, 54-57): internal clock (TEMPO 20-300 BPM,
//  24 clock divisions, swing amount and swing interval), MIDI-style studio transport, or the
//  TEMPO jack (CV, single clock advance, analog clock at the Setup PPQN, step address CV) by the
//  manual's priority rules; forward / reverse / pendulum / random; RUN/STOP, RESET and HOLD jacks;
//  per-step gate length, ratchet, glide, accent and rest; live accent, mute and ratchet; delayed
//  pattern change.
//
// Why one processor: sample-accurate envelopes and sequencing, zero-latency self-patching (an
// internal patch matrix, one sample late, no Web Audio cycles) and one node per instance with
// no AudioParams at all (each costs CPU every quantum even when idle). Cables from other
// instruments arrive on 18 mono audio inputs (1.0 = 5 V), connected only while patched; clock
// and gate events from EventBus cables arrive as timed messages. Nothing is allocated per
// quantum (WebKit runs 128-frame quanta and a GC pause there is a click).
//
// Output: one output, 14 channels (1.0 = 5 V):
//   0 VCA jack (post VOLUME)  1 NOISE  2 VCF  3 VCO SAW  4 VCO PULSE  5 LFO TRI  6 LFO SQ
//   7 VC MIX  8 MULT (both MULT jacks)  9 ASSIGN  10 EG  11 KB  12 GATE  13 main bus (studio level)
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

/** A soft limit: unity up to `knee`, then a tanh knee toward `max` - an output stage near its rails */
function rail(x, knee, max) {
  const w = max - knee;
  if (x > knee) return knee + w * tanhF((x - knee) / w);
  if (x < -knee) return -knee - w * tanhF((-x - knee) / w);
  return x;
}

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
const K_TEMPO_MODE = 27, K_MODE = 28, K_REC = 29, K_QUALITY = 30, K_DIR = 31, K_SWDIV = 32, K_PPQN = 33;
const K_TIN_RANGE = 34, K_ACC_CV = 35, NK = 36;

const I_EXT = 0, I_MIXCV = 1, I_VCACV = 2, I_CUT = 3, I_RES = 4, I_VOCT = 5, I_LINFM = 6, I_VMOD = 7;
const I_LFORATE = 8, I_MIX1 = 9, I_MIX2 = 10, I_VCMIX = 11, I_MULT = 12, I_GATE = 13, I_TEMPO = 14;
const I_RUN = 15, I_RESET = 16, I_HOLD = 17, NIN = 18;

const O_VCA = 0, O_NOISE = 1, O_VCF = 2, O_SAW = 3, O_PULSE = 4, O_TRI = 5, O_SQ = 6, O_VCMIX = 7;
const O_MULT = 8, O_ASSIGN = 9, O_EG = 10, O_KB = 11, O_GATE = 12, O_MAIN = 13, NOUT = 14;

// Clock divisions in 24-PPQN ticks (devices/mother32/model.ts DIVISIONS): three groups of eight
// note values, two whole notes to 1/64 - straight, dotted, triplet (manual p.54)
const DIV_TICKS = [
  192, 96, 48, 24, 12, 6, 3, 1.5,
  288, 144, 72, 36, 18, 9, 4.5, 2.25,
  128, 64, 32, 16, 8, 4, 2, 1,
];
const DIV_DEFAULT = 5; // 1/16

// ---------------------------------------------------------------------------
// Scaling (volts). See REFERENCE.md "Model choices".
// ---------------------------------------------------------------------------

const C4 = 261.6255653;       // FREQUENCY centre, KB 0 V
const EG_PEAK = 7.5;          // EG output 0 .. +7.5 V (manual p.53)
const VMOD_OCT_PER_V = 0.5;   // VCO MOD (FREQ) at full AMOUNT: EG 3.75 oct, LFO +/-2.5 oct
const VMOD_PW_PER_V = 0.096;  // VCO MOD (PW) at full AMOUNT: LFO +/-5 V = +/-48 % width
const FMOD_OCT_PER_V = 0.9;   // VCF MOD at full AMOUNT: EG 6.75 oct, LFO +/-4.5 oct
const ACCENT_OCT = 1.0;       // accent: cutoff up one octave...
const ACCENT_GAIN = 0.333;    // ...and +2.5 dB at the VCA, a fixed level (manual p.18)
const RES_K = 5.4;            // ladder feedback at RESONANCE 100 % (self-oscillates from ~3 o'clock)
const HP_K = 2.5;             // HI PASS feedback at RESONANCE 100 %: well below oscillation (non-resonant HP)
const LADDER_HEADROOM = 3;    // ladder input scaling (see the VCF)
const MAIN_GAIN = 1.5;        // VCA jack (1.0 = 5 V) to the studio's main bus (presets sit near -18 LUFS)
const TRIG_ON = 3.2, TRIG_OFF = 2.4;   // TEMPO / RUN / RESET / HOLD thresholds, about +3.2 V (manual p.56)
const GATE_ON = 2.0, GATE_OFF = 1.0;   // GATE input thresholds
const DEDUPE = 0.0015;        // an event and an audio pulse closer than this are one pulse
const LN15 = Math.log(15);    // TEMPO knob: 20 .. 300 BPM

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

const SRC_INT = 0, SRC_SYNC = 1, SRC_EXT = 2, SRC_ADDR = 3;

class Mother32Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    this.sr = sr;
    const k = new Float64Array(NK);
    // The manual's default panel (p.9) until the engine sends the real values
    k[K_WAVE] = 1; k[K_PW] = 0.5; k[K_CUTOFF] = 350; k[K_RES] = 0.05; k[K_VCA_MODE] = 1; k[K_VOLUME] = 0.5;
    k[K_VMOD_SRC] = 1; k[K_VMOD_DEST] = 1; k[K_VCF_MODE] = 1; k[K_FMOD_AMT] = 0.5; k[K_TEMPO] = 120;
    k[K_LFO_RATE] = 5.9; k[K_LFO_WAVE] = 1; k[K_ATTACK] = 0.00125; k[K_DECAY] = 0.18; k[K_VCMIX] = 0;
    k[K_SWING] = 0.5; k[K_DIV] = DIV_DEFAULT; k[K_SWDIV] = DIV_DEFAULT; k[K_ASSIGN] = 1; k[K_TEMPO_MODE] = 1;
    k[K_QUALITY] = 1; k[K_PPQN] = 4;
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

    // The pattern (devices/mother32/sequence.ts): notes are MIDI numbers, -1 = rest
    this.notes = new Int16Array(32).fill(48);
    this.gate = new Uint8Array(32).fill(4);
    this.glide = new Uint8Array(32);
    this.ratchet = new Uint8Array(32).fill(1);
    this.accent = new Uint8Array(32);
    this.rest = new Uint8Array(32);
    this.len = 16;
    this.pend = null;             // a pattern waiting for the current one to finish (Delay Pattern Change)
    this.swapCount = 0;

    // Sequencer
    this.running = false;
    this.pos = -1;
    this.pdir = 1;                // pendulum direction
    this.cyc = 0;                 // steps played since the pattern (re)started
    this.runParity = 0;           // STEP TRIANGLE rises on even pattern runs, falls on odd ones
    this.forceStep = -1;          // step address mode: the step the TEMPO voltage picked
    this.clockSrc = SRC_INT;
    this.nextStepAt = -1;         // internal clock: absolute sample of the next step
    this.tau = 0;                 // internal clock: nominal position of the next step (24 PPQN ticks)
    this.stepLen = sr / 8;        // samples of the current step
    this.stepAt = 0;              // absolute sample the current step started
    this.gq = new Float64Array(48); this.gqN = 0; this.gqI = 0; // the step's gate events: [sample, on, retrigger]
    this.seqGate = false;
    this.seqNote = -1;
    this.tieOpen = false;         // the last step ended in a tie, so the next one is legato
    this.accentOn = 0;
    this.accLevel = 0;
    this.accPulse = 0;
    this.transpose = 0;
    this.holdBtn = false; this.holdJack = false;
    this.resetPending = false; this.resetJack = false;
    this.liveAccent = false; this.liveMute = false; this.liveRatchet = 0;
    this.runLatch = false;        // RUN / STOP: the button or the jack, whichever acted last
    this.runJack = false; this.runEvent = false;
    this.startFromTop = false;    // a MIDI-style Start (the studio transport) plays from step 1
    this.audition = false;
    this.editing = false;         // a step is being edited: MIDI notes set it instead of transposing
    this.armed = false;           // pre-armed for an external clock (KB + STEP + RUN / STOP)
    this.synced = false; this.tpPlaying = false; this.syncNext = 0; this.syncFirst = true;
    this.tempoHigh = false; this.lastTempoAudio = -1; this.lastTempoEvent = -1;
    this.lastEdgeAt = -1; this.edgeInterval = sr / 8;
    this.extActive = false;       // a clock was detected at TEMPO; it overrides MIDI and internal clocks
    this.extT = 0; this.extNext = 0; this.extFirst = true;
    this.addrStep = -1; this.addrActive = false;
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
    this.bend = 0;                // -1 .. 1
    this.bendRange = 12;          // semitones: +/-1 octave by default, 0-12 by RPN 0 (manual p.57)
    this.portaOn = true;          // CC 65
    this.portaTime = -1;          // CC 5 (seconds) until the GLIDE knob moves; -1 = the knob
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

    // Mixer AC coupling (the mixer is AC coupled, manual p.13) and the ladder
    this.acX = 0; this.acY = 0; this.acR = 1 - (2 * Math.PI * 4) / sr;
    this.z0 = 0; this.z1 = 0; this.z2 = 0; this.z3 = 0;
    this.hb = new Float64Array(24);
    this.cutLast = NaN; this.gCut = 0;
    this.quality = 1;
    this.resCv = 0;                                     // VCF RES jack after its slew
    this.resSlew = 1 - Math.exp(-1 / (0.0015 * sr));

    // Main-bus DC blocker (the jacks are DC coupled like the hardware)
    this.dcX = 0; this.dcY = 0; this.dcR = 1 - (2 * Math.PI * 6) / sr;
    this.dc2X = 0; this.dc2Y = 0; this.dc2R = 1 - (2 * Math.PI * 3) / sr;   // after the output rail

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
        const before = this.k[i];
        this.k[i] = m.v;
        if (this.fresh || !IS_SMOOTHED[i]) this.s[i] = m.v;
        if (i === K_CUTOFF && this.fresh) this.cutLog = Math.log2(clamp(m.v, 5, 22000));
        if (i === K_QUALITY) {
          const q = m.v >= 0.5 ? 1 : 0;
          if (q !== this.quality) { this.quality = q; this.hb.fill(0); this.cutLast = NaN; }
        }
        if (i === K_RUN) this.runButton(m.v > 0.5);
        if (i === K_TEMPO_MODE && m.v !== before) { this.extActive = false; this.armed = false; this.addrActive = false; this.addrStep = -1; }
        if (i === K_GLIDE) this.portaTime = -1;
        break;
      }
      case 'seq':
        // Delay Pattern Change: while playing, a newly selected pattern waits for this one to finish
        if (m.q && this.running) this.pend = m;
        else this.loadSeq(m);
        break;
      case 'unqueue': this.pend = null; break;
      case 'patched':
        this.patched[m.i] = m.v ? 1 : 0;
        if (!m.v) {
          if (m.i === I_RUN) { this.runJack = false; this.runEvent = false; }
          if (m.i === I_HOLD) this.holdJack = false;
          if (m.i === I_RESET) this.resetJack = false;
          if (m.i === I_GATE) this.extGate = false;
        }
        if (m.i === I_TEMPO) {
          this.tempoHigh = false; this.lastEdgeAt = -1; this.addrStep = -1; this.addrActive = false;
          if (!m.v) { this.extActive = false; this.armed = false; }
        }
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
      case 'bendRange': this.bendRange = clamp(Math.round(+m.v || 0), 0, 12); break;
      case 'sus': this.push(0, 'sus', m.v); break;
      case 'cc': {
        const v = clamp(+m.v || 0, 0, 1);
        if (m.n === 5) this.portaTime = v * v * 2;            // CC 5 portamento time (the GLIDE law)
        else if (m.n === 65) this.portaOn = v >= 0.5;          // CC 65 portamento on / off
        else {
          const slot = m.n === 1 ? 0 : m.n === 2 ? 1 : m.n === 4 ? 2 : m.n === 7 ? 3 : -1;
          if (slot >= 0) this.cc[slot] = v;
        }
        break;
      }
      case 'pressure': this.pressure = clamp(+m.v || 0, 0, 1); break;
    }
  }

  loadSeq(m) {
    const n = m.notes, g = m.gate, gl = m.glide, r = m.ratchet, a = m.accent, rs = m.rest;
    for (let i = 0; i < 32; i++) {
      this.notes[i] = n[i]; this.gate[i] = g[i]; this.glide[i] = gl[i];
      this.ratchet[i] = r[i]; this.accent[i] = a[i]; this.rest[i] = rs[i];
    }
    this.len = clamp(m.len | 0, 1, 32);
    if (this.pos >= this.len) this.pos = this.len - 1;
    this.uiDirty = true;
  }

  /** The RUN / STOP button (or the run_stop control): the last action on the button or jack wins */
  runButton(on) {
    this.runLatch = on;
    this.armed = false;
    this.addrActive = false; // step address mode: RUN / STOP restores normal playback
    // Single Clock Advance: pressing RUN / STOP brings the internal clock back (manual p.55)
    if ((this.k[K_TEMPO_MODE] | 0) === 1) this.extActive = false;
  }

  /** Time-sorted event queue */
  push(time, ch, a, b, c) {
    const q = this.queue;
    const ev = { time, ch, a, b, c };
    if (!q.length || q[q.length - 1].time <= time) { q.push(ev); return; }
    let i = q.length - 1;
    while (i > 0 && q[i - 1].time > time) i--;
    q.splice(i, 0, ev);
  }

  // -------------------------------------------------------------------------
  // Sequencer
  // -------------------------------------------------------------------------

  /** Samples per 24-PPQN tick of the internal clock (TEMPO knob, plus the TEMPO jack in CV mode) */
  samplesPerTick() {
    let bpm = this.k[K_TEMPO];
    if (this.patched[I_TEMPO] && (this.k[K_TEMPO_MODE] | 0) === 0) {
      // CV mode: with the knob centred, -5..+5 V (or 0..+5 V, Setup page 8) sweeps 20-300 BPM
      const v = this.inV[I_TEMPO];
      const off = this.k[K_TIN_RANGE] > 0.5 ? (clamp(v, 0, 5) - 2.5) / 5 : clamp(v, -5, 5) / 10;
      const n = clamp(Math.log(clamp(bpm, 20, 300) / 20) / LN15 + off, 0, 1);
      bpm = 20 * Math.exp(n * LN15);
    }
    return (60 / clamp(bpm, 4, 2400) / 24) * this.sr;
  }

  /**
   * Swing as a time warp (manual pp.19-21): over every two swing intervals the on beat takes
   * SWING AMOUNT of the time and the off beat the rest; steps fall where they fall, so a step
   * that straddles the change "completes its remaining duration at the rate" of the other beat.
   */
  warp(tau) {
    const s = this.k[K_SWING];
    if (s > 0.4999 && s < 0.5001) return tau;
    const I = DIV_TICKS[this.k[K_SWDIV] | 0] || 6;
    const P = 2 * I;
    const base = Math.floor(tau / P) * P;
    const ph = tau - base;
    return base + (ph < I ? ph * 2 * s : 2 * I * s + (ph - I) * 2 * (1 - s));
  }

  /** What advances the steps: internal clock, the studio transport, TEMPO-jack clock or step address */
  clockSource() {
    if (this.audition) return SRC_INT;
    if (this.patched[I_TEMPO]) {
      const mode = this.k[K_TEMPO_MODE] | 0;
      if (mode === 3 && this.addrActive) return SRC_ADDR;
      // Priority (manual p.55): an analog clock overrides MIDI clock and the internal clock
      if (this.extActive && (mode === 1 || mode === 2)) return SRC_EXT;
    }
    return this.synced ? SRC_SYNC : SRC_INT;
  }

  wantRun() {
    if (this.audition) return true;
    if (this.k[K_REC] > 0.5 || this.armed) return false;
    if (this.synced) return this.tpPlaying || (!!this.patched[I_RUN] && (this.runJack || this.runEvent));
    return this.runLatch;
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
      if (this.running) {
        if (src === SRC_INT) { this.nextStepAt = at; this.tau = 0; }
        if (src === SRC_SYNC) this.syncFirst = true;
        if (src === SRC_EXT) this.extFirst = true;
      }
    }
  }

  startRun(at) {
    this.running = true;
    // RUN / STOP pauses and resumes (manual p.28); a MIDI-style Start plays from step 1
    if (this.startFromTop || this.audition) { this.pos = -1; this.pdir = 1; this.cyc = 0; this.runParity = 0; }
    this.startFromTop = false;
    this.stepCount = 0;
    this.tau = 0;
    this.syncFirst = true;
    this.extFirst = true;
    this.tieOpen = false;
    this.nextStepAt = at;         // the internal clock plays the next step at once
    this.uiDirty = true;
  }

  stopRun() {
    this.running = false;
    this.gqN = 0; this.gqI = 0;
    this.seqGate = false;
    this.tieOpen = false;
    this.accentOn = 0;
    this.nextStepAt = -1;
    this.uiDirty = true;
  }

  /** The next step for the playback direction (manual p.40) */
  nextIndex(L) {
    const p = this.pos >= L ? L - 1 : this.pos;
    switch (this.k[K_DIR] | 0) {
      case 1: return p < 0 ? L - 1 : (p - 1 + L) % L;           // reverse
      case 2: {                                                   // pendulum
        if (L <= 1) return 0;
        if (p < 0) { this.pdir = 1; return 0; }
        let n = p + this.pdir;
        if (n >= L) { this.pdir = -1; n = L - 2; } else if (n < 0) { this.pdir = 1; n = 1; }
        return n;
      }
      case 3: {                                                   // random
        let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0;
        return Math.min(L - 1, Math.floor((this.rng / 4294967296) * L));
      }
      default: return p < 0 ? 0 : (p + 1) % L;                    // forward
    }
  }

  firstIndex(L) { return (this.k[K_DIR] | 0) === 1 ? L - 1 : 0; }

  isCycleStart(s, L) {
    const dir = this.k[K_DIR] | 0;
    if (dir === 3) return this.cyc >= L;
    return s === (dir === 1 ? L - 1 : 0);
  }

  applyPending() {
    if (!this.pend) return;
    this.loadSeq(this.pend);
    this.pend = null;
    this.swapCount++;
  }

  gpush(at, on, re) {
    if (this.gqN > 45) return;
    const q = this.gq;
    q[this.gqN] = at; q[this.gqN + 1] = on; q[this.gqN + 2] = re;
    this.gqN += 3;
  }

  /** Play the next step at absolute sample `at`; it lasts `len` samples (0 = a swung-away step) */
  playStep(at, len) {
    let L = this.len;
    let s;
    const silent = len < this.sr * 0.001;
    if (this.forceStep >= 0) { s = Math.min(this.forceStep, L - 1); this.forceStep = -1; }
    else if (this.resetJack) { s = 0; this.cyc = 0; this.pdir = 1; }
    else if ((this.holdBtn || this.holdJack) && this.pos >= 0) s = Math.min(this.pos, L - 1);
    else if (this.resetPending) {
      this.resetPending = false; this.pdir = 1; this.cyc = 0;
      this.applyPending(); L = this.len; s = this.firstIndex(L);
    } else {
      s = this.nextIndex(L);
      if (this.isCycleStart(s, L)) {
        if (this.pos >= 0) this.runParity ^= 1;
        if (this.pend) { this.applyPending(); L = this.len; s = this.firstIndex(L); }
        this.cyc = 0;
      }
    }
    this.cyc++;
    this.pos = s;
    this.stepCount++;
    this.uiDirty = true;
    // ASSIGN step-random value, -5 .. +5 V
    let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0;
    this.randV = (this.rng / 4294967296) * 10 - 5;
    if (silent) return;          // swing at 0 % / 100 %: this beat has no time, so it is not heard
    this.stepLen = len;
    this.stepAt = at;
    // TEMPO LED: on the beat
    const div = DIV_TICKS[this.k[K_DIV] | 0] || 6;
    const beatEvery = Math.max(1, Math.round(24 / div));
    if ((this.stepCount - 1) % beatEvery === 0) { this.beat = 1; this.beatOffAt = at + Math.min(len * 0.5, this.sr * 0.06); }

    this.gqN = 0; this.gqI = 0;
    const note = this.notes[s];
    if (this.rest[s] || note < 0 || this.liveMute) {
      if (this.seqGate) this.gpush(at, 0, 0);
      this.tieOpen = false;
      this.accentOn = 0;
      return;
    }
    const n = note + this.transpose;
    this.seqNote = n;
    this.accentOn = (this.accent[s] || this.liveAccent) ? 1 : 0;
    this.setPitch((n - 60) / 12, this.glide[s] && this.glideTime() > 0.0005);
    const g = this.gate[s] || 4;
    const r = this.liveRatchet > 0 ? this.liveRatchet : (this.ratchet[s] || 1);
    const legato = this.tieOpen && this.seqGate;
    if (r <= 1) {
      if (!legato) this.gpush(at, 1, 1);
      if (g >= 8) this.tieOpen = true;
      else { this.tieOpen = false; this.gpush(at + Math.max(24, Math.round(len * g / 8)), 0, 0); }
    } else {
      this.tieOpen = false;
      const sub = len / r;
      const gl = Math.max(24, Math.round(sub * (g >= 8 ? 0.875 : g / 8)));
      for (let j = 0; j < r; j++) {
        const on = Math.round(at + j * sub);
        if (!(j === 0 && legato)) this.gpush(on, 1, 1);
        this.gpush(on + gl, 0, 0);
      }
    }
  }

  glideTime() { return this.portaTime >= 0 ? this.portaTime : this.k[K_GLIDE]; }

  setPitch(v, glide) {
    this.kbTarget = v;
    if (glide) {
      this.glideOn = true;
      this.glideCoef = 1 - Math.exp(-3 / (Math.max(0.001, this.glideTime()) * this.sr));
    } else {
      this.glideOn = false;
      this.kbV = v;
    }
  }

  /** Internal clock: play the steps that are due at `now` */
  internalStep(now) {
    const spt = this.samplesPerTick();
    const D = DIV_TICKS[this.k[K_DIV] | 0] || 6;
    for (let guard = 0; guard < 8; guard++) {
      const len = (this.warp(this.tau + D) - this.warp(this.tau)) * spt;
      this.tau += D;
      this.playStep(now, len);
      if (len >= this.sr * 0.001) { this.nextStepAt = now + Math.max(1, Math.round(len)); break; }
    }
    // keep the nominal clock small (the warp repeats every two swing intervals)
    const P = 2 * (DIV_TICKS[this.k[K_SWDIV] | 0] || 6);
    if (this.tau > 1e6) this.tau -= Math.floor(this.tau / P) * P;
  }

  /** Studio transport tick (24 PPQN, audio time): steps land on the division grid, swung */
  onTick(ev) {
    if (!this.running || this.clockSrc !== SRC_SYNC) return;
    const T = ev.a, dur = ev.b * this.sr;
    const D = DIV_TICKS[this.k[K_DIV] | 0] || 6;
    if (this.syncFirst) { this.syncFirst = false; this.syncNext = Math.ceil(T / D - 1e-9) * D; }
    const tickAt = ev.time * this.sr;
    for (let guard = 0; guard < 24; guard++) {
      const w = this.warp(this.syncNext);
      if (w >= T + 1 - 1e-9) break;
      if (w >= T - 1e-9) {
        const at = tickAt + (w - T) * dur;
        this.push(at / this.sr, 'step', at, (this.warp(this.syncNext + D) - w) * dur, SRC_SYNC);
      }
      this.syncNext += D;
    }
  }

  /** A rising edge at the TEMPO jack (Single Clock Advance or Analog Clock, manual p.55) */
  tempoEdge(at) {
    if (this.lastEdgeAt >= 0) this.edgeInterval = clamp(at - this.lastEdgeAt, 32, this.sr * 4);
    this.lastEdgeAt = at;
    const mode = this.k[K_TEMPO_MODE] | 0;
    if (mode !== 1 && mode !== 2) return;
    if (!this.extActive) { this.extActive = true; this.extFirst = true; }
    this.armed = false;           // a pre-armed sequencer starts on this clock
    this.updateRun(at);
    if (!this.running || this.clockSrc !== SRC_EXT) return;
    if (mode === 1) { this.playStep(at, this.edgeInterval); return; }   // one step per rising edge
    // Analog Clock: pulses at the Setup page 4 PPQN; the steps follow the division and swing
    const tpp = 24 / Math.max(1, this.k[K_PPQN]);
    const D = DIV_TICKS[this.k[K_DIV] | 0] || 6;
    if (this.extFirst) { this.extFirst = false; this.extT = 0; this.extNext = 0; }
    const iv = this.edgeInterval;
    for (let guard = 0; guard < 32; guard++) {
      const w = this.warp(this.extNext);
      if (w >= this.extT + tpp - 1e-9) break;
      if (w >= this.extT - 1e-9) {
        const t = at + ((w - this.extT) / tpp) * iv;
        this.push(t / this.sr, 'step', t, ((this.warp(this.extNext + D) - w) / tpp) * iv, SRC_EXT);
      }
      this.extNext += D;
    }
    this.extT += tpp;
  }

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  noteOn(note, vel) {
    this.velocity = vel === undefined ? 1 : clamp(vel, 0, 1);
    if (this.running && !this.audition) {
      // While the sequencer runs, notes transpose the pattern in KB and STEP mode (low C at
      // octave 4 = no transposition) - unless a step is being edited, when they set its note
      if (!this.editing) { this.transpose = clamp(note - 48, -36, 36); this.uiDirty = true; }
      return;
    }
    const legato = this.held.length > 0 || this.kbGate;
    const i = this.held.indexOf(note);
    if (i >= 0) this.held.splice(i, 1);
    this.held.push(note);
    this.kbNote = note;
    this.setPitch((note - 60) / 12, this.portaOn && this.glideTime() > 0.0005 && this.kbV > -9);
    // SUSTAIN ON plays legato (single trigger), SUSTAIN OFF retriggers every note (manual p.16)
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
        this.setPitch((last - 60) / 12, this.portaOn && this.glideTime() > 0.0005);
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
      case 'b-run': this.runButton(ev.a > 0.5); break;
      case 'b-arm':
        // KB + STEP + RUN / STOP with the TEMPO input in Single Clock Advance or Analog Clock mode
        if (!this.synced && this.patched[I_TEMPO] && ((this.k[K_TEMPO_MODE] | 0) === 1 || (this.k[K_TEMPO_MODE] | 0) === 2)) {
          this.runLatch = true; this.armed = true; this.uiDirty = true;
        }
        break;
      case 'b-reset':
        if (this.running) this.resetPending = true;
        else { this.pos = -1; this.pdir = 1; this.cyc = 0; this.applyPending(); }
        this.uiDirty = true;
        break;
      case 'b-hold': this.holdBtn = ev.a > 0.5; break;
      case 'b-accent': this.liveAccent = ev.a > 0.5; break;
      case 'b-mute': this.liveMute = ev.a > 0.5; break;
      case 'b-lratchet': this.liveRatchet = clamp(ev.a | 0, 0, 4); break;
      case 'b-editing': this.editing = ev.a > 0.5; break;
      case 'b-transpose': this.transpose = ev.a | 0; this.uiDirty = true; break;
      case 'b-audition':
        if (ev.a > 0.5) { if (!this.audition && !this.running) this.audition = true; }
        else if (this.audition) { this.audition = false; this.pos = -1; }
        break;
      case 'b-preview':
        // A short note (step edit / recording feedback) while the sequencer is stopped
        if (this.running || this.held.length) break;
        this.kbNote = ev.a;
        this.setPitch((ev.a - 60) / 12, false);
        this.kbGate = true; this.trigPending = true;
        this.previewOff = now + Math.round(this.sr * 0.2);
        break;
      case 'tp-start': this.tpPlaying = true; this.startFromTop = true; break;
      case 'tp-stop': this.tpPlaying = false; break;
      case 'tick': this.onTick(ev); break;
      case 'step': if (this.running && this.clockSrc === ev.c) this.playStep(Math.max(now, Math.round(ev.a)), ev.b); break;
      case 'tempo':
        if (Math.abs(ev.time - this.lastTempoAudio) < DEDUPE) break;
        this.lastTempoEvent = ev.time;
        if (ev.a > 0.5) this.tempoEdge(now);
        break;
      case 'run':
        this.runEvent = ev.a > 0.5;
        this.runLatch = this.runEvent;
        break;
      case 'reset': if (ev.a > 0.5) { if (this.running) this.resetPending = true; else { this.pos = -1; this.pdir = 1; } } break;
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
    const vmodLfo = k[K_VMOD_SRC] > 0.5;            // ['EG / VCO MOD', 'LFO']
    const vmodFreq = k[K_VMOD_DEST] > 0.5;          // ['PULSE WIDTH', 'FREQUENCY']
    const lp = k[K_VCF_MODE] > 0.5;                 // ['HI PASS', 'LOW PASS']
    const fmodLfo = k[K_FMOD_SRC] > 0.5;            // ['EG', 'LFO']
    const fmodSign = k[K_FMOD_POL] > 0.5 ? -1 : 1;  // ['+', '-']
    const lfoTri = k[K_LFO_WAVE] > 0.5;             // ['SQUARE', 'TRIANGLE']
    const vcaOn = k[K_VCA_MODE] < 0.5;              // ['ON', 'EG']
    const sustainOn = k[K_SUSTAIN] < 0.5;           // ['ON', 'OFF']
    const extOn = !!patched[I_EXT], vmodExt = !!patched[I_VMOD];
    const mix1P = !!patched[I_MIX1], mix2P = !!patched[I_MIX2];
    const assignSrc = k[K_ASSIGN] | 0;
    // Setup page 8 "Accent Out CV Only": with ASSIGN on ACCENT the internal accent is off
    const accInt = !(k[K_ACC_CV] > 0.5 && assignSrc === 0);
    const quality = this.quality;
    const nyq = 0.45 * sr, wScale = Math.PI / (sr * (quality ? 2 : 1));
    const egAtk = 1 - Math.exp(-LN3 / (Math.max(0.0005, k[K_ATTACK]) * sr));
    const egDec = Math.exp(-4.6 / (Math.max(0.0005, k[K_DECAY]) * sr));
    const tempoMode = k[K_TEMPO_MODE] | 0;

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

    // Analog Clock mode: the clock has stopped (no edge for a while) - MIDI or internal clock again
    if (this.extActive && tempoMode === 2 && this.lastEdgeAt >= 0 && abs0 - this.lastEdgeAt > Math.max(sr * 1.5, this.edgeInterval * 4)) {
      this.extActive = false;
    }

    const oMain = out[O_MAIN], oVcaJ = out[O_VCA], oNoise = out[1], oVcf = out[2], oSaw = out[3], oPulse = out[4], oTri = out[5], oSq = out[6];
    const oVcMix = out[7], oMult = out[8], oAssign = out[9], oEg = out[10], oKb = out[11], oGate = out[12];

    let vp = this.vp, pwPrev = this.pwPrev, lph = this.lp;
    let z0 = this.z0, z1 = this.z1, z2 = this.z2, z3 = this.z3;
    const hb = this.hb;
    let eg = this.eg;
    const queue = this.queue;
    const gq = this.gq;
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
        if (!this.runJack && v > TRIG_ON) { this.runJack = true; this.runLatch = true; this.updateRun(now); }
        else if (this.runJack && v < TRIG_OFF) { this.runJack = false; this.runLatch = false; this.updateRun(now); }
      }
      if (patched[I_RESET]) { const v = inV[I_RESET]; if (!this.resetJack && v > TRIG_ON) { this.resetJack = true; this.uiDirty = true; if (!this.running) { this.pos = -1; this.pdir = 1; } } else if (this.resetJack && v < TRIG_OFF) this.resetJack = false; }
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
        if (tempoMode === 1 || tempoMode === 2) {
          // a rising edge faster than 1 V / ms (manual p.55): a threshold crossing between samples
          if (!this.tempoHigh && v > TRIG_ON) {
            this.tempoHigh = true;
            if (Math.abs(t - this.lastTempoEvent) >= DEDUPE) { this.lastTempoAudio = t; this.tempoEdge(now); }
          } else if (this.tempoHigh && v < TRIG_OFF) this.tempoHigh = false;
        } else if (tempoMode === 3) {
          // Step address: the voltage picks the step (-5..+5 V, or 0..+5 V, across the pattern)
          const lo = k[K_TIN_RANGE] > 0.5 ? 0 : -5, span = k[K_TIN_RANGE] > 0.5 ? 5 : 10;
          const st = clamp(Math.floor(((v - lo) / span) * this.len), 0, this.len - 1);
          if (st !== this.addrStep) {
            const first = this.addrStep < 0;
            this.addrStep = st;
            if (!first && this.running) {
              this.addrActive = true;
              this.updateRun(now);
              const hold = this.holdBtn; this.holdBtn = false;
              this.forceStep = st;
              this.playStep(now, (DIV_TICKS[k[K_DIV] | 0] || 6) * this.samplesPerTick());
              this.holdBtn = hold;
            }
          }
        }
      }
      if (this.running && this.clockSrc === SRC_INT && this.nextStepAt >= 0 && now >= this.nextStepAt) this.internalStep(now);

      // ---- the current step's gates (gate length, ratchets) ----
      while (this.gqI < this.gqN && gq[this.gqI] <= now) {
        if (gq[this.gqI + 1]) { this.seqGate = true; if (gq[this.gqI + 2]) this.trigPending = true; }
        else this.seqGate = false;
        this.gqI += 3;
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
      const kbOut = this.kbV + this.bend * (this.bendRange / 12);

      // ---- accent (smoothed, follows the step) ----
      this.accLevel += ((this.running ? this.accentOn : 0) - this.accLevel) * 0.004;
      const accL = accInt ? this.accLevel : 0;

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
      // the knob spans 2-98 %, but modulation can reach 0 % / 100 %, where the pulse cuts out (manual p.11)
      if (pw < 0) pw = 0; else if (pw > 1) pw = 1;
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

      // ---- mixer: VCO wave <-> NOISE / EXT. AUDIO (MIX CV sums: +/-5 V = the whole travel) ----
      let m = s[K_MIX];
      if (patched[I_MIXCV]) { m += inV[I_MIXCV] * 0.1; if (m < 0) m = 0; else if (m > 1) m = 1; }
      const wave = sawSel ? saw : pul;
      let ext = noise;
      if (extOn) {
        // EXT. AUDIO: unity at Eurorack level, soft-limited like an op-amp input stage near the rails
        ext = inV[I_EXT] * 0.2;
        if (ext > 0.9 || ext < -0.9) ext = 1.35 * tanhF(ext / 1.35);
      }
      const mixDC = wave + (ext - wave) * m;
      // AC coupling: DC (a static CV into EXT. AUDIO, a 0 % / 100 % pulse) does not reach the filter
      const mix = mixDC - this.acX + this.acR * this.acY;
      this.acX = mixDC; this.acY = mix;

      // ---- VCF: cutoff = knob + CV (1 V/oct) + VCF MOD + accent ----
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
      // VCF RES jack: with the knob centred, -5..+5 V sweeps minimum to maximum (manual p.48). The
      // jack reaches the feedback (and the make-up gain below) through a ~1.5 ms slew, like the VCA
      // in a real feedback path, so a stepped CV (ASSIGN STEP RANDOM) cannot click the output level.
      if (patched[I_RES]) {
        this.resCv += (inV[I_RES] * 0.1 - this.resCv) * this.resSlew;
        res += this.resCv;
        if (res < 0) res = 0; else if (res > 1) res = 1;
      } else this.resCv = 0;
      // LOW PASS: the resonant 4-pole ladder (a little make-up gain for the Moog bass loss).
      // HI PASS: the filter's input minus the ladder low-pass. It is non-resonant (manual p.14): the
      // feedback stays far below oscillation, so RESONANCE leaves only a gentle bump at the cutoff
      // (+4 dB at full) - the "peaking filter" reviewers describe. What RESONANCE does here is let
      // the bass back in, as the manual warns: the fed-back low-pass no longer cancels the low band
      // (gain k / (1 + k) at DC, -3 dB at full).
      const kf = lp ? res * RES_K : res * HP_K;
      const inGain = lp ? (1 + 0.5 * res) : 1, outGain = lp ? (1 + 0.3 * res) : 1;
      // The ladder runs in units of LADDER_HEADROOM volts/5, so the input pair compresses a full VCO
      // only gently and self-oscillation can reach VCO level. A whisper of noise (-100 dB), as in any
      // analog circuit, lets self-oscillation start from silence.
      const xin = (mix + noise * 1e-5) * inGain * (1 / LADDER_HEADROOM);
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
        filt = lp ? y4 : xin - y4;
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
          const y = lp ? y4 : xsub - y4;
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
      // The VCF jack, 1.0 = 5 V: self-oscillation about +/-4.5 V; the output stage limits near
      // +/-5.5 V, so feedback patches (VCF -> EXT. AUDIO) stay at the manual's "about +/-5 V" (p.48)
      const vcf = rail(filt * LADDER_HEADROOM * outGain, 0.95, 1.15);

      // ---- VCA (manual p.47): EG mode 0..+8 V of control (the EG reaches 7.5 V), ON mode +/-5 V
      //      about full level; the VCA CV sums with the switch. Accent adds a little; soft clip. ----
      let vg = vcaOn ? 1 : eg / EG_PEAK;
      if (patched[I_VCACV]) vg += vcaOn ? inV[I_VCACV] * 0.2 : inV[I_VCACV] / EG_PEAK;
      vg *= 1 + ACCENT_GAIN * accL;
      let amp = 0;
      if (vg > 0) {
        if (vg > 1) vg = 1 + 0.5 * tanhF((vg - 1) * 2);
        amp = vcf * vg;
        if (amp > 1.1 || amp < -1.1) { const c = 1.1 * tanhF(amp / 1.1); amp = c + (amp - c) * 0.2; }
      }
      const vol = s[K_VOLUME];
      const vca = amp * vol * vol;                  // VOLUME sets both the VCA jack and the audio out
      let main = vca * MAIN_GAIN;
      const dc = main - this.dcX + this.dcR * this.dcY;
      // The output rail comes last (a sub-audio square stepping through the DC blocker overshoots):
      // however hot the patch - VOLUME up, full RESONANCE, VCA CV on top - the output stays below 0 dBFS
      this.dcX = main; this.dcY = dc; main = rail(dc, 0.7, 0.98);
      // The rail clips a lopsided wave (a saw's edge overshoot) off-centre, which leaves a little DC
      // at VOLUME fully up; a slow second blocker takes it away, and a last ceiling keeps 0 dBFS
      const d2 = main - this.dc2X + this.dc2R * this.dc2Y;
      this.dc2X = main; this.dc2Y = d2; main = d2 > 0.995 ? 0.995 : d2 < -0.995 ? -0.995 : d2;

      // ---- VC MIX (DC coupled): MIX 1 (0 V normal) <-> MIX 2 (+5 V normal) ----
      let p = s[K_VCMIX];
      if (patched[I_VCMIX]) { p += inV[I_VCMIX] * 0.1; if (p < 0) p = 0; else if (p > 1) p = 1; }
      const m1 = mix1P ? inV[I_MIX1] : 0, m2 = mix2P ? inV[I_MIX2] : 5;
      const vcMix = m1 + (m2 - m1) * p;

      // ---- ASSIGN (Setup page 1, manual p.52) ----
      this.accPulse += ((this.accentOn && this.seqGate && this.running ? 1 : 0) - this.accPulse) * 0.02;
      let asg = 0;
      if (assignSrc >= 9) {
        // MIDI velocity, channel pressure, pitch bend and CC 1 / 2 / 4 / 7: -5 .. +5 V
        asg = assignSrc === 9 ? this.velocity * 10 - 5 : assignSrc === 10 ? this.pressure * 10 - 5
          : assignSrc === 11 ? this.bend * 5 : this.cc[assignSrc - 12] * 10 - 5;
      } else if (assignSrc === 0) {
        asg = this.accPulse * 5;                                                          // ACCENT (filtered pulse)
      } else if (this.running && this.pos >= 0) {
        const half = now - this.stepAt < this.stepLen * 0.5;
        const r = this.len > 1 ? this.pos / (this.len - 1) : 0;
        switch (assignSrc) {
          case 1: asg = half ? 5 : 0; break;                                                // CLOCK
          case 2: asg = half && ((this.stepCount - 1) & 1) === 0 ? 5 : 0; break;            // CLOCK / 2
          case 3: asg = half && ((this.stepCount - 1) & 3) === 0 ? 5 : 0; break;            // CLOCK / 4
          case 4: asg = r * 10 - 5; break;                                                  // STEP RAMP
          case 5: asg = 5 - r * 10; break;                                                  // STEP SAW
          case 6: asg = this.runParity ? 5 - r * 10 : r * 10 - 5; break;                    // STEP TRIANGLE
          case 7: asg = this.randV; break;                                                  // STEP RANDOM
          case 8: asg = this.pos === 0 && half ? 5 : 0; break;                              // STEP 1 TRIGGER
        }
      }

      // ---- outputs (1.0 = 5 V) ----
      const gateOut = intGate ? 1 : 0;
      const multV = patched[I_MULT] ? inV[I_MULT] : 0;
      oMain[i] = main;
      oVcaJ[i] = vca;
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
    if (!(this.dc2Y > 1e-20 || this.dc2Y < -1e-20)) this.dc2Y = 0;
    if (!(this.acY > 1e-20 || this.acY < -1e-20)) this.acY = 0;
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
        beat: this.beat, tr: this.transpose, acc: this.accentOn,
        ext: this.clockSrc === SRC_EXT || this.clockSrc === SRC_ADDR ? 1 : 0,
        arm: this.armed ? 1 : 0, swap: this.swapCount, pend: this.pend ? 1 : 0, time: tEnd,
      });
      this.uiDirty = false; this.uiLast = tEnd;
    }
    return true;
  }
}

registerProcessor('mother32', Mother32Processor);
