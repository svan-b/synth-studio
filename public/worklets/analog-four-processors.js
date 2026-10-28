/* eslint-disable */
// ============================================================================
// Analog Four MKII AudioWorklet processors
//
//   'a4-svf' - Filter 2: 2-pole multimode (TPT state-variable filter) with the
//              A4 modes LP2, LP1, BP, HP1, HP2, BS, PK. a-rate cutoff, cutoff CV
//              in octaves (for ENV F / LFO / keytracking) and resonance.
//   'a4-lfo' - the two per-track LFOs in one node (output channels 0 and 1):
//              TRI SIN SQR SAW EXP RMP RND, trig modes FRE TRG HLD ONE HLF,
//              start phase and fade in/out. Trigs are scheduled on the audio
//              clock with port messages { type: 'trig', time }.
// ============================================================================

class A4SvfProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 1000, minValue: 5, maxValue: 24000, automationRate: 'a-rate' },
      { name: 'cutoffCv', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      { name: 'resonance', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      // 0 LP2, 1 LP1, 2 BP, 3 HP1, 4 HP2, 5 BS, 6 PK
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 6, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.ic1 = 0; this.ic2 = 0; this.s1 = 0;
  }

  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0][0];
    const n = out.length;
    const sr = sampleRate;
    const cA = params.cutoff, cvA = params.cutoffCv, rA = params.resonance;
    const mode = Math.round(params.mode[0]);
    for (let i = 0; i < n; i++) {
      const x = input ? input[i] : 0;
      let fc = (cA.length > 1 ? cA[i] : cA[0]) * Math.pow(2, cvA.length > 1 ? cvA[i] : cvA[0]);
      if (fc < 10) fc = 10;
      if (fc > sr * 0.45) fc = sr * 0.45;
      const res = rA.length > 1 ? rA[i] : rA[0];
      const g = Math.tan(Math.PI * fc / sr);
      let y;
      if (mode === 1 || mode === 3) {
        // One-pole (6 dB/oct) low-pass / high-pass
        const G = g / (1 + g);
        const v = (x - this.s1) * G;
        const lp = v + this.s1;
        this.s1 = lp + v;
        y = mode === 1 ? lp : x - lp;
      } else {
        const k = mode === 6 ? 0.7 : 2 - 1.96 * res;
        const a1 = 1 / (1 + g * (g + k));
        const a2 = g * a1;
        const a3 = g * a2;
        const v3 = x - this.ic2;
        const v1 = a1 * this.ic1 + a2 * v3;
        const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
        this.ic1 = 2 * v1 - this.ic1;
        this.ic2 = 2 * v2 - this.ic2;
        switch (mode) {
          case 0: y = v2; break;                          // LP2
          case 2: y = v1 * (0.5 + 0.5 * k); break;        // BP (level-compensated)
          case 4: y = x - k * v1 - v2; break;             // HP2
          case 5: y = x - k * v1; break;                  // BS (notch)
          case 6: y = x + res * 4 * k * v1; break;        // PK: bell boost at cutoff
          default: y = v2;
        }
      }
      out[i] = y;
    }
    if (!Number.isFinite(this.ic1) || !Number.isFinite(this.ic2) || !Number.isFinite(this.s1)) { this.ic1 = 0; this.ic2 = 0; this.s1 = 0; }
    return true;
  }
}

// --------------------------------------------------------------------------

function lfoWave(w, p, rnd) {
  switch (w) {
    case 0: return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;   // TRI
    case 1: return Math.sin(2 * Math.PI * p);           // SIN
    case 2: return p < 0.5 ? 1 : -1;                    // SQR
    case 3: return 1 - 2 * p;                           // SAW (falling)
    case 4: return Math.exp(-5 * p);                    // EXP (unipolar decay)
    case 5: return p;                                   // RMP (unipolar rise)
    case 6: return rnd;                                 // RND
    default: return 0;
  }
}

class A4LfoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const d = [];
    for (const n of [1, 2]) {
      d.push({ name: `rate${n}`, defaultValue: 1, minValue: -2000, maxValue: 2000, automationRate: 'k-rate' });
      d.push({ name: `wave${n}`, defaultValue: 0, minValue: 0, maxValue: 6, automationRate: 'k-rate' });
      d.push({ name: `mode${n}`, defaultValue: 0, minValue: 0, maxValue: 4, automationRate: 'k-rate' });
      d.push({ name: `phase${n}`, defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' });
      d.push({ name: `fade${n}`, defaultValue: 0, minValue: -64, maxValue: 64, automationRate: 'k-rate' });
    }
    return d;
  }

  constructor() {
    super();
    this.l = [0, 1].map(() => ({ phase: Math.random(), run: true, stopAt: 0, travelled: 0, held: 0, fadeLvl: 1, rnd: Math.random() * 2 - 1 }));
    this.queue = [];
    this.port.onmessage = e => {
      this.queue.push(e.data);
      this.queue.sort((a, b) => a.time - b.time);
    };
  }

  trig(i, mode, sph, fade) {
    const s = this.l[i];
    s.fadeLvl = fade < 0 ? 0 : 1;
    if (mode === 0) return;                         // FRE: free running
    if (mode === 2) { s.hold = true; s.held = s.last || 0; return; } // HLD
    s.phase = sph;
    s.travelled = 0;
    s.run = true;
    s.stopAt = mode === 3 ? 1 : mode === 4 ? 0.5 : Infinity; // ONE / HLF
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const n = out[0].length;
    const sr = sampleRate;
    const t0 = currentTime;
    const P = [1, 2].map(k => ({
      rate: params[`rate${k}`][0], wave: Math.round(params[`wave${k}`][0]), mode: Math.round(params[`mode${k}`][0]),
      sph: params[`phase${k}`][0], fade: params[`fade${k}`][0],
    }));
    for (let i = 0; i < n; i++) {
      const now = t0 + i / sr;
      while (this.queue.length && this.queue[0].time <= now) {
        this.queue.shift();
        this.trig(0, P[0].mode, P[0].sph, P[0].fade);
        this.trig(1, P[1].mode, P[1].sph, P[1].fade);
      }
      for (let k = 0; k < 2; k++) {
        const s = this.l[k];
        const p = P[k];
        if (p.mode !== 2) s.hold = false;
        if (s.run) {
          const inc = p.rate / sr;
          s.phase += inc;
          s.travelled += Math.abs(inc);
          if (s.phase >= 1 || s.phase < 0) {
            s.phase -= Math.floor(s.phase);
            s.rnd = Math.random() * 2 - 1;
          }
          if ((p.mode === 3 || p.mode === 4) && s.travelled >= s.stopAt) s.run = false;
        } else if (p.mode !== 3 && p.mode !== 4) {
          s.run = true;
        }
        // Fade: |FAD| sets the time (larger = slower), sign sets direction
        if (p.fade !== 0) {
          const secs = 0.05 * Math.pow(2, Math.abs(p.fade) / 8);
          const step = 1 / (secs * sr);
          s.fadeLvl = p.fade < 0 ? Math.min(1, s.fadeLvl + step) : Math.max(0, s.fadeLvl - step);
        } else s.fadeLvl = 1;
        const v = lfoWave(p.wave, s.phase, s.rnd);
        s.last = v;
        const ch = out[k];
        if (ch) ch[i] = (s.hold ? s.held : v) * s.fadeLvl;
      }
    }
    return true;
  }
}

registerProcessor('a4-svf', A4SvfProcessor);
registerProcessor('a4-lfo', A4LfoProcessor);
