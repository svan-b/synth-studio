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
 * VCO settings: processorOptions at construction, or vco.set({...}) later. None of them is an
 * AudioParam on purpose - every AudioParam costs CPU on every render quantum, even when idle.
 */
export interface VcoSettings {
  /** Output mask, a sum of VCO_OUT bits (default 63 = all). Masked outputs are silent and cost nothing. */
  mask?: number;
  /** Analog drift: slow random pitch wander in cents (about 1 sigma). 0 = off (default) */
  drift?: number;
  /** Rough speed of the drift wander, Hz (default 0.25) */
  driftRate?: number;
  /** Fixed per-instance detune: tolerance (cents) x a random draw in -1..1 made at construction. 0 = off */
  tolerance?: number;
  /** true (default) = a negative instantaneous frequency runs the phase backwards (through-zero); false = stops at 0 Hz */
  thruZero?: boolean;
  /**
   * true = `fm` is a ratio of the oscillator frequency, f = f0 * (1 + fm): through-zero linear FM with
   * a constant index across the keyboard (fm = -1 is 0 Hz, -2 runs backwards at f0). false (default) = `fm` in Hz.
   */
  fmRatio?: boolean;
}

/** Options for new Vco(ctx, frequency, options). Omitted = the original VCO. */
export interface VcoOptions extends VcoSettings {
  /** Add sub-oscillator outputs `sub1` (square, -1 octave) and `sub2` (square, -2 octaves). The node gets 6 channels. */
  subs?: boolean;
  /** Seed for the drift / tolerance randomness and start phase (reproducible instances) */
  seed?: number;
  /** Start phase 0..1 (default: random, so stacked oscillators don't phase-lock) */
  phase?: number;
}

/** Output-mask bits for VcoSettings.mask / Vco.useOutputs() */
export const VCO_OUT = { tri: 1, saw: 2, pulse: 4, sine: 8, sub1: 16, sub2: 32 } as const;
export type VcoOutput = keyof typeof VCO_OUT;

/**
 * Band-limited VCO (worklet 'vco'): 4-point polyBLEP / polyBLAMP on every edge (saw, pulse,
 * triangle corners, sub-sample hard sync, through-zero FM), 3 samples of latency.
 * Outputs: tri, saw, pulse, sine (+ sub1, sub2 with { subs: true }). Params: frequency (Hz),
 * pitch (octaves CV), fm (linear, Hz or a ratio with fmRatio), pw (0..1), sync (0/1). Connect a
 * master oscillator to `syncInput` for hard sync.
 * Settings (VcoSettings): mask, drift, driftRate, tolerance, thruZero, fmRatio.
 */
export class Vco {
  readonly node: AudioWorkletNode;
  readonly tri: GainNode;
  readonly saw: GainNode;
  readonly pulse: GainNode;
  readonly sine: GainNode;
  /** Square one octave down (null unless constructed with { subs: true }) */
  readonly sub1: GainNode | null = null;
  /** Square two octaves down (null unless constructed with { subs: true }) */
  readonly sub2: GainNode | null = null;
  constructor(ctx: BaseAudioContext, frequency = 220, options?: VcoOptions) {
    const subs = !!options?.subs;
    const channels = subs ? 6 : 4;
    const init: AudioWorkletNodeOptions = {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [channels],
      parameterData: { frequency },
    };
    if (options) init.processorOptions = { ...options };
    this.node = new AudioWorkletNode(ctx, 'vco', init);
    const split = ctx.createChannelSplitter(channels);
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
    if (subs) {
      this.sub1 = tap(4);
      this.sub2 = tap(5);
    }
  }
  get syncInput(): AudioNode { return this.node; }
  get frequency(): AudioParam { return this.node.parameters.get('frequency')!; }
  get pitch(): AudioParam { return this.node.parameters.get('pitch')!; }
  get fm(): AudioParam { return this.node.parameters.get('fm')!; }
  get pw(): AudioParam { return this.node.parameters.get('pw')!; }
  get sync(): AudioParam { return this.node.parameters.get('sync')!; }
  /** Change settings (applies from the next render quantum) */
  set(settings: VcoSettings) { this.node.port.postMessage({ type: 'set', ...settings }); }
  /** Compute only these outputs (the others go silent - with a 2.7 ms fade - and cost nothing). No arguments = all. */
  useOutputs(...outs: VcoOutput[]) {
    this.set({ mask: outs.length ? outs.reduce((m, o) => m | VCO_OUT[o], 0) : 63 });
  }
  /** Analog drift in cents (0 = off) and its rough rate in Hz */
  setDrift(cents: number, rateHz?: number) { this.set({ drift: cents, driftRate: rateHz }); }
  /** Per-instance tolerance in cents (0 = off) */
  setTolerance(cents: number) { this.set({ tolerance: cents }); }
}

export type LadderMode = 'lp24' | 'lp18' | 'lp12' | 'lp6' | 'hp24' | 'hp12' | 'bp12';
const LADDER_MODES: Record<LadderMode, number> = { lp24: 0, lp12: 1, lp6: 2, hp24: 3, bp12: 4, hp12: 5, lp18: 6 };

/** Ladder settings: processorOptions at construction, or ladder.set({...}) later */
export interface LadderSettings {
  /** 0 = the original 1x model (default). 1 = 2x oversampled transistor core with per-stage saturation (~4x CPU). */
  quality?: 0 | 1;
  /** Passband (bass) loss compensation at high resonance, low-pass modes: 0 = classic Moog (default), 1 = full */
  comp?: number;
}

/**
 * Moog-style 4-pole ladder filter (worklet 'ladder'). cutoffCv is in octaves. Every mode tap
 * (LP24/18/12/6, HP24/12, BP12) in both qualities. Settings: quality, comp.
 */
export class Ladder {
  readonly node: AudioWorkletNode;
  constructor(ctx: BaseAudioContext, cutoff = 1000, options?: LadderSettings) {
    const init: AudioWorkletNodeOptions = {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      parameterData: { cutoff },
    };
    if (options) init.processorOptions = { ...options };
    this.node = new AudioWorkletNode(ctx, 'ladder', init);
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
  /** Change settings (applies from the next render quantum) */
  set(settings: LadderSettings) { this.node.port.postMessage({ type: 'set', ...settings }); }
  setQuality(quality: 0 | 1) { this.set({ quality }); }
  setComp(amount: number) { this.set({ comp: amount }); }
}

export type EnvMode = 'ad' | 'adsr' | 'ar';
const ENV_MODES: Record<EnvMode, number> = { ad: 0, adsr: 1, ar: 2 };

/** Envelope settings: processorOptions at construction, or env.set({...}, time?) later */
export interface EnvSettings {
  /** Delay before the attack, seconds (default 0) - with hold: DAHDSR */
  delay?: number;
  /** Hold at the peak after the attack, seconds (default 0) */
  hold?: number;
  /** Loop: AD cycles until reset(); ADSR / AR repeat attack-hold-decay-release while the gate is held */
  loop?: boolean;
  /** Analog RC curves: convex attack (charges toward 1.5 x peak), exponential decay / release */
  analog?: boolean;
  /** Curvature -1..1: + = more convex (fast start), - = concave (slow start), 0 = mode default */
  shape?: number;
}

/**
 * Envelope generator (worklet 'env'). Output is 0..peak.
 * Times in seconds. timeCv (1.0 = 5 V) shortens times exponentially.
 * Feed an audio gate into `gateInput` or schedule with trigger()/gate().
 * Retriggers continue from the current level (a lower peak is reached with a short ramp, never a jump).
 * Settings (EnvSettings, defaults = the original envelope): delay, hold, loop, analog, shape.
 */
export class Env {
  readonly node: AudioWorkletNode;
  constructor(ctx: BaseAudioContext, mode: EnvMode = 'ad', options?: EnvSettings) {
    const init: AudioWorkletNodeOptions = {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      parameterData: { mode: ENV_MODES[mode] },
    };
    if (options) init.processorOptions = { ...options };
    this.node = new AudioWorkletNode(ctx, 'env', init);
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
  /**
   * Change settings. With `time` (audio time) they apply from the render quantum containing it -
   * schedule them at a trig's time for per-step changes. Without, from the next quantum.
   */
  set(settings: EnvSettings, time?: number) { this.node.port.postMessage({ type: 'set', ...settings, time }); }
  setLoop(on: boolean, time?: number) { this.set({ loop: on }, time); }
  setAnalog(on: boolean, time?: number) { this.set({ analog: on }, time); }
  /** One-shot trigger at audio time `time` with peak `velocity` (0..1) */
  trigger(time: number, velocity = 1) {
    this.node.port.postMessage({ type: 'trig', time, velocity });
  }
  gate(time: number, on: boolean, velocity = 1) {
    this.node.port.postMessage({ type: 'gate', time, on, velocity });
  }
  reset() { this.node.port.postMessage({ type: 'reset' }); }
}

export type SvfMode = 'lp2' | 'lp1' | 'bp' | 'hp1' | 'hp2' | 'notch' | 'peak';
const SVF_MODES: Record<SvfMode, number> = { lp2: 0, lp1: 1, bp: 2, hp1: 3, hp2: 4, notch: 5, peak: 6 };

/**
 * Zero-delay-feedback state-variable filter (worklet 'svf', Simper / Cytomic trapezoidal SVF).
 * Modes LP2 / LP1 / BP / HP1 / HP2 / notch / peak (the Elektron multimode set; the numeric
 * `mode` param uses the same order 0..6 as 'a4-svf'). a-rate cutoff (Hz) and cutoffCv
 * (octaves), resonance 0..1 (Q 0.5..25, stable under audio-rate modulation), drive 0..10
 * (input saturation, 0 = clean). LP1 / HP1 are true 6 dB/oct slopes at resonance 0.
 */
export class Svf {
  readonly node: AudioWorkletNode;
  constructor(ctx: BaseAudioContext, cutoff = 1000, mode: SvfMode = 'lp2') {
    this.node = new AudioWorkletNode(ctx, 'svf', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      parameterData: { cutoff, mode: SVF_MODES[mode] },
    });
  }
  get input(): AudioNode { return this.node; }
  get output(): AudioNode { return this.node; }
  get cutoff(): AudioParam { return this.node.parameters.get('cutoff')!; }
  get cutoffCv(): AudioParam { return this.node.parameters.get('cutoffCv')!; }
  get resonance(): AudioParam { return this.node.parameters.get('resonance')!; }
  get drive(): AudioParam { return this.node.parameters.get('drive')!; }
  get mode(): AudioParam { return this.node.parameters.get('mode')!; }
  setMode(mode: SvfMode) { this.mode.value = SVF_MODES[mode]; }
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

/** Reverb2 settings: options at construction, or reverb.set({...}) later */
export interface Reverb2Settings {
  /** Input low cut, Hz (10..2000, default 20) */
  lowCut?: number;
  /** Input high cut, Hz (500..20000, default 16000) */
  highCut?: number;
}

/**
 * Algorithmic stereo reverb (worklet 'fdn-reverb'): predelay, 3-stage Hadamard diffuser and
 * an 8-line modulated feedback delay network with per-line absorption filters, so the RT60
 * equals `decay` at low / mid frequencies and halves at the `damping` frequency in any size.
 * Mirrors the Reverb API (input, output, damping, preDelay, setSize(seconds)) so it is a
 * drop-in upgrade, but costs a fraction of the convolver, changes decay instantly (no impulse
 * regeneration) and skips all work while its input and tail are silent.
 * 100% wet by default (a send effect); `dry` adds the input for use as an insert.
 */
export class Reverb2 {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly node: AudioWorkletNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  constructor(private ctx: BaseAudioContext, seconds = 2.5, options?: Reverb2Settings & { seed?: number }) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0;
    this.node = new AudioWorkletNode(ctx, 'fdn-reverb', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      parameterData: { decay: Math.max(0.1, Math.min(30, seconds)) },
      processorOptions: { ...options },
    });
    this.input.connect(this.node).connect(this.wetGain).connect(this.output);
    this.input.connect(this.dryGain).connect(this.output);
  }
  private p(name: string): AudioParam { return this.node.parameters.get(name)!; }
  /** RT60 at low / mid frequencies, seconds (0.1..30, default 2.5) */
  get decay(): AudioParam { return this.p('decay'); }
  /** Frequency (Hz) where the decay time halves; higher = brighter tail (200..20000, default 7000) */
  get damping(): AudioParam { return this.p('damping'); }
  /** Predelay, seconds (0..1, default 0.02) */
  get preDelay(): AudioParam { return this.p('predelay'); }
  /** Room size 0..1: delay-line lengths and echo spacing (default 0.6). Glides, no clicks. */
  get size(): AudioParam { return this.p('size'); }
  /** Stereo width 0 (mono) .. 1 (default) */
  get width(): AudioParam { return this.p('width'); }
  /** Delay-line modulation depth 0..1 (chorusing of the tail, default 0.5) */
  get modDepth(): AudioParam { return this.p('mod'); }
  /** Delay-line modulation rate, Hz (0.05..5, default 0.6) */
  get modRate(): AudioParam { return this.p('modRate'); }
  /** Wet level (default 1) */
  get wet(): AudioParam { return this.wetGain.gain; }
  /** Dry level (default 0) */
  get dry(): AudioParam { return this.dryGain.gain; }
  /** Same call as Reverb.setSize: the decay time in seconds (glides, no rebuild) */
  setSize(seconds: number) {
    smooth(this.decay, Math.max(0.1, Math.min(30, seconds)), this.ctx, 0.05);
  }
  /** Change settings (input tone) */
  set(settings: Reverb2Settings) { this.node.port.postMessage({ type: 'set', ...settings }); }
}

/** Chorus settings: options at construction, or chorus.set({...}) later */
export interface ChorusSettings {
  /** 1 = one BBD line (mono wet), 2 = two lines with opposite LFO phase (stereo, default) */
  voices?: 1 | 2;
  /** 0 = triangle LFO (Juno, default), 1 = sine */
  lfoShape?: 0 | 1;
  /** Bucket-brigade band limit, Hz (500..20000, default 9000) */
  highCut?: number;
  /** Wet low cut, Hz (10..4000, default 30) */
  lowCut?: number;
  /** BBD input saturation 0..1 (default 0.15) */
  drive?: number;
}

/**
 * BBD-style stereo chorus (worklet 'chorus'): one or two modulated bucket-brigade lines with
 * opposite LFO phase, BBD band limiting, soft input saturation and feedback.
 * 100% wet by default (a send effect); for an insert set dry to 1 and wet to taste.
 */
export class Chorus {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly node: AudioWorkletNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  constructor(ctx: BaseAudioContext, options?: ChorusSettings & { phase?: number }) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0;
    this.node = new AudioWorkletNode(ctx, 'chorus', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { ...options },
    });
    this.input.connect(this.node).connect(this.wetGain).connect(this.output);
    this.input.connect(this.dryGain).connect(this.output);
  }
  private p(name: string): AudioParam { return this.node.parameters.get(name)!; }
  /** LFO rate, Hz (0.01..20, default 0.5) */
  get rate(): AudioParam { return this.p('rate'); }
  /** Modulation depth, seconds (0..0.02, default 0.0018) */
  get depth(): AudioParam { return this.p('depth'); }
  /** Centre delay, seconds (0.0005..0.05, default 0.0035). Glides, no pitch jumps. */
  get delay(): AudioParam { return this.p('delay'); }
  /** -0.95..0.95 (default 0); higher = flanger-like */
  get feedback(): AudioParam { return this.p('feedback'); }
  /** Stereo width 0..1 (default 1) */
  get width(): AudioParam { return this.p('width'); }
  /** Wet level (default 1) */
  get wet(): AudioParam { return this.wetGain.gain; }
  /** Dry level (default 0) */
  get dry(): AudioParam { return this.dryGain.gain; }
  /** Change settings (applies from the next render quantum) */
  set(settings: ChorusSettings) { this.node.port.postMessage({ type: 'set', ...settings }); }
}

// ----------------------------------------------------------------------------
// Pitch helpers
// ----------------------------------------------------------------------------

export const midiToHz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (note: number) => `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
