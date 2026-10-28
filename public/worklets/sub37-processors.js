/* eslint-disable */
// ============================================================================
// Moog Sub 37 AudioWorklet processors (device-specific)
//
//   'sub37-osc' - one Sub 37 oscillator. The WAVE control morphs continuously
//                 triangle -> saw -> square -> narrow pulse (a-rate, so mod busses
//                 can sweep it). PolyBLEP band-limited. Hard sync input, constant
//                 Hz detune (BEAT FREQ) and keyboard phase reset.
//                 Output channels: [0] wave  [1] sub osc (square, 1 octave down)
//                                  [2] sync pulse (wrap marker for a slave osc)
//   'sub37-lfo' - mod bus LFO: triangle, square, saw (falling), ramp (rising),
//                 sample & hold. Output -1..1.
//   'sub37-env' - DAHDSR envelope (Delay, Attack, Hold, Decay, Sustain, Release)
//                 with LOOP and RESET behaviour, sample-accurate scheduled gates
//                 and an a-rate time modulation input (KB AMT / EG TIME mod).
// ============================================================================

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

class Sub37Osc extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 261.63, minValue: 0, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'pitch', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      { name: 'detuneHz', defaultValue: 0, minValue: -1000, maxValue: 1000, automationRate: 'a-rate' },
      { name: 'wave', defaultValue: 0.33, minValue: -1, maxValue: 2, automationRate: 'a-rate' },
      { name: 'sync', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.phase = Math.random();
    this.sub = 0;
    this.resets = [];
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'reset') {
        this.resets.push(e.data.time);
        this.resets.sort((a, b) => a - b);
      }
    };
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const wO = out[0], sO = out[1], yO = out[2];
    const n = wO.length;
    const syncIn = inputs[0] && inputs[0][0];
    const syncOn = params.sync[0] > 0.5 && !!syncIn;
    const base = params.frequency[0];
    const pA = params.pitch, dA = params.detuneHz, wA = params.wave;
    const sr = sampleRate;
    const nyq = sr * 0.45;
    let pitchMul = Math.pow(2, pA[0]);
    const pConst = pA.length === 1;
    const t0 = currentTime;

    for (let i = 0; i < n; i++) {
      if (this.resets.length && this.resets[0] <= t0 + i / sr) {
        this.resets.shift();
        this.phase = 0;
        this.sub = 0;
      }
      if (!pConst) pitchMul = Math.pow(2, pA[i]);
      let f = base * pitchMul + (dA.length > 1 ? dA[i] : dA[0]);
      if (f > nyq) f = nyq;
      if (f < 0.01) f = 0.01;
      const dt = f / sr;

      if (syncOn) {
        const s = syncIn[i];
        if (s >= 1) { this.phase = (s - 1) * dt; this.sub = this.sub < 0.5 ? 0 : 0.5; }
      }

      let w = wA.length > 1 ? wA[i] : wA[0];
      if (w < 0) w = 0; else if (w > 1) w = 1;
      const t = this.phase;

      // Saw (rising), with PolyBLEP at the wrap
      const saw = 2 * t - 1 - blep(t, dt);
      // Pulse: 50% until 2/3 of the WAVE travel, then narrows to ~8%
      const pw = w <= 0.6667 ? 0.5 : 0.5 - 0.42 * (w - 0.6667) * 3;
      let t2 = t - pw; if (t2 < 0) t2 += 1;
      const pul = (t < pw ? 1 : -1) + blep(t, dt) - blep(t2, dt);
      const tri = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;

      let y;
      if (w <= 0.3333) { const a = w * 3; y = tri * (1 - a) + saw * a; }
      else if (w <= 0.6667) { const b = (w - 0.3333) * 3; y = saw * (1 - b) + pul * 0.85 * b; }
      else y = pul * 0.85;
      wO[i] = y;

      // Sub oscillator: square one octave below (half rate phase)
      if (sO) {
        const ds = dt * 0.5;
        const st = this.sub;
        let st2 = st - 0.5; if (st2 < 0) st2 += 1;
        sO[i] = ((st < 0.5 ? 1 : -1) + blep(st, ds) - blep(st2, ds)) * 0.85;
        this.sub += ds;
        if (this.sub >= 1) this.sub -= 1;
      }

      this.phase += dt;
      if (this.phase >= 1) {
        this.phase -= 1;
        if (yO) yO[i] = 1 + this.phase / dt; // fraction of a sample since the wrap
      } else if (yO) yO[i] = 0;
    }
    return true;
  }
}

// shape: 0 TRI, 1 SQR, 2 SAW (falling), 3 RAMP (rising), 4 S&H
class Sub37Lfo extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 1, minValue: 0.01, maxValue: 2000, automationRate: 'k-rate' },
      { name: 'shape', defaultValue: 0, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.phase = 0;
    this.held = Math.random() * 2 - 1;
  }
  process(inputs, outputs, params) {
    const o = outputs[0][0];
    const n = o.length;
    const dt = params.rate[0] / sampleRate;
    const shape = Math.round(params.shape[0]);
    for (let i = 0; i < n; i++) {
      const t = this.phase;
      let y;
      switch (shape) {
        case 1: y = t < 0.5 ? 1 : -1; break;
        case 2: y = 1 - 2 * t; break;
        case 3: y = 2 * t - 1; break;
        case 4: y = this.held; break;
        default: y = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
      }
      o[i] = y;
      this.phase += dt;
      if (this.phase >= 1) { this.phase -= 1; this.held = Math.random() * 2 - 1; }
    }
    return true;
  }
}

// Stages: 0 idle, 1 delay, 2 attack, 3 hold, 4 decay, 5 sustain, 6 release
class Sub37Env extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'delay', defaultValue: 0, minValue: 0, maxValue: 30, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.002, minValue: 0.0005, maxValue: 30, automationRate: 'k-rate' },
      { name: 'hold', defaultValue: 0, minValue: 0, maxValue: 30, automationRate: 'k-rate' },
      { name: 'decay', defaultValue: 0.3, minValue: 0.0005, maxValue: 30, automationRate: 'k-rate' },
      { name: 'sustain', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.3, minValue: 0.0005, maxValue: 30, automationRate: 'k-rate' },
      { name: 'loop', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // Time modulation in octaves: every stage time is multiplied by 2^-timeMod
      { name: 'timeMod', defaultValue: 0, minValue: -8, maxValue: 8, automationRate: 'a-rate' },
    ];
  }

  constructor() {
    super();
    this.v = 0;
    this.stage = 0;
    this.peak = 1;
    this.count = 0;
    this.gate = false;
    this.queue = [];
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'clear') { this.queue = []; this.v = 0; this.stage = 0; this.gate = false; return; }
      this.queue.push(m);
      this.queue.sort((a, b) => a.time - b.time);
    };
  }

  start(reset) {
    if (reset) this.v = 0;
    this.stage = 1;
    this.count = 0;
  }

  process(inputs, outputs, params) {
    const o = outputs[0][0];
    const n = o.length;
    const sr = sampleRate;
    const delay = params.delay[0], attack = params.attack[0], hold = params.hold[0];
    const decay = params.decay[0], sus = params.sustain[0], release = params.release[0];
    const loop = params.loop[0] > 0.5;
    const tm = params.timeMod;
    const t0 = currentTime;
    let scale = Math.pow(2, -tm[0]);

    for (let i = 0; i < n; i++) {
      const now = t0 + i / sr;
      while (this.queue.length && this.queue[0].time <= now) {
        const m = this.queue.shift();
        if (m.on) {
          this.gate = true;
          this.peak = m.velocity === undefined ? 1 : m.velocity;
          this.start(!!m.reset);
        } else {
          this.gate = false;
          if (this.stage !== 0) this.stage = 6;
        }
      }
      if (tm.length > 1) scale = Math.pow(2, -tm[i]);

      switch (this.stage) {
        case 1: // delay: hold the current level
          if (++this.count >= delay * scale * sr) { this.stage = 2; this.count = 0; }
          break;
        case 2: {
          this.v += this.peak / Math.max(1, attack * scale * sr);
          if (this.v >= this.peak) { this.v = this.peak; this.stage = 3; this.count = 0; }
          break;
        }
        case 3:
          if (++this.count >= hold * scale * sr) { this.stage = 4; }
          break;
        case 4: {
          const target = sus * this.peak;
          const c = Math.exp(-6.9 / Math.max(1, decay * scale * sr));
          this.v = target + (this.v - target) * c;
          if (Math.abs(this.v - target) < 1e-3) {
            this.v = target;
            this.stage = loop && this.gate ? 6 : 5;
          }
          break;
        }
        case 5:
          this.v = sus * this.peak;
          break;
        case 6: {
          const c = Math.exp(-6.9 / Math.max(1, release * scale * sr));
          this.v *= c;
          if (this.v < 1e-3) {
            if (loop && this.gate) this.start(false);
            else { this.v = 0; this.stage = 0; }
          }
          break;
        }
        default:
          break;
      }
      o[i] = this.v;
    }
    return true;
  }
}

registerProcessor('sub37-osc', Sub37Osc);
registerProcessor('sub37-lfo', Sub37Lfo);
registerProcessor('sub37-env', Sub37Env);
