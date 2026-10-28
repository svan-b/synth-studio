/* eslint-disable */
// ============================================================================
// Moog Subharmonicon AudioWorklet processors
//
//   'subharmonicon-vco'  - one VCO plus its two SUBHARMONIC oscillators.
//       The subs are true frequency DIVIDERS of the VCO: they count VCO cycles,
//       so SUB = VCO / n stays phase-locked to the VCO exactly as on the
//       hardware (no beating between a VCO and a sub tuned to the same ratio).
//       Output: 1 output, 3 channels  [0] VCO  [1] SUB 1  [2] SUB 2
//       Params:
//         frequency  Hz, VCO FREQ knob
//         pitch      octaves (exponential CV: sequencer, MIDI, VCO jack)
//         div1/div2  base divisor 1..16 (SUB FREQ knob, sequencer SUB assign)
//         subCv      volts, VCO SUB jack - shifts BOTH divisors (−1.5 n per V)
//         wave       0 = SQR (all square), 1 = SQ/SAW (VCO square, subs saw),
//                    2 = SAW (all saw)                       (manual p.17-18)
//         pwmCv      1.0 = 5 V, external PWM (VCO PWM jack)
//         pwmNormal  1 = SUB 1 sawtooth is normalled to PWM (jack empty)
//
//   'subharmonicon-gate' - rising-edge detector for the gate/clock inputs
//       (PLAY, RESET, TRIGGER, CLOCK). 4 discrete channels in; posts
//       { ch, time } to the main thread on each rising edge (> 1 V), so any
//       voltage - an envelope, a sequencer CV, even an audio-rate sub - can
//       clock or reset the instrument, as on the hardware.
// ============================================================================

function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  } else if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

function sawBlep(t, dt) {
  return 2 * t - 1 - polyBlep(t, dt);
}

function pulseBlep(t, dt, pw) {
  let p = t < pw ? 1 : -1;
  p += polyBlep(t, dt);
  let t2 = t - pw;
  if (t2 < 0) t2 += 1;
  p -= polyBlep(t2, dt);
  return p;
}

const clampDiv = (d) => (d < 1 ? 1 : d > 16 ? 16 : d);

class SubharmoniconVco extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 261.63, minValue: 1, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'pitch', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      { name: 'div1', defaultValue: 2, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'div2', defaultValue: 4, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'subCv', defaultValue: 0, minValue: -50, maxValue: 50, automationRate: 'a-rate' },
      { name: 'wave', defaultValue: 2, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'pwmCv', defaultValue: 0, minValue: -10, maxValue: 10, automationRate: 'a-rate' },
      { name: 'pwmNormal', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.phase = Math.random();
    this.c1 = 0;
    this.c2 = 0;
    this.d1 = 2;
    this.d2 = 4;
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const vO = out[0], s1O = out[1], s2O = out[2];
    const n = vO.length;
    const sr = sampleRate;
    const fA = params.frequency, pA = params.pitch, scA = params.subCv, pwA = params.pwmCv;
    const base1 = params.div1[0], base2 = params.div2[0];
    const wave = Math.round(params.wave[0]);
    const pwmNormal = params.pwmNormal[0] > 0.5;

    for (let i = 0; i < n; i++) {
      const f0 = fA.length > 1 ? fA[i] : fA[0];
      const p = pA.length > 1 ? pA[i] : pA[0];
      let f = f0 * Math.pow(2, p);
      if (f > sr * 0.45) f = sr * 0.45;
      if (f < 0.01) f = 0.01;
      const dt = f / sr;

      // Divisors: knob/sequencer base, shifted by the VCO SUB jack (volts).
      // −1.5 divisions per volt, rounded to an integer (our approximation; the
      // manual only says the input "controls the subdivision" of both subs).
      const sc = scA.length > 1 ? scA[i] : scA[0];
      const d1 = clampDiv(Math.round(base1 - 1.5 * sc));
      const d2 = clampDiv(Math.round(base2 - 1.5 * sc));
      if (d1 !== this.d1) { this.d1 = d1; this.c1 %= d1; }
      if (d2 !== this.d2) { this.d2 = d2; this.c2 %= d2; }

      const t = this.phase;
      const t1 = (this.c1 + t) / d1;
      const t2 = (this.c2 + t) / d2;
      const dt1 = dt / d1, dt2 = dt / d2;

      const sub1Saw = sawBlep(t1, dt1);
      let vco, s1, s2;
      if (wave === 2) {
        vco = sawBlep(t, dt);
        s1 = sub1Saw;
        s2 = sawBlep(t2, dt2);
      } else if (wave === 1) {
        // VCO square with pulse-width modulation; SUB 1 saw is the PWM normal
        const pm = pwmNormal ? sub1Saw * 0.8 : (pwA.length > 1 ? pwA[i] : pwA[0]);
        let pw = 0.5 + 0.45 * pm;
        if (pw < 0.05) pw = 0.05; else if (pw > 0.95) pw = 0.95;
        vco = pulseBlep(t, dt, pw);
        s1 = sub1Saw;
        s2 = sawBlep(t2, dt2);
      } else {
        vco = pulseBlep(t, dt, 0.5);
        s1 = pulseBlep(t1, dt1, 0.5);
        s2 = pulseBlep(t2, dt2, 0.5);
      }
      vO[i] = vco;
      if (s1O) s1O[i] = s1;
      if (s2O) s2O[i] = s2;

      this.phase += dt;
      if (this.phase >= 1) {
        this.phase -= 1;
        // Count VCO cycles - this IS the frequency divider
        this.c1 = (this.c1 + 1) % d1;
        this.c2 = (this.c2 + 1) % d2;
      }
    }
    return true;
  }
}

class SubharmoniconGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.high = [false, false, false, false];
    this.last = [-1, -1, -1, -1];
  }

  process(inputs, outputs) {
    if (outputs[0] && outputs[0][0]) outputs[0][0].fill(0);
    const inp = inputs[0];
    if (!inp || !inp.length) return true;
    const sr = sampleRate;
    for (let ch = 0; ch < 4 && ch < inp.length; ch++) {
      const data = inp[ch];
      if (!data) continue;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (!this.high[ch] && v > 0.2) {          // > 1 V
          this.high[ch] = true;
          const time = currentTime + i / sr;
          // Rate limit (5 ms) so an audio-rate signal cannot flood the main thread
          if (time - this.last[ch] > 0.005) {
            this.last[ch] = time;
            this.port.postMessage({ ch, time });
          }
        } else if (this.high[ch] && v < 0.1) {    // hysteresis
          this.high[ch] = false;
        }
      }
    }
    return true;
  }
}

registerProcessor('subharmonicon-vco', SubharmoniconVco);
registerProcessor('subharmonicon-gate', SubharmoniconGate);
