/* eslint-disable */
// ============================================================================
// Moog Subharmonicon - the whole instrument in one AudioWorkletProcessor
// ('subharmonicon'). Sources and confidence: devices/subharmonicon/REFERENCE.md.
//
//   master clock: TEMPO (1 PPQ) | a cable in CLOCK (every rising edge) |
//                 the studio transport (MIDI-style, one count per 16th note)
//        |
//   RHYTHM 1-4: phase counters, ÷1..16 --(OR / exactly-one XOR)--> SEQUENCER 1, SEQUENCER 2
//        SEQ ASSIGN OSC: the step (SEQ OCT range) moves its VCO's pitch, quantized
//        together with the FREQ knob; SEQ ASSIGN SUB: the raw step (before SEQ OCT
//        and QUANTIZE, manual p.56) moves the SUB FREQ knob's whole number
//   a move of either sequencer pulses TRIGGER OUT and, with EG lit, fires the VCF EG
//   and the VCA EG (neither restarts during its Attack stage); the TRIGGER button,
//   the TRIGGER jack (rising edge) and MIDI notes fire them too
//   VCO 1 --> SUB 1 (÷n), SUB 2 (÷m)   true dividers: each sub counts its VCO's
//   VCO 2 --> SUB 1, SUB 2             cycles and restarts with it, phase-locked
//   six sources -> MIXER (soft bus saturation near full levels)
//              -> 2x oversampled 4-pole transistor LADDER (LP 24 dB/oct)
//              -> VCA (VCA EG + VCA jack, summed) -> VOLUME -> out
//
// I/O
//   input 0  : 16 discrete channels, 1.0 = 5 V (INPUTS order in devices/subharmonicon/
//              model.ts). The engine connects it only while another instrument is
//              patched in; self-patches run through an internal patch matrix (volts,
//              one sample late), so they never form Web Audio cycles.
//   output 0 : main (the VCA jack's signal), 1 channel
//   output 1 : 15 jack channels (OUTPUTS order), filled only once a jack is patched
//   No AudioParams: each one costs CPU on every render quantum, idle or not.
//
// Oscillators are band-limited with 4-point polyBLEPs (integrated cubic B-spline,
// as in the shared 'vco') at every edge, including sub resets and moving pulse
// widths, plus the shared 3-tap presence FIR on the mix: 3 samples of latency.
// ============================================================================

const NSTEP = 4;

// Knob slots - the engine sends { t: 'k', i, v } in engine units (devices/subharmonicon/model.ts)
const K_F1 = 0, K_F2 = 1, K_D11 = 2, K_W1 = 6, K_W2 = 7, K_LV = 8; // levels: vco1 sub11 sub12 vco2 sub21 sub22
const K_ASSIGN = 14; // seq1: osc sub1 sub2, seq2: osc sub1 sub2
const K_OCT = 20, K_QUANT = 21, K_STEP = 22, K_RHY = 30, K_RA = 34;
const K_LOGIC = 42, K_TEMPO = 43, K_PLAY = 44, K_EG = 45, K_CUT = 46, K_RES = 47, K_EGAMT = 48, K_VOL = 49;
const K_VCF_A = 50, K_VCF_D = 51, K_VCA_A = 52, K_VCA_D = 53;
// SEQ OCT / QUANTIZE held until the LED flashes (manual pp.21, 28): the SEQ jacks stop following them
const K_FREE_OCT = 54, K_FREE_Q = 55, NK = 56;

// Patch points
const I_VCO1 = 0, I_SUB1 = 1, I_PWM1 = 2, I_VCA = 3, I_VCO2 = 4, I_SUB2 = 5, I_PWM2 = 6, I_CUT = 7;
const I_PLAY = 8, I_RESET = 9, I_TRIG = 10, I_RHY = 11, I_CLOCK = 15, NIN = 16;
const O_VCA = 0, O_VCO1 = 1, O_VCA_EG = 4, O_VCF_EG = 8, O_SEQ1 = 9, O_SEQ1_CLK = 10, O_SEQ2 = 11, O_SEQ2_CLK = 12;
const O_CLOCK = 13, O_TRIG = 14, NOUT = 15;
const SRC_OUT = [1, 2, 3, 5, 6, 7]; // source s (vco1 sub11 sub12 vco2 sub21 sub22) -> output channel

// EG modes and envelope stages
const EG_OFF = 0, EG_ON = 1, EG_HELD = 2;
const ST_IDLE = 0, ST_ATTACK = 1, ST_DECAY = 2, ST_HOLD = 3;

// Scaling (REFERENCE.md "Model choices")
const C4 = 261.6256;
const MAX_DIGITAL_OCT = Math.log2(10000 / C4); // the sequencers cannot push a VCO past ~10 kHz
const EG_VOLTS = 8;            // envelopes peak at +8 V
const VCF_EG_OCT = 6;          // VCF EG AMT fully clockwise: the full envelope moves the cutoff 6 octaves
const RES_SCALE = 1.25;        // RESONANCE travel -> ladder feedback (self-oscillation from ~78 %)
const DRIVE = 0.8;             // mixer bus -> ladder input
const OUT_GAIN = 1.5;          // VCA output make-up: a full patch peaks near 10 V p-p at full VOLUME
const OUT_KNEE = 0.62, OUT_CEIL = 0.86; // output stage: clean below the knee, rounds peaks off below -1.3 dBFS
const BUS_SAT = 1.4;           // mixer bus soft-saturation knee
const PWM_PER_VOLT = 0.098;    // PWM jack: -5..+5 V = 1..99 % duty cycle (manual p.32)
const PWM_NORMAL = 0.3;        // SUB 1 saw normalled to the VCO's pulse width (MIDDLE position)
const PW_MIN = 0.01, PW_MAX = 0.99;
const EDGE_ON = 1.5, EDGE_OFF = 1.0; // gate / trigger / clock thresholds (volts)
const DEDUPE = 0.0015;         // an event and an audio pulse closer than this are one pulse
const CLOCK_PULSE = 0.005, TRIG_PULSE = 0.001; // CLOCK and SEQ CLK 5 ms, TRIGGER 1 ms (manual p.37)
const SYNC_TICKS = 6;          // studio clock: 24 PPQN ticks, the master count is a 16th note (manual p.25)
const ENV_SMOOTH = 0.001;      // stock firmware smooths both EG outputs by a few ms

// Quantizer (keep in sync with devices/subharmonicon/theory.ts)
const JI12 = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 7 / 5, 3 / 2, 8 / 5, 5 / 3, 16 / 9, 15 / 8];
const LOG2_JI12 = JI12.map(Math.log2);
const WHITE = [0, 0, 2, 2, 4, 5, 5, 7, 7, 9, 9, 11];

/** semitones above C4 -> octaves above C4, snapped to the QUANTIZE scale (0 off, 1 12-ET, 2 8-ET, 3 12-JI, 4 8-JI) */
function quantOct(semis, mode) {
  if (!mode) return semis / 12;
  const q = Math.round(semis);
  const o = Math.floor(q / 12);
  let n = q - o * 12;
  if (mode === 2 || mode === 4) n = WHITE[n];
  return mode >= 3 ? o + LOG2_JI12[n] : o + n / 12;
}

/** Knob divisor (1..16) moved by volts: 10 V = the whole knob travel, + toward ÷1 */
function divWithCv(base, volts) {
  if (volts === 0) return base;
  let idx = Math.floor(((16 - base + 0.5) / 16 + volts * 0.1) * 16);
  if (idx < 0) idx = 0; else if (idx > 15) idx = 15;
  return 16 - idx;
}

// ---------------------------------------------------------------------------
// Fast math (from synth-processors.js; accuracy far below audibility)
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
function tanhcF(x) {
  const x2 = x * x;
  if (x2 > 24.7009) return 1 / Math.abs(x);
  return (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}
function tanF(x) {
  const x2 = x * x;
  return x * (945 + x2 * (-105 + x2)) / (945 + x2 * (-420 + x2 * 15));
}
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
/** Output stage: linear to the knee, then a tanh shoulder that never passes the ceiling */
function outStage(x) {
  const a = x < 0 ? -x : x;
  if (a <= OUT_KNEE) return x;
  const y = OUT_KNEE + (OUT_CEIL - OUT_KNEE) * tanhF((a - OUT_KNEE) / (OUT_CEIL - OUT_KNEE));
  return x < 0 ? -y : y;
}

/**
 * 4-point polyBLEP (integrated cubic B-spline). bb[o .. o+3] = samples n-2, n-1, n (current),
 * n+1 (carry) of one source; d = time in samples since the step (0..1) at sample n; h = height.
 */
function addBlep(bb, o, d, h) {
  const d2 = d * d, d3 = d2 * d, d4 = d2 * d2;
  const u = d - 1, u2 = u * u, u3 = u2 * u, u4 = u2 * u2;
  bb[o] += h * (d4 * 0.041666666666666664);
  bb[o + 1] += h * (0.5 + (4 * u - 2 * u3 - 0.75 * u4) * 0.16666666666666666);
  bb[o + 2] += h * (-0.5 + (4 * d - 2 * d3 + 0.75 * d4) * 0.16666666666666666);
  bb[o + 3] -= h * (u4 * 0.041666666666666664);
}

// Halfband polyphase IIR (2x up/down), as the shared 'ladder': ~95 dB stopband, flat to 20 kHz
const HB0 = [0.045362164348961, 0.337149687979074, 0.708064136363538];
const HB1 = [0.168087481234502, 0.522377854308354, 0.897445591172774];
const LADDER_IVS = 0.4; // per-stage tanh scale of the 2x transistor core

class SubharmoniconProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return []; }

  constructor() {
    super();
    const sr = sampleRate;
    this.sr = sr;
    const k = new Float64Array(NK);
    k[K_F1] = 261.63; k[K_F2] = 392; k[K_D11] = 2; k[K_D11 + 1] = 4; k[K_D11 + 2] = 3; k[K_D11 + 3] = 4;
    k[K_W1] = 2; k[K_W2] = 2; k[K_LV] = 0.6; k[K_OCT] = 1; k[K_QUANT] = 1;
    for (let r = 0; r < 4; r++) k[K_RHY + r] = 1;
    k[K_TEMPO] = 4; k[K_EG] = EG_ON; k[K_CUT] = 1800; k[K_VOL] = 0.7;
    k[K_VCF_A] = 0.005; k[K_VCF_D] = 0.35; k[K_VCA_A] = 0.003; k[K_VCA_D] = 0.45;
    this.k = k;
    this.fresh = true; // the first settings apply instantly (no glide from defaults)
    // Smoothed knobs: log2 Hz of both FREQ knobs and CUTOFF, six levels, resonance, EG AMT, volume
    this.sF = new Float64Array([Math.log2(k[K_F1]), Math.log2(k[K_F2])]);
    this.sLv = new Float64Array(6);
    this.sCut = Math.log2(k[K_CUT]);
    this.sRes = 0; this.sEgAmt = 0; this.sVol = k[K_VOL];
    this.smoothA = 1 - Math.exp(-1 / (0.006 * sr));

    // Patching
    this.ext = new Uint8Array(NIN);        // external cable present
    this.routed = new Uint8Array(NIN);     // internal self-patch present
    this.patched = new Uint8Array(NIN);    // either
    this.routes = [];                      // [out, in, scale]
    this.extList = []; this.zeroList = [];
    this.inV = new Float64Array(NIN);      // volts at each input this sample
    this.prev = new Float64Array(NOUT);    // last sample of every output, volts (internal routes)
    this.jacksOn = false;                  // fill output 1

    // Oscillators: per VCO phase/increment, per sub phase/counter/divisor; BLEP buffers for 6 sources
    this.vp = new Float64Array([Math.random(), Math.random()]);
    this.vinc = new Float64Array(2);
    this.vhi = new Uint8Array([1, 1]);
    this.sq = new Float64Array(4); this.sc = new Int32Array(4); this.sn = new Int32Array([2, 4, 3, 4]);
    this.shi = new Uint8Array([1, 1, 1, 1]);
    this.bb = new Float64Array(24);
    this.src = new Float64Array(6);
    this.pitchDirty = new Uint8Array([1, 1]);
    this.dig = new Float64Array(2);        // digital pitch (octaves above C4) per VCO
    this.drift = new Float64Array(2); this.driftT = new Float64Array(2); this.driftCount = 0;
    this.m0 = 0; this.m1 = 0;              // presence FIR history (mix)
    this.seed = (Math.random() * 0xffffffff) >>> 0 || 1; // noise floor PRNG (xorshift32)

    // Ladder (2x) and halfband states, DC blocker
    this.z = new Float64Array(4);
    this.hb = new Float64Array(24);
    this.dcX = 0; this.dcY = 0; this.dcR = 1 - (2 * Math.PI * 8) / sr;

    // Envelopes: [0] VCF, [1] VCA
    this.ev = new Float64Array(2); this.eo = new Float64Array(2); this.est = new Uint8Array(2);
    this.eAtk = new Float64Array(2); this.eDec = new Float64Array(2); this.eKey = new Float64Array([-1, -1, -1, -1]);
    this.envSmooth = 1 - Math.exp(-1 / (ENV_SMOOTH * sr));
    this.lastEg = EG_ON;

    // Sequencers, rhythm generators, clock
    this.pos = new Int32Array(2);          // current step 0..3
    this.armed = new Uint8Array([1, 1]);   // after RESET the first count plays step 1
    this.cnt = new Int32Array(4);          // rhythm generator phase counters
    this.seqSemis = new Float64Array(2);   // step pitch in semitones (SEQ OCT range, unquantized)
    this.seqRaw = new Float64Array(2);     // raw step volts (knob x 5 V): SEQ ASSIGN SUB 1 / SUB 2
    this.seqOut = new Float64Array(2);     // SEQ jack volts (SEQ OCT and QUANTIZE unless held)
    this.run = false; this.playKnob = false; this.midiRun = false; this.audition = false;
    this.phase = 0;                        // internal clock phase
    this.resetHeld = false; this.resetBtn = false; this.resetJack = false; this.holdPos = 0;
    this.clockHigh = false; this.trigHigh = false; this.resetHigh = false; this.playHigh = false;
    this.lastClockAudio = -1; this.lastClockEvent = -1; this.lastTrigAudio = -1; this.lastTrigEvent = -1;
    this.lastResetAudio = -1; this.lastResetEvent = -1; this.lastPlayAudio = -1; this.lastPlayEvent = -1;
    this.lastCountAt = -1;
    this.queue = [];
    this.clkOut = 0; this.seqClk = new Int32Array(2); this.trigOut = 0;
    this.btnGate = false; this.notes = []; this.midiSemis = 0; this.audGate = false;
    this.gate = false;
    // Studio clock, generated here from the transport's grid (anchor: audio time of one tick,
    // seconds per tick, swing), so it keeps time when the page's main-thread timers are throttled
    this.syncTime = 0; this.syncTick = 0; this.syncDur = 0.5 / 24; this.syncSwing = 0;
    this.syncNextTick = 0; this.syncNextTime = Infinity; this.lastSyncAt = -1;
    this.saved = null;                     // sequencer state saved during an audition

    // UI reporting
    this.uiDirty = true; this.uiLast = -1; this.uiTrig = 0; this.uiRhy = 0; this.uiMidi = 0;

    this.port.onmessage = e => this.onMessage(e.data);
  }

  // --------------------------------------------------------------------------
  // Messages
  // --------------------------------------------------------------------------

  onMessage(m) {
    switch (m.t) {
      case 'k': {
        const i = m.i, v = m.v;
        this.k[i] = v;
        if (i === K_PLAY) this.push(0, 'play-knob', v);
        if (i === K_EG) this.uiDirty = true;
        if (i === K_OCT || i === K_QUANT || i === K_FREE_OCT || i === K_FREE_Q || (i >= K_STEP && i < K_STEP + 8)) {
          this.updateStep(0); this.updateStep(1);
        }
        if (i <= K_F2 || (i >= K_ASSIGN && i < K_RHY)) { this.pitchDirty[0] = 1; this.pitchDirty[1] = 1; }
        if (this.fresh) this.snapSmoothed();
        break;
      }
      case 'patch': {
        // { ext: [..16 0/1], routes: [[o, i, s]...] }
        if (m.ext) for (let j = 0; j < NIN; j++) this.ext[j] = m.ext[j] ? 1 : 0;
        if (m.routes) this.routes = m.routes;
        this.routed.fill(0);
        for (const r of this.routes) this.routed[r[1]] = 1;
        this.extList = []; this.zeroList = [];
        for (let j = 0; j < NIN; j++) {
          const was = this.patched[j];
          this.patched[j] = this.ext[j] || this.routed[j] ? 1 : 0;
          if (this.ext[j]) this.extList.push(j);
          else if (this.routed[j]) this.zeroList.push(j);
          if (!this.patched[j]) this.inV[j] = 0;
          if (was && !this.patched[j]) {
            if (j === I_TRIG) this.trigHigh = false;
            if (j === I_RESET) { this.resetJack = false; this.resetHigh = false; this.updateResetHeld(); }
            if (j === I_PLAY) this.playHigh = false;
            if (j === I_CLOCK) this.clockHigh = false;
          }
        }
        this.pitchDirty[0] = 1; this.pitchDirty[1] = 1;
        break;
      }
      case 'jacks': this.jacksOn = !!m.v; break;
      case 'sync':                                        // studio transport grid (engine onTransport)
        this.syncTime = m.time; this.syncTick = m.tick; this.syncDur = m.dur > 0 ? m.dur : this.syncDur; this.syncSwing = m.swing || 0;
        if (this.midiRun) this.syncRealign(currentTime);
        break;
      case 'ev': this.push(m.time, m.ch, m.v); break;      // timed events from other instruments / the transport
      case 'btn': this.push(0, m.b, m.v); break;          // panel buttons, now
      case 'note': this.push(m.time || 0, m.on ? 'note-on' : 'note-off', m.n); break;
      case 'audition': this.push(0, m.v ? 'aud-on' : 'aud-off'); break;
    }
  }

  snapSmoothed() {
    const k = this.k;
    this.sF[0] = Math.log2(Math.max(1, k[K_F1])); this.sF[1] = Math.log2(Math.max(1, k[K_F2]));
    for (let j = 0; j < 6; j++) this.sLv[j] = k[K_LV + j] * k[K_LV + j];
    this.sCut = Math.log2(clamp(k[K_CUT], 5, 22000));
    this.sRes = k[K_RES]; this.sEgAmt = k[K_EGAMT]; this.sVol = k[K_VOL];
  }

  push(time, ch, v) {
    const q = this.queue;
    const ev = { time, ch, v };
    let i = q.length;
    while (i > 0 && q[i - 1].time > time) i--;
    q.splice(i, 0, ev);
  }

  // --------------------------------------------------------------------------
  // Sequencers and rhythm generators
  // --------------------------------------------------------------------------

  /** Pitch of sequencer s's current step: semitones, and the SEQ jack's volts */
  updateStep(s) {
    const k = this.k;
    const frac = k[K_STEP + s * 4 + this.pos[s]];
    this.seqSemis[s] = frac * k[K_OCT] * 12;
    this.seqRaw[s] = frac * 5;
    // SEQ jack: follows SEQ OCT and QUANTIZE unless they were held until their LED flashed
    const outSemis = frac * (k[K_FREE_OCT] > 0.5 ? 5 : k[K_OCT]) * 12;
    this.seqOut[s] = k[K_FREE_Q] > 0.5 ? outSemis / 12 : quantOct(outSemis, k[K_QUANT] | 0);
    this.pitchDirty[s] = 1;
  }

  rhythmDiv(r) {
    const base = this.k[K_RHY + r] | 0;
    return this.patched[I_RHY + r] ? divWithCv(base, this.inV[I_RHY + r]) : base;
  }

  /** One master clock count: rhythm generators -> sequencers -> envelopes. manual = NEXT */
  count(manual) {
    const k = this.k;
    let one = 0, two = 0;
    for (let r = 0; r < 4; r++) {
      const c = this.cnt[r];
      const div = this.rhythmDiv(r);
      if (c === 0) {
        if (k[K_RA + r * 2] > 0.5) one++;
        if (k[K_RA + r * 2 + 1] > 0.5) two++;
        this.uiRhy |= 1 << r;
      }
      this.cnt[r] = c >= div - 1 ? 0 : c + 1;
    }
    const xor = k[K_LOGIC] > 0.5;
    const adv1 = xor ? one === 1 : one > 0;
    const adv2 = xor ? two === 1 : two > 0;
    if (adv1) this.stepSeq(0, manual);
    if (adv2) this.stepSeq(1, manual);
    if (!manual) {
      this.clkOut = Math.round(CLOCK_PULSE * this.sr);
      // Either sequencer's move reaches TRIGGER OUT before the EG switch (manual p.56;
      // Patching with Intention p.15); with EG lit it also fires the envelopes
      if (adv1 || adv2) {
        this.pulseTrig();
        if ((k[K_EG] | 0) === EG_ON) this.trigEnvs();
      }
    }
    return adv1;
  }

  stepSeq(s, manual) {
    if (this.resetHeld) this.pos[s] = this.holdPos;
    else if (this.armed[s] && !manual) this.armed[s] = 0;
    else { this.armed[s] = 0; this.pos[s] = (this.pos[s] + 1) % NSTEP; }
    this.updateStep(s);
    this.seqClk[s] = Math.round(CLOCK_PULSE * this.sr);
    this.uiDirty = true;
  }

  /** NEXT: stock firmware forces divider counts until Sequencer 1 steps (bounded) */
  next() {
    const k = this.k;
    if (this.resetHeld) {
      this.holdPos = (this.holdPos + 1) % NSTEP;
      this.pos[0] = this.holdPos; this.pos[1] = this.holdPos;
      this.updateStep(0); this.updateStep(1); this.uiDirty = true;
      return;
    }
    let any = false, reach1 = false;
    for (let r = 0; r < 4; r++) {
      if (k[K_RA + r * 2] > 0.5) { any = true; reach1 = true; }
      if (k[K_RA + r * 2 + 1] > 0.5) any = true;
    }
    if (!any) return;
    for (let n = 0; n < 256; n++) {
      if (this.count(true) || !reach1) break;
    }
  }

  reset() {
    this.pos[0] = 0; this.pos[1] = 0; this.holdPos = 0;
    this.armed[0] = 1; this.armed[1] = 1;
    this.cnt.fill(0);
    this.updateStep(0); this.updateStep(1);
    this.uiDirty = true;
  }

  updateResetHeld() {
    const held = this.resetBtn || this.resetJack;
    if (held && !this.resetHeld) this.reset();
    this.resetHeld = held;
  }

  setRun(on) {
    if (on === this.run) return;
    this.run = on;
    if (on) this.phase = 1; // the internal clock counts at once
    this.uiDirty = true;
  }

  // --------------------------------------------------------------------------
  // Envelopes
  // --------------------------------------------------------------------------

  /** Start both EGs' Attack (an EG already in its Attack stage carries on: manual p.24) */
  startEnvs() {
    for (let e = 0; e < 2; e++) if (this.est[e] !== ST_ATTACK) this.est[e] = ST_ATTACK;
  }

  /** A trigger for the EGs: ignored while EG is HELD (they are held open already) */
  trigEnvs() {
    if ((this.k[K_EG] | 0) === EG_HELD) return;
    this.startEnvs();
  }

  /** TRIGGER OUT: 0-5 V, 1 ms (manual p.37) */
  pulseTrig() {
    this.trigOut = Math.round(TRIG_PULSE * this.sr);
    this.uiTrig = 1; this.uiDirty = true;
  }

  envCoefs() {
    const k = this.k, sr = this.sr;
    const a0 = k[K_VCF_A], d0 = k[K_VCF_D], a1 = k[K_VCA_A], d1 = k[K_VCA_D];
    const key = this.eKey;
    if (a0 !== key[0]) { key[0] = a0; this.eAtk[0] = 1 - Math.exp(-Math.LN2 * 1.585 / (clamp(a0, 0.001, 10) * sr)); }
    if (d0 !== key[1]) { key[1] = d0; this.eDec[0] = Math.exp(-6.9078 / (clamp(d0, 0.005, 10) * sr)); }
    if (a1 !== key[2]) { key[2] = a1; this.eAtk[1] = 1 - Math.exp(-Math.LN2 * 1.585 / (clamp(a1, 0.001, 10) * sr)); }
    if (d1 !== key[3]) { key[3] = d1; this.eDec[1] = Math.exp(-6.9078 / (clamp(d1, 0.005, 10) * sr)); }
  }

  /** Audio time of a studio tick on the current grid (swing delays the off-beat 16th, as the transport does) */
  syncTimeOf(tick) {
    return this.syncTime + (tick - this.syncTick) * this.syncDur + (tick % 12 >= 6 ? this.syncSwing * 6 * this.syncDur : 0);
  }

  /** The next 16th to count after a new grid: never one already counted, never a burst of past ones */
  syncRealign(now) {
    const dur = this.syncDur;
    const after = Math.max(this.lastSyncAt >= 0 ? this.lastSyncAt + 3 * dur : -Infinity, now - 0.003);
    let tick = Math.floor((this.syncTick + (after - this.syncTime) / dur) / SYNC_TICKS) * SYNC_TICKS - SYNC_TICKS;
    if (tick < 0) tick = 0;
    for (let g = 0; g < 8 && this.syncTimeOf(tick) <= after; g++) tick += SYNC_TICKS;
    this.syncNextTick = tick;
    this.syncNextTime = this.syncTimeOf(tick);
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  handleEvent(ev, t) {
    switch (ev.ch) {
      case 'play-knob': this.playKnob = ev.v > 0.5; this.setRun(this.playKnob || this.midiRun); break;
      case 'midi-start': {
        // MIDI start: from step 1, counting 16ths on the studio grid from the start tick
        this.midiRun = true; this.uiMidi = 1;
        this.reset(); this.setRun(true); this.lastCountAt = t;
        const st = Math.max(0, Math.ceil((ev.v || 0) / SYNC_TICKS) * SYNC_TICKS);
        this.lastSyncAt = -1;
        this.syncNextTick = st; this.syncNextTime = this.syncTimeOf(st);
        if (this.syncNextTime < t - 0.003) this.syncRealign(t);
        break;
      }
      case 'midi-stop': this.midiRun = false; this.syncNextTime = Infinity; this.setRun(this.playKnob && !this.midiRun); this.uiDirty = true; break;
      case 'clock':
        if (Math.abs(ev.time - this.lastClockAudio) < DEDUPE) break;
        this.lastClockEvent = ev.time;
        if (this.run && this.patched[I_CLOCK] && !this.audition) { this.lastCountAt = t; this.count(false); }
        break;
      case 'trig':
        if (Math.abs(ev.time - this.lastTrigAudio) < DEDUPE) break;
        this.lastTrigEvent = ev.time;
        this.trigEnvs(); this.pulseTrig();
        break;
      case 'reset':
        if (Math.abs(ev.time - this.lastResetAudio) < DEDUPE) break;
        this.lastResetEvent = ev.time;
        this.reset();
        break;
      case 'play':
        if (Math.abs(ev.time - this.lastPlayAudio) < DEDUPE) break;
        this.lastPlayEvent = ev.time;
        this.setRun(ev.v > 0.5);
        break;
      case 'trigger-down':
        // EG lit: an instant trigger. EG unlit: a gate (envelopes held at maximum while
        // pressed). EG blinking: no effect (manual pp.28-29)
        if ((this.k[K_EG] | 0) === EG_ON) { this.trigEnvs(); this.pulseTrig(); }
        else if ((this.k[K_EG] | 0) === EG_OFF) { this.btnGate = true; this.pulseTrig(); }
        this.uiDirty = true;
        break;
      case 'trigger-up': this.btnGate = false; break;
      case 'reset-down': this.resetBtn = true; this.updateResetHeld(); break;
      case 'reset-up': this.resetBtn = false; this.updateResetHeld(); break;
      case 'next': this.next(); break;
      case 'note-on': {
        const n = ev.v | 0;
        this.notes = this.notes.filter(x => x !== n);
        this.notes.push(n);
        this.midiSemis = n - 60;
        this.pitchDirty[0] = 1; this.pitchDirty[1] = 1;
        this.trigEnvs(); this.pulseTrig();
        this.uiMidi = 1;
        break;
      }
      case 'note-off': {
        const n = ev.v | 0;
        this.notes = this.notes.filter(x => x !== n);
        if (this.notes.length) { this.midiSemis = this.notes[this.notes.length - 1] - 60; this.pitchDirty[0] = 1; this.pitchDirty[1] = 1; }
        break;
      }
      case 'aud-on': {
        // Audition from step 1 on the internal clock when stopped - or when waiting for an
        // external clock that is not arriving (the studio is stopped)
        const idle = this.run && (this.patched[I_CLOCK] || this.midiRun) && currentTime - this.lastCountAt > 0.5;
        if (!this.audition && (!this.run || idle)) {
          this.saved = { pos: [this.pos[0], this.pos[1]], armed: [this.armed[0], this.armed[1]], cnt: Array.from(this.cnt), run: this.run };
          this.audition = true;
          this.reset();
          this.run = true; this.phase = 1;
          // Nothing would sound if no rhythm generator steps a sequencer, or EG is off with
          // no cable to fire the envelopes: hold them open (a gate) for the audition then
          let any = false;
          for (let r = 0; r < 8; r++) if (this.k[K_RA + r] > 0.5) any = true;
          this.audGate = !any || ((this.k[K_EG] | 0) === EG_OFF && !this.patched[I_TRIG]);
        }
        break;
      }
      case 'aud-off':
        if (this.audition) {
          this.audition = false; this.audGate = false;
          const sv = this.saved;
          if (sv) {
            this.pos[0] = sv.pos[0]; this.pos[1] = sv.pos[1]; this.armed[0] = sv.armed[0]; this.armed[1] = sv.armed[1];
            for (let r = 0; r < 4; r++) this.cnt[r] = sv.cnt[r];
            this.run = sv.run || this.playKnob || this.midiRun;
            this.updateStep(0); this.updateStep(1);
          }
          this.saved = null; this.uiDirty = true;
        }
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Pitch
  // --------------------------------------------------------------------------

  digitalPitch(v) {
    const k = this.k;
    const knobSemis = 12 * (this.sF[v] - Math.log2(C4));
    const seq = k[K_ASSIGN + v * 3] > 0.5 ? this.seqSemis[v] : 0;
    let oct = quantOct(knobSemis + seq + this.midiSemis, k[K_QUANT] | 0);
    if (oct > MAX_DIGITAL_OCT) oct = MAX_DIGITAL_OCT;
    this.dig[v] = oct;
  }

  subDiv(v, s) {
    const k = this.k;
    let volts = this.patched[v ? I_SUB2 : I_SUB1] ? this.inV[v ? I_SUB2 : I_SUB1] : 0;
    if (k[K_ASSIGN + v * 3 + 1 + s] > 0.5) volts += this.seqRaw[v];
    return divWithCv(k[K_D11 + v * 2 + s] | 0, volts);
  }

  // --------------------------------------------------------------------------

  process(inputs, outputs) {
    const out0 = outputs[0], out1 = outputs[1];
    if (!out0 || !out0[0]) return true;
    const oMain = out0[0];
    const n = oMain.length;
    const sr = this.sr, k = this.k;
    const t0 = currentTime;
    if (this.fresh) { this.fresh = false; this.snapSmoothed(); this.updateStep(0); this.updateStep(1); }
    this.envCoefs();

    const jacks = this.jacksOn && out1 && out1.length >= NOUT ? out1 : null;
    const inp = inputs[0];
    const extList = this.extList, nExt = inp && inp.length >= NIN ? extList.length : 0;
    const zeroList = this.zeroList, routes = this.routes, nr = routes.length;
    const inV = this.inV, prev = this.prev, patched = this.patched;
    if (!nExt) for (let q = 0; q < extList.length; q++) inV[extList[q]] = 0;

    // Per-block settings
    const quant = k[K_QUANT] | 0;
    const wave0 = k[K_W1] | 0, wave1 = k[K_W2] | 0;
    const egMode = k[K_EG] | 0;
    if (egMode !== this.lastEg) {
      if (egMode === EG_HELD) this.btnGate = false;
      this.lastEg = egMode;
    }
    // HELD acts as a gate: entering it runs both Attacks and holds at maximum; leaving it
    // runs the Decays (manual p.30)
    const held = egMode === EG_HELD;
    const tempoHz = clamp(k[K_TEMPO], 0.05, 100);

    // Smoothing needed?
    const a = this.smoothA;
    const fT0 = Math.log2(clamp(k[K_F1], 1, 20000)), fT1 = Math.log2(clamp(k[K_F2], 1, 20000));
    const cutT = Math.log2(clamp(k[K_CUT], 5, 22000));
    let smoothing = Math.abs(fT0 - this.sF[0]) > 1e-6 || Math.abs(fT1 - this.sF[1]) > 1e-6 || Math.abs(cutT - this.sCut) > 1e-6 ||
      Math.abs(k[K_RES] - this.sRes) > 1e-6 || Math.abs(k[K_EGAMT] - this.sEgAmt) > 1e-6 || Math.abs(k[K_VOL] - this.sVol) > 1e-6;
    for (let j = 0; j < 6 && !smoothing; j++) if (Math.abs(k[K_LV + j] * k[K_LV + j] - this.sLv[j]) > 1e-7) smoothing = true;
    if (!smoothing) {
      this.sF[0] = fT0; this.sF[1] = fT1; this.sCut = cutT; this.sRes = k[K_RES]; this.sEgAmt = k[K_EGAMT]; this.sVol = k[K_VOL];
      for (let j = 0; j < 6; j++) this.sLv[j] = k[K_LV + j] * k[K_LV + j];
    }

    // Slow analog drift, about ±1.5 cents per VCO (the subs follow their VCO)
    if (++this.driftCount >= 48) {
      this.driftCount = 0;
      this.driftT[0] = (Math.random() * 2 - 1) * 0.00125;
      this.driftT[1] = (Math.random() * 2 - 1) * 0.00125;
    }
    this.drift[0] += (this.driftT[0] - this.drift[0]) * 0.03;
    this.drift[1] += (this.driftT[1] - this.drift[1]) * 0.03;
    if (Math.abs(this.drift[0] - this.driftT[0]) > 1e-7 || Math.abs(this.drift[1] - this.driftT[1]) > 1e-7) { this.pitchDirty[0] = 1; this.pitchDirty[1] = 1; }

    // Ladder coefficients (per sample when modulated)
    const z = this.z;
    let s0 = z[0], s1 = z[1], s2 = z[2], s3 = z[3];
    const hb = this.hb;
    let ux00 = hb[0], ux01 = hb[1], ux02 = hb[2], uy00 = hb[3], uy01 = hb[4], uy02 = hb[5];
    let ux10 = hb[6], ux11 = hb[7], ux12 = hb[8], uy10 = hb[9], uy11 = hb[10], uy12 = hb[11];
    let dx00 = hb[12], dx01 = hb[13], dx02 = hb[14], dy00 = hb[15], dy01 = hb[16], dy02 = hb[17];
    let dx10 = hb[18], dx11 = hb[19], dx12 = hb[20], dy10 = hb[21], dy11 = hb[22], dy12 = hb[23];
    const h0 = HB0[0], h1 = HB0[1], h2 = HB0[2], g0 = HB1[0], g1 = HB1[1], g2 = HB1[2];
    const wScale = Math.PI / (sr * 2), nyq = sr * 0.45;
    let lastCut = NaN, gCut = 0;

    const ev = this.ev, eo = this.eo, est = this.est, eAtk = this.eAtk, eDec = this.eDec;
    const envSmooth = this.envSmooth;
    const bb = this.bb, src = this.src, sLv = this.sLv;
    const vp = this.vp, vinc = this.vinc, sq = this.sq, sc = this.sc, sn = this.sn;
    const queue = this.queue;
    let nextEv = queue.length ? Math.round((queue[0].time - t0) * sr) : 1 << 30;

    for (let i = 0; i < n; i++) {
      // ---- inputs: other instruments (1.0 = 5 V) + self-patches (last sample, volts) ----
      if (nExt) for (let q = 0; q < nExt; q++) { const j = extList[q]; inV[j] = inp[j][i] * 5; }
      if (nr) {
        for (let q = 0; q < zeroList.length; q++) inV[zeroList[q]] = 0;
        for (let q = 0; q < nr; q++) { const rt = routes[q]; inV[rt[1]] += prev[rt[0]] * rt[2]; }
      }

      // ---- smoothing ----
      if (smoothing) {
        this.sF[0] += (fT0 - this.sF[0]) * a; this.sF[1] += (fT1 - this.sF[1]) * a;
        this.sCut += (cutT - this.sCut) * a;
        this.sRes += (k[K_RES] - this.sRes) * a; this.sEgAmt += (k[K_EGAMT] - this.sEgAmt) * a; this.sVol += (k[K_VOL] - this.sVol) * a;
        for (let j = 0; j < 6; j++) sLv[j] += (k[K_LV + j] * k[K_LV + j] - sLv[j]) * a;
        this.pitchDirty[0] = 1; this.pitchDirty[1] = 1;
      }

      // ---- timed events (buttons, transport, cables from other instruments) ----
      if (i >= nextEv) {
        const t = t0 + i / sr;
        while (queue.length && Math.round((queue[0].time - t0) * sr) <= i) this.handleEvent(queue.shift(), t);
        nextEv = queue.length ? Math.round((queue[0].time - t0) * sr) : 1 << 30;
      }

      // ---- gate / trigger / clock jacks (edge detected, deduped against events) ----
      if (patched[I_PLAY]) {
        const g = inV[I_PLAY];
        if (!this.playHigh && g > EDGE_ON) {
          this.playHigh = true;
          const t = t0 + i / sr;
          if (Math.abs(t - this.lastPlayEvent) >= DEDUPE) { this.lastPlayAudio = t; this.setRun(true); }
        } else if (this.playHigh && g < EDGE_OFF) {
          this.playHigh = false;
          const t = t0 + i / sr;
          if (Math.abs(t - this.lastPlayEvent) >= DEDUPE) { this.lastPlayAudio = t; this.setRun(false); }
        }
      }
      if (patched[I_RESET]) {
        const g = inV[I_RESET];
        if (!this.resetHigh && g > EDGE_ON) {
          this.resetHigh = true;
          const t = t0 + i / sr;
          if (Math.abs(t - this.lastResetEvent) >= DEDUPE) { this.lastResetAudio = t; this.resetJack = true; this.updateResetHeld(); this.reset(); }
        } else if (this.resetHigh && g < EDGE_OFF) { this.resetHigh = false; this.resetJack = false; this.updateResetHeld(); }
      }
      if (patched[I_TRIG]) {
        const g = inV[I_TRIG];
        if (!this.trigHigh && g > EDGE_ON) {
          this.trigHigh = true;
          const t = t0 + i / sr;
          if (Math.abs(t - this.lastTrigEvent) >= DEDUPE) { this.lastTrigAudio = t; this.trigEnvs(); this.pulseTrig(); }
        } else if (this.trigHigh && g < EDGE_OFF) this.trigHigh = false; // rising edge = trigger (manual p.35)
      }
      if (patched[I_CLOCK]) {
        const g = inV[I_CLOCK];
        if (!this.clockHigh && g > EDGE_ON) {
          this.clockHigh = true;
          const t = t0 + i / sr;
          if (Math.abs(t - this.lastClockEvent) >= DEDUPE) {
            this.lastClockAudio = t;
            if (this.run && !this.audition) { this.lastCountAt = t; this.count(false); }
          }
        } else if (this.clockHigh && g < EDGE_OFF) this.clockHigh = false;
      }

      // ---- studio clock (MIDI sync): one master count per 16th, unless a CLOCK cable is in ----
      if (this.midiRun && this.run && !this.audition && t0 + i / sr >= this.syncNextTime) {
        const at = this.syncNextTime;
        this.syncNextTick += SYNC_TICKS;
        this.syncNextTime = this.syncTimeOf(this.syncNextTick);
        this.lastSyncAt = at;
        this.uiMidi = 1;
        if (!patched[I_CLOCK]) { this.lastCountAt = at; this.count(false); }
      }

      // ---- internal clock (TEMPO, 1 PPQ): when nothing external is in charge ----
      if (this.run && (this.audition || (!patched[I_CLOCK] && !this.midiRun))) {
        this.phase += tempoHz / sr;
        if (this.phase >= 1) {
          this.phase -= 1;
          if (this.phase >= 1) this.phase = 0;
          this.lastCountAt = t0 + i / sr;
          this.count(false);
        }
      }

      // ---- envelopes: [0] VCF, [1] VCA ----
      // gates: TRIGGER held with EG unlit, held keys, an audition, and the HELD mode itself
      const gate = held || this.btnGate || this.notes.length > 0 || this.audGate;
      if (gate && !this.gate) this.startEnvs(); // a new gate starts the envelopes
      this.gate = gate;
      for (let e = 0; e < 2; e++) {
        let v = ev[e];
        const st = est[e];
        if (st === ST_ATTACK) {
          v += (1.5 - v) * eAtk[e];
          if (v >= 1) { v = 1; est[e] = gate ? ST_HOLD : ST_DECAY; }
        } else if (st === ST_HOLD) {
          if (!gate) est[e] = ST_DECAY;
        } else if (st === ST_DECAY) {
          v *= eDec[e];
          if (v < 1e-5) { v = 0; est[e] = ST_IDLE; }
        }
        ev[e] = v;
        eo[e] += (v - eo[e]) * envSmooth;
      }
      const vcfEg = eo[0], vcaEg = eo[1];

      // ---- VCO pitch ----
      for (let v = 0; v < 2; v++) {
        if (this.pitchDirty[v]) { this.pitchDirty[v] = 0; this.digitalPitch(v); }
        const cvIn = v === 0 ? (patched[I_VCO1] ? inV[I_VCO1] : 0) : (patched[I_VCO2] ? inV[I_VCO2] : patched[I_VCO1] ? inV[I_VCO1] : 0);
        let f = C4 * exp2(this.dig[v] + cvIn + this.drift[v]);
        if (f > 20000) f = 20000;
        let inc = f / sr;
        if (inc > 0.45) inc = 0.45; else if (inc < 1e-6) inc = 1e-6;
        vinc[v] = inc;
      }

      // ---- oscillators: VCO, SUB 1, SUB 2 (x2), band-limited ----
      for (let v = 0; v < 2; v++) {
        const inc = vinc[v];
        const pPrev = vp[v];
        let p = pPrev + inc, wrapped = false, dW = 0;
        if (p >= 1) { p -= 1; wrapped = true; dW = p / inc; if (dW > 0.999999) dW = 0.999999; }
        vp[v] = p;
        const wv = v ? wave1 : wave0;
        const pwmPatched = patched[v ? I_PWM2 : I_PWM1];
        const pwJack = pwmPatched ? clamp(0.5 + PWM_PER_VOLT * inV[v ? I_PWM2 : I_PWM1], PW_MIN, PW_MAX) : 0.5;

        // subs first: their resets happen at the VCO's wrap, and SUB 1 may set the VCO's pulse width
        for (let s = 0; s < 2; s++) {
          const si = v * 2 + s, o = (v * 3 + 1 + s) * 4;
          const nOld = sn[si];
          const qPrev = sq[si];
          let q = qPrev + inc / nOld;
          let reset = false, qAt = 0;
          if (wrapped) {
            const nNew = this.subDiv(v, s);
            sn[si] = nNew;
            if (++sc[si] >= nNew) {
              sc[si] = 0; reset = true;
              qAt = q - (inc / nOld) * dW; if (qAt > 1) qAt = 1;
              q = (inc / nNew) * dW;
            }
          }
          if (q > 1) q = 1;
          sq[si] = q;
          if (wv === 0) {
            // square sub (UP): comparator q < width
            const w = pwJack, dq = inc / nOld;
            bb[o + 2] += q < w ? 1 : -1;
            if (!reset) {
              if (qPrev < w && q >= w) addBlep(bb, o, (q - w) / dq, -2);
            } else {
              if (qPrev < w && qAt >= w) addBlep(bb, o, Math.min(1, dW + (qAt - w) / dq), -2);
              if (qAt >= w) addBlep(bb, o, dW, 2);
              if (q >= w) addBlep(bb, o, (q - w) / (inc / sn[si]), -2);
            }
          } else {
            // saw sub
            bb[o + 2] += 2 * q - 1;
            if (reset) addBlep(bb, o, dW, -2 * qAt);
          }
        }

        // the VCO
        const o = v * 3 * 4;
        if (wv === 2) {
          bb[o + 2] += 2 * p - 1;
          if (wrapped) addBlep(bb, o, dW, -2);
        } else {
          // square: UP = 50 % (or the PWM jack); MIDDLE = width moved by SUB 1's saw (or the PWM jack)
          const w = wv === 0 ? pwJack : pwmPatched ? pwJack : clamp(0.5 + PWM_NORMAL * (2 * sq[v * 2] - 1), PW_MIN, PW_MAX);
          const hi = p < w;
          bb[o + 2] += hi ? 1 : -1;
          if (!wrapped) {
            if (pPrev < w && p >= w) addBlep(bb, o, (p - w) / inc, -2);
            else if (hi !== (this.vhi[v] === 1) && !(pPrev < w && p >= w)) addBlep(bb, o, 0.5, hi ? 2 : -2);
          } else {
            if (pPrev < w) addBlep(bb, o, Math.min(1, dW + (1 - w) / inc), -2);
            addBlep(bb, o, dW, 2);
            if (p >= w) addBlep(bb, o, (p - w) / inc, -2);
          }
          this.vhi[v] = hi ? 1 : 0;
        }
      }
      // emit the finished samples (2 samples late) and shift the BLEP buffers
      for (let s = 0; s < 6; s++) {
        const o = s * 4;
        src[s] = bb[o];
        bb[o] = bb[o + 1]; bb[o + 1] = bb[o + 2]; bb[o + 2] = bb[o + 3]; bb[o + 3] = 0;
      }

      // ---- mixer (level² taper) + presence FIR (1 sample) ----
      const m2 = sLv[0] * src[0] + sLv[1] * src[1] + sLv[2] * src[2] + sLv[3] * src[3] + sLv[4] * src[4] + sLv[5] * src[5];
      // analog noise floor (about -100 dB): lets a self-oscillating filter start with every level down
      let nz = this.seed; nz ^= nz << 13; nz ^= nz >>> 17; nz ^= nz << 5; this.seed = nz >>> 0;
      const mix = 1.24 * this.m1 - 0.12 * (this.m0 + m2) + (this.seed / 4294967296 - 0.5) * 2e-5;
      this.m0 = this.m1; this.m1 = m2;

      // ---- VCF: cutoff = knob + VCF EG x AMT + CUTOFF jack (1 V/oct) ----
      let cutOct = this.sCut + this.sEgAmt * VCF_EG_OCT * vcfEg + (patched[I_CUT] ? inV[I_CUT] : 0);
      if (cutOct !== lastCut) {
        lastCut = cutOct;
        let fc = exp2(cutOct);
        if (fc < 5) fc = 5; else if (fc > nyq) fc = nyq;
        gCut = tanF(fc * wScale);
      }
      const g = gCut;
      const res = this.sRes * RES_SCALE;
      const kk = res * 4.1;
      const inG = DRIVE * (1 + res * 0.6); // ladder input gain, with the classic resonance make-up
      const x = mix;
      // upsample 2x
      let tt = h0 * (x - uy00) + ux00; ux00 = x; uy00 = tt;
      let tt2 = h1 * (tt - uy01) + ux01; ux01 = tt; uy01 = tt2;
      const xa0 = h2 * (tt2 - uy02) + ux02; ux02 = tt2; uy02 = xa0;
      tt = g0 * (x - uy10) + ux10; ux10 = x; uy10 = tt;
      tt2 = g1 * (tt - uy11) + ux11; ux11 = tt; uy11 = tt2;
      const xb0 = g2 * (tt2 - uy12) + ux12; ux12 = tt2; uy12 = xb0;
      let za = 0, zb = 0;
      for (let sub = 0; sub < 2; sub++) {
        // mixer bus saturation at the 2x rate (warm distortion with several sources near full)
        const xs = BUS_SAT * tanhF((sub === 0 ? xa0 : xb0) * (1 / BUS_SAT)) * inG;
        const T1 = tanhcF(s0 * LADDER_IVS), T2 = tanhcF(s1 * LADDER_IVS), T3 = tanhcF(s2 * LADDER_IVS), T4 = tanhcF(s3 * LADDER_IVS);
        const ge = (4 * g) / (T1 + T2 + T3 + T4);
        const c1 = 1 / (1 + ge * T1), c2 = 1 / (1 + ge * T2), c3 = 1 / (1 + ge * T3), c4 = 1 / (1 + ge * T4);
        const A1 = ge * c1, B1 = s0 * c1;
        const A2 = ge * T1 * c2, B2 = s1 * c2;
        const A3 = ge * T2 * c3, B3 = s2 * c3;
        const A4 = ge * T3 * c4, B4 = s3 * c4;
        const P = A1 * A2 * A3 * A4;
        const Q = A4 * (A3 * (A2 * B1 + B2) + B3) + B4;
        const y4e = (P * xs + Q) / (1 + kk * P);
        const u = tanhF(xs - kk * y4e);
        const y1 = A1 * u + B1, y2 = A2 * y1 + B2, y3 = A3 * y2 + B3, y4 = A4 * y3 + B4;
        s0 = 2 * y1 - s0; s1 = 2 * y2 - s1; s2 = 2 * y3 - s2; s3 = 2 * y4 - s3;
        if (sub === 0) za = y4; else zb = y4;
      }
      // downsample
      tt = h0 * (zb - dy00) + dx00; dx00 = zb; dy00 = tt;
      tt2 = h1 * (tt - dy01) + dx01; dx01 = tt; dy01 = tt2;
      const ya = h2 * (tt2 - dy02) + dx02; dx02 = tt2; dy02 = ya;
      tt = g0 * (za - dy10) + dx10; dx10 = za; dy10 = tt;
      tt2 = g1 * (tt - dy11) + dx11; dx11 = tt; dy11 = tt2;
      const yb = g2 * (tt2 - dy12) + dx12; dx12 = tt2; dy12 = yb;
      const filt = 0.5 * (ya + yb);

      // ---- VCA: VCA EG + VCA jack (summed, so it can push past the envelope) -> VOLUME ----
      let gv = vcaEg + (patched[I_VCA] ? inV[I_VCA] / EG_VOLTS : 0);
      let main = 0;
      if (gv > 0) {
        if (gv > 1) gv = 1 + 0.3 * tanhF((gv - 1) / 0.3);
        const vol = this.sVol;
        main = filt * gv * vol * vol * OUT_GAIN;
      }
      // DC blocker (asymmetric pulse widths under an envelope), then the output stage
      const dc = main - this.dcX + this.dcR * this.dcY;
      this.dcX = main; this.dcY = dc;
      main = outStage(dc);
      oMain[i] = main;

      // ---- pulses ----
      const clk = this.clkOut > 0 ? 1 : 0; if (this.clkOut > 0) this.clkOut--;
      const sc1 = this.seqClk[0] > 0 ? 1 : 0; if (this.seqClk[0] > 0) this.seqClk[0]--;
      const sc2 = this.seqClk[1] > 0 ? 1 : 0; if (this.seqClk[1] > 0) this.seqClk[1]--;
      const trg = this.trigOut > 0 ? 1 : 0; if (this.trigOut > 0) this.trigOut--;

      // ---- jack outputs (1.0 = 5 V) ----
      if (jacks) {
        jacks[O_VCA][i] = main;
        jacks[O_VCO1][i] = src[0]; jacks[2][i] = src[1]; jacks[3][i] = src[2];
        jacks[O_VCA_EG][i] = vcaEg * 1.6;
        jacks[5][i] = src[3]; jacks[6][i] = src[4]; jacks[7][i] = src[5];
        jacks[O_VCF_EG][i] = vcfEg * 1.6;
        jacks[O_SEQ1][i] = this.seqOut[0] * 0.2; jacks[O_SEQ1_CLK][i] = sc1;
        jacks[O_SEQ2][i] = this.seqOut[1] * 0.2; jacks[O_SEQ2_CLK][i] = sc2;
        jacks[O_CLOCK][i] = clk * 2; jacks[O_TRIG][i] = trg;
      }
      if (nr) {
        prev[O_VCA] = main * 5;
        for (let s = 0; s < 6; s++) prev[SRC_OUT[s]] = src[s] * 5;
        prev[O_VCA_EG] = vcaEg * EG_VOLTS; prev[O_VCF_EG] = vcfEg * EG_VOLTS;
        prev[O_SEQ1] = this.seqOut[0]; prev[O_SEQ2] = this.seqOut[1];
        prev[O_SEQ1_CLK] = sc1 * 5; prev[O_SEQ2_CLK] = sc2 * 5; prev[O_CLOCK] = clk * 10; prev[O_TRIG] = trg * 5;
      }
    }

    // Save ladder / halfband states with a denormal and blow-up guard
    if (!Number.isFinite(s0 + s1 + s2 + s3)) { s0 = s1 = s2 = s3 = 0; }
    z[0] = Math.abs(s0) < 1e-20 ? 0 : s0; z[1] = Math.abs(s1) < 1e-20 ? 0 : s1;
    z[2] = Math.abs(s2) < 1e-20 ? 0 : s2; z[3] = Math.abs(s3) < 1e-20 ? 0 : s3;
    hb[0] = ux00; hb[1] = ux01; hb[2] = ux02; hb[3] = uy00; hb[4] = uy01; hb[5] = uy02;
    hb[6] = ux10; hb[7] = ux11; hb[8] = ux12; hb[9] = uy10; hb[10] = uy11; hb[11] = uy12;
    hb[12] = dx00; hb[13] = dx01; hb[14] = dx02; hb[15] = dy00; hb[16] = dy01; hb[17] = dy02;
    hb[18] = dx10; hb[19] = dx11; hb[20] = dx12; hb[21] = dy10; hb[22] = dy11; hb[23] = dy12;
    for (let j = 0; j < 24; j++) { const v = hb[j]; if (!(v > 1e-20 || v < -1e-20)) hb[j] = 0; else if (!Number.isFinite(v)) hb.fill(0); }
    for (let j = 0; j < 24; j++) if (!Number.isFinite(bb[j])) { bb.fill(0); break; }
    if (Math.abs(this.dcY) < 1e-20) this.dcY = 0;
    if (!Number.isFinite(this.dcY)) { this.dcX = 0; this.dcY = 0; }

    // UI: steps, running, trigger / rhythm / MIDI flashes - at most every 25 ms
    const now = t0 + n / sr;
    if ((this.uiDirty || this.uiTrig || this.uiRhy || this.uiMidi) && now - this.uiLast >= 0.025) {
      const lit = this.playKnob || this.midiRun || (this.run && !this.audition);
      this.port.postMessage({ t: 's', s1: this.pos[0], s2: this.pos[1], run: lit ? 1 : 0, trig: this.uiTrig, rhy: this.uiRhy, midi: this.uiMidi, aud: this.audition ? 1 : 0 });
      this.uiDirty = false; this.uiTrig = 0; this.uiRhy = 0; this.uiMidi = 0; this.uiLast = now;
    }
    return true;
  }
}

registerProcessor('subharmonicon', SubharmoniconProcessor);
