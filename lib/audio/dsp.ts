// ============================================================================
// DSP building blocks shared by every instrument
// Thin wrappers over the AudioWorklet processors in public/worklets plus a few
// native-node helpers (noise, constants, LFOs, effects).
// Requires loadWorklets() to have resolved before construction.
// ============================================================================

/** Smoothly move an AudioParam to a new value (avoids zipper noise) */
export function smooth(param: AudioParam, value: number, ctx: BaseAudioContext, time = 0.012): void {
  if (!Number.isFinite(value)) return;
  param.cancelScheduledValues(ctx.currentTime);
  param.setTargetAtTime(value, ctx.currentTime, time);
}

/** Set immediately (for discrete jumps like sequencer steps) */
export function setAt(param: AudioParam, value: number, time: number): void {
  if (!Number.isFinite(value)) return;
  param.setValueAtTime(value, time);
}

// ----------------------------------------------------------------------------
// Sources
// ----------------------------------------------------------------------------

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

export function getNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    const len = ctx.sampleRate * 3;
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
}

/** Looping white noise source (already started) */
export function createNoise(ctx: BaseAudioContext): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = getNoiseBuffer(ctx);
  s.loop = true;
  // Random start offset so several noise sources are decorrelated
  s.start(0, Math.random() * 2);
  return s;
}

/** Constant (DC) source - used for CV outputs and summing offsets (already started) */
export function createConstant(ctx: BaseAudioContext, value = 0): ConstantSourceNode {
  const c = ctx.createConstantSource();
  c.offset.value = value;
  c.start();
  return c;
}

export type LfoWave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'ramp';

/** Low-frequency oscillator. `ramp` is a downward saw. Output is -1..1 */
export class Lfo {
  readonly osc: OscillatorNode;
  readonly output: GainNode;
  private invert: GainNode;
  constructor(private ctx: BaseAudioContext, rate = 1, wave: LfoWave = 'triangle') {
    this.osc = ctx.createOscillator();
    this.invert = ctx.createGain();
    this.output = ctx.createGain();
    this.osc.connect(this.invert).connect(this.output);
    this.osc.frequency.value = rate;
    this.setWave(wave);
    this.osc.start();
  }
  get frequency() { return this.osc.frequency; }
  setWave(wave: LfoWave) {
    this.osc.type = wave === 'ramp' ? 'sawtooth' : wave;
    this.invert.gain.value = wave === 'ramp' ? -1 : 1;
  }
  stop() { try { this.osc.stop(); } catch { /* ignore */ } }
}

/**
 * Band-limited VCO (worklet 'vco').
 * Outputs: tri, saw, pulse, sine. Params: frequency (Hz), pitch (octaves CV),
 * fm (linear Hz), pw (0..1), sync (0/1). Connect a master oscillator to
 * `syncInput` for hard sync.
 */
export class Vco {
  readonly node: AudioWorkletNode;
  readonly tri: GainNode;
  readonly saw: GainNode;
  readonly pulse: GainNode;
  readonly sine: GainNode;
  constructor(ctx: BaseAudioContext, frequency = 220) {
    this.node = new AudioWorkletNode(ctx, 'vco', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [4],
      parameterData: { frequency },
    });
    const split = ctx.createChannelSplitter(4);
    this.node.connect(split);
    const tap = (i: number) => {
      const g = ctx.createGain();
      split.connect(g, i);
      return g;
    };
    this.tri = tap(0);
    this.saw = tap(1);
    this.pulse = tap(2);
    this.sine = tap(3);
  }
  get syncInput(): AudioNode { return this.node; }
  get frequency(): AudioParam { return this.node.parameters.get('frequency')!; }
  get pitch(): AudioParam { return this.node.parameters.get('pitch')!; }
  get fm(): AudioParam { return this.node.parameters.get('fm')!; }
  get pw(): AudioParam { return this.node.parameters.get('pw')!; }
  get sync(): AudioParam { return this.node.parameters.get('sync')!; }
}

export type LadderMode = 'lp24' | 'lp18' | 'lp12' | 'lp6' | 'hp24' | 'hp12' | 'bp12';
const LADDER_MODES: Record<LadderMode, number> = { lp24: 0, lp12: 1, lp6: 2, hp24: 3, bp12: 4, hp12: 5, lp18: 6 };

/** Moog-style 4-pole ladder filter (worklet 'ladder'). cutoffCv is in octaves */
export class Ladder {
  readonly node: AudioWorkletNode;
  constructor(ctx: BaseAudioContext, cutoff = 1000) {
    this.node = new AudioWorkletNode(ctx, 'ladder', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      parameterData: { cutoff },
    });
  }
  get input(): AudioNode { return this.node; }
  get output(): AudioNode { return this.node; }
  get cutoff(): AudioParam { return this.node.parameters.get('cutoff')!; }
  get cutoffCv(): AudioParam { return this.node.parameters.get('cutoffCv')!; }
  get resonance(): AudioParam { return this.node.parameters.get('resonance')!; }
  get drive(): AudioParam { return this.node.parameters.get('drive')!; }
  setMode(mode: LadderMode) {
    this.node.parameters.get('mode')!.value = LADDER_MODES[mode];
  }
}

export type EnvMode = 'ad' | 'adsr' | 'ar';
const ENV_MODES: Record<EnvMode, number> = { ad: 0, adsr: 1, ar: 2 };

/**
 * Envelope generator (worklet 'env'). Output is 0..peak.
 * Times in seconds. timeCv (1.0 = 5 V) shortens times exponentially.
 * Feed an audio gate into `gateInput` or schedule with trigger()/gate().
 */
export class Env {
  readonly node: AudioWorkletNode;
  constructor(ctx: BaseAudioContext, mode: EnvMode = 'ad') {
    this.node = new AudioWorkletNode(ctx, 'env', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      parameterData: { mode: ENV_MODES[mode] },
    });
  }
  get output(): AudioNode { return this.node; }
  get gateInput(): AudioNode { return this.node; }
  get attack(): AudioParam { return this.node.parameters.get('attack')!; }
  get decay(): AudioParam { return this.node.parameters.get('decay')!; }
  get sustain(): AudioParam { return this.node.parameters.get('sustain')!; }
  get release(): AudioParam { return this.node.parameters.get('release')!; }
  get timeCv(): AudioParam { return this.node.parameters.get('timeCv')!; }
  setMode(mode: EnvMode) { this.node.parameters.get('mode')!.value = ENV_MODES[mode]; }
  setLinear(linear: boolean) { this.node.parameters.get('curve')!.value = linear ? 1 : 0; }
  /** One-shot trigger at audio time `time` with peak `velocity` (0..1) */
  trigger(time: number, velocity = 1) {
    this.node.port.postMessage({ type: 'trig', time, velocity });
  }
  gate(time: number, on: boolean, velocity = 1) {
    this.node.port.postMessage({ type: 'gate', time, on, velocity });
  }
  reset() { this.node.port.postMessage({ type: 'reset' }); }
}

/** Short pulse on a ConstantSource offset - turns a trigger event into an audio-rate CV pulse */
export function pulse(param: AudioParam, time: number, width = 0.005, level = 1): void {
  param.setValueAtTime(level, time);
  param.setValueAtTime(0, time + width);
}

// ----------------------------------------------------------------------------
// Effects
// ----------------------------------------------------------------------------

/** tanh-style waveshaper. amount 0..1 */
export function createDrive(ctx: BaseAudioContext, amount = 0.3): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  setDriveAmount(ws, amount);
  ws.oversample = '2x';
  return ws;
}

export function setDriveAmount(ws: WaveShaperNode, amount: number): void {
  const k = 1 + Math.max(0, amount) * 30;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  ws.curve = curve;
}

/** Feedback delay with a tone filter in the loop */
export class Delay {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly delay: DelayNode;
  readonly feedback: GainNode;
  readonly tone: BiquadFilterNode;
  constructor(ctx: BaseAudioContext, maxTime = 4) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.delay = ctx.createDelay(maxTime);
    this.feedback = ctx.createGain();
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 6000;
    this.delay.delayTime.value = 0.3;
    this.feedback.gain.value = 0.35;
    this.input.connect(this.delay);
    this.delay.connect(this.tone);
    this.tone.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.tone.connect(this.output);
  }
}

/** Algorithmic-ish reverb: convolver with a generated decaying-noise impulse */
export class Reverb {
  readonly input: GainNode;
  readonly output: GainNode;
  private convolver: ConvolverNode;
  private predelay: DelayNode;
  private damp: BiquadFilterNode;
  private seconds = -1;
  constructor(private ctx: BaseAudioContext, seconds = 2.5) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.predelay = ctx.createDelay(0.5);
    this.predelay.delayTime.value = 0.02;
    this.damp = ctx.createBiquadFilter();
    this.damp.type = 'lowpass';
    this.damp.frequency.value = 8000;
    this.convolver = ctx.createConvolver();
    this.input.connect(this.predelay).connect(this.damp).connect(this.convolver).connect(this.output);
    this.setSize(seconds);
  }
  get damping(): AudioParam { return this.damp.frequency; }
  get preDelay(): AudioParam { return this.predelay.delayTime; }
  setSize(seconds: number) {
    const s = Math.max(0.2, Math.min(10, seconds));
    if (Math.abs(s - this.seconds) < 0.05) return;
    this.seconds = s;
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * s);
    const ir = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
    }
    this.convolver.buffer = ir;
  }
}

// ----------------------------------------------------------------------------
// Pitch helpers
// ----------------------------------------------------------------------------

export const midiToHz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (note: number) => `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
