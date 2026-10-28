/* eslint-disable */
// ============================================================================
// Synth Studio AudioWorklet processors
//
//   'vco'    - band-limited oscillator (PolyBLEP) with hard sync, linear FM,
//              exponential pitch CV and PWM. One output, 4 channels:
//              [0] triangle  [1] saw  [2] pulse  [3] sine
//   'ladder' - zero-delay-feedback 4-pole ladder filter (Moog style) with
//              tanh saturation and LP24/LP12/LP6/HP24/BP/HP12 taps.
//   'env'    - AD / ADSR / AR envelope with sample-accurate scheduled triggers,
//              an audio-rate gate input, and CV over attack/decay time.
//
// Signal convention used across the app: 1.0 = 5 volts.
// ============================================================================

const TWO_PI = Math.PI * 2;

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

class VcoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 0, maxValue: 24000, automationRate: 'a-rate' },
      // Exponential pitch CV in octaves (1.0 = one octave up)
      { name: 'pitch', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      // Linear FM in Hz (sum of connected modulators)
      { name: 'fm', defaultValue: 0, minValue: -48000, maxValue: 48000, automationRate: 'a-rate' },
      { name: 'pw', defaultValue: 0.5, minValue: 0.02, maxValue: 0.98, automationRate: 'a-rate' },
      { name: 'sync', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.phase = Math.random();
    this.tri = 0;
    this.lastSync = 0;
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const n = out[0].length;
    const syncIn = inputs[0] && inputs[0][0];
    const syncOn = params.sync[0] > 0.5 && syncIn;
    const fArr = params.frequency, pArr = params.pitch, fmArr = params.fm, pwArr = params.pw;
    const sr = sampleRate;
    const triO = out[0], sawO = out[1], pulO = out[2], sinO = out[3];

    for (let i = 0; i < n; i++) {
      const base = fArr.length > 1 ? fArr[i] : fArr[0];
      const pitch = pArr.length > 1 ? pArr[i] : pArr[0];
      const fm = fmArr.length > 1 ? fmArr[i] : fmArr[0];
      let f = base * Math.pow(2, pitch) + fm;
      if (f > sr * 0.45) f = sr * 0.45;
      if (f < -sr * 0.45) f = -sr * 0.45;
      let dt = f / sr;
      const adt = Math.abs(dt) < 1e-9 ? 1e-9 : Math.abs(dt);

      if (syncOn) {
        const s = syncIn[i];
        if (this.lastSync <= 0 && s > 0) this.phase = 0;
        this.lastSync = s;
      }

      const t = this.phase;
      const pw = pwArr.length > 1 ? pwArr[i] : pwArr[0];

      let saw = 2 * t - 1;
      saw -= polyBlep(t, adt);

      let pul = t < pw ? 1 : -1;
      pul += polyBlep(t, adt);
      let t2 = t - pw;
      if (t2 < 0) t2 += 1;
      pul -= polyBlep(t2, adt);

      // Triangle from phase (naive is fine - triangle harmonics fall off at 12dB/oct)
      const tri = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;

      if (triO) triO[i] = tri;
      if (sawO) sawO[i] = saw;
      if (pulO) pulO[i] = pul;
      if (sinO) sinO[i] = Math.sin(TWO_PI * t);

      this.phase += dt;
      while (this.phase >= 1) this.phase -= 1;
      while (this.phase < 0) this.phase += 1;
    }
    return true;
  }
}

class LadderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 1000, minValue: 5, maxValue: 24000, automationRate: 'a-rate' },
      // Exponential cutoff CV in octaves
      { name: 'cutoffCv', defaultValue: 0, minValue: -16, maxValue: 16, automationRate: 'a-rate' },
      // 0..1, ~1 = self oscillation
      { name: 'resonance', defaultValue: 0, minValue: 0, maxValue: 1.2, automationRate: 'a-rate' },
      { name: 'drive', defaultValue: 1, minValue: 0.1, maxValue: 10, automationRate: 'k-rate' },
      // 0 LP24, 1 LP12, 2 LP6, 3 HP24, 4 BP12, 5 HP12, 6 LP18
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 6, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.s = [0, 0, 0, 0];
  }

  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0][0];
    const n = output.length;
    const sr = sampleRate;
    const cArr = params.cutoff, cvArr = params.cutoffCv, rArr = params.resonance;
    const drive = params.drive[0];
    const mode = Math.round(params.mode[0]);
    const s = this.s;

    for (let i = 0; i < n; i++) {
      const x = input ? input[i] * drive : 0;
      let fc = (cArr.length > 1 ? cArr[i] : cArr[0]) * Math.pow(2, cvArr.length > 1 ? cvArr[i] : cvArr[0]);
      if (fc < 5) fc = 5;
      if (fc > sr * 0.45) fc = sr * 0.45;
      const res = rArr.length > 1 ? rArr[i] : rArr[0];
      const k = res * 4.1;

      const g = Math.tan(Math.PI * fc / sr);
      const G = g / (1 + g);
      const S1 = s[0] / (1 + g), S2 = s[1] / (1 + g), S3 = s[2] / (1 + g), S4 = s[3] / (1 + g);
      const G2 = G * G, G3 = G2 * G, G4 = G3 * G;
      const sigma = G3 * S1 + G2 * S2 + G * S3 + S4;
      // Bass compensation as resonance rises (the classic ladder bass drop)
      const xin = x * (1 + res * 0.6);
      const y4est = (G4 * xin + sigma) / (1 + k * G4);
      let u = xin - k * y4est;
      u = Math.tanh(u);

      // Stage 1..4 (TPT one-poles)
      let v = (u - s[0]) * G; const y1 = v + s[0]; s[0] = y1 + v;
      v = (y1 - s[1]) * G; const y2 = v + s[1]; s[1] = y2 + v;
      v = (y2 - s[2]) * G; const y3 = v + s[2]; s[2] = y3 + v;
      v = (y3 - s[3]) * G; const y4 = v + s[3]; s[3] = y4 + v;

      let y;
      switch (mode) {
        case 1: y = y2; break;
        case 2: y = y1; break;
        case 3: y = u - 4 * y1 + 6 * y2 - 4 * y3 + y4; break;
        case 4: y = 2 * (y2 - y4); break;
        case 5: y = u - 2 * y1 + y2; break;
        case 6: y = y3; break;
        default: y = y4;
      }
      output[i] = y;
    }
    // Denormal / blow-up guard
    for (let j = 0; j < 4; j++) {
      if (!Number.isFinite(s[j]) || Math.abs(s[j]) < 1e-20) s[j] = 0;
    }
    return true;
  }
}

// mode: 0 = AD (one shot), 1 = ADSR (gated), 2 = AR (gated, sustain at peak)
class EnvProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'attack', defaultValue: 0.001, minValue: 0.0001, maxValue: 60, automationRate: 'k-rate' },
      { name: 'decay', defaultValue: 0.3, minValue: 0.0005, maxValue: 60, automationRate: 'k-rate' },
      { name: 'sustain', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.3, minValue: 0.0005, maxValue: 60, automationRate: 'k-rate' },
      // CV in "volts/5": +1.0 doubles... x32 the time; time *= 2^(-cv*5) so positive CV = shorter (like DFAM)
      { name: 'timeCv', defaultValue: 0, minValue: -4, maxValue: 4, automationRate: 'a-rate' },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      // 0 = exponential decay, 1 = linear
      { name: 'curve', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.value = 0;
    this.stage = 0; // 0 idle, 1 attack, 2 decay, 3 sustain, 4 release
    this.peak = 1;
    this.queue = [];
    this.gateHigh = false;
    this.lastIn = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'reset') { this.queue = []; this.value = 0; this.stage = 0; return; }
      this.queue.push(m);
      this.queue.sort((a, b) => a.time - b.time);
    };
  }

  fire(velocity) {
    this.peak = velocity === undefined ? 1 : velocity;
    this.stage = 1;
  }

  process(inputs, outputs, params) {
    const out = outputs[0][0];
    const n = out.length;
    const gateIn = inputs[0] && inputs[0][0];
    const attack = params.attack[0], decay = params.decay[0], sustain = params.sustain[0], release = params.release[0];
    const mode = Math.round(params.mode[0]);
    const linear = params.curve[0] > 0.5;
    const cvArr = params.timeCv;
    const sr = sampleRate;
    const t0 = currentTime;

    for (let i = 0; i < n; i++) {
      const now = t0 + i / sr;
      while (this.queue.length && this.queue[0].time <= now) {
        const m = this.queue.shift();
        if (m.type === 'trig') this.fire(m.velocity);
        else if (m.type === 'gate') {
          if (m.on) { this.gateHigh = true; this.fire(m.velocity); }
          else { this.gateHigh = false; if (mode !== 0 && this.stage !== 0) this.stage = 4; }
        }
      }

      if (gateIn) {
        const g = gateIn[i];
        if (this.lastIn < 0.2 && g >= 0.2) { this.gateHigh = true; this.fire(1); }
        else if (this.lastIn >= 0.2 && g < 0.2) { this.gateHigh = false; if (mode !== 0 && this.stage !== 0) this.stage = 4; }
        this.lastIn = g;
      }

      const cv = cvArr.length > 1 ? cvArr[i] : cvArr[0];
      const tScale = Math.pow(2, -cv * 5);

      switch (this.stage) {
        case 1: {
          const inc = this.peak / Math.max(1, attack * tScale * sr);
          this.value += inc;
          if (this.value >= this.peak) {
            this.value = this.peak;
            this.stage = mode === 2 ? 3 : 2;
          }
          break;
        }
        case 2: {
          const target = mode === 1 ? sustain * this.peak : 0;
          const tSamples = Math.max(1, decay * tScale * sr);
          if (linear) {
            this.value -= this.peak / tSamples;
            if (this.value <= target) { this.value = target; this.stage = mode === 1 ? 3 : 0; }
          } else {
            // ~ -60dB over the decay time
            const coef = Math.exp(-6.9 / tSamples);
            this.value = target + (this.value - target) * coef;
            if (Math.abs(this.value - target) < 1e-4) { this.value = target; this.stage = mode === 1 ? 3 : 0; }
          }
          break;
        }
        case 3:
          if (mode === 1) this.value = sustain * this.peak;
          if (mode === 0) this.stage = 0;
          break;
        case 4: {
          const tSamples = Math.max(1, release * tScale * sr);
          const coef = Math.exp(-6.9 / tSamples);
          this.value *= coef;
          if (this.value < 1e-4) { this.value = 0; this.stage = 0; }
          break;
        }
        default:
          break;
      }
      out[i] = this.value;
    }
    return true;
  }
}

registerProcessor('vco', VcoProcessor);
registerProcessor('ladder', LadderProcessor);
registerProcessor('env', EnvProcessor);
