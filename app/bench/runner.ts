// ============================================================================
// DSP benchmark runner (used by app/bench/page.tsx and scripts/bench.cjs)
//
// Everything renders in an OfflineAudioContext at 48 kHz as fast as the
// machine can, so "realtime factor" = seconds of audio / seconds of rendering
// (higher is better; 1 = exactly real time on one core).
//
//  devices     each registered instrument: worklets loaded, engine started on
//              the offline context, a 10 s demo (its transport control, else a
//              keyboard riff, else a trigger event). Rendered with the shared
//              DSP core before the upgrade ('before', original processors from
//              legacy-processors.ts) and after it ('after').
//  processors  each processor alone: N instances with typical inputs and
//              modulation, minus a baseline graph with the same sources, so the
//              figure is the processor's own cost per instance.
//
// Main-thread scheduling (engine Clocks, the Transport, atTime) normally runs
// on wall-clock timers. During a device render those timers are virtualised
// and advanced on the audio clock at regular ctx.suspend() points, so the
// sequencers play exactly as in real time and the measurement never waits.
// ============================================================================

import type { ControlValue } from '@/types';
import type { DeviceEntry, DeviceModule } from '@/devices/types';
import type { SynthEngine } from '@/lib/audio/engine';
import { defaultOf } from '@/lib/controls/mapping';
import { LEGACY_SYNTH_PROCESSORS } from './legacy-processors';

export const SR = 48000;
export const SECONDS = 10;
const FRAMES = SR * SECONDS;
/** Suspend every 24 render quanta (64 ms): engines schedule >= 100 ms ahead, so nothing is late */
const SUSPEND_FRAMES = 128 * 24;

export type Variant = 'before' | 'after';
export const CORE_URL = '/worklets/synth-processors.js';
const A4_URL = '/worklets/analog-four-processors.js';

let legacyUrl: string | null = null;
/** URL of the shared DSP core for a variant ('before' = the original processors) */
export function coreUrl(v: Variant): string {
  if (v === 'after') return CORE_URL;
  if (!legacyUrl) legacyUrl = URL.createObjectURL(new Blob([LEGACY_SYNTH_PROCESSORS], { type: 'application/javascript' }));
  return legacyUrl;
}

// ----------------------------------------------------------------------------
// Virtual timers: setTimeout / setInterval on the audio clock
// ----------------------------------------------------------------------------

type TimerFn = (...args: unknown[]) => void;
interface Task { id: number; at: number; every: number; fn: TimerFn; args: unknown[] }
type TimerWindow = {
  setTimeout: (fn: TimerFn, ms?: number, ...args: unknown[]) => number;
  setInterval: (fn: TimerFn, ms?: number, ...args: unknown[]) => number;
  clearTimeout: (id?: number) => void;
  clearInterval: (id?: number) => void;
};

class VirtualTimers {
  now = 0; // ms of audio time
  errors: string[] = [];
  private tasks = new Map<number, Task>();
  private nextId = 1_000_000_000;
  private orig: TimerWindow | null = null;

  install() {
    const w = window as unknown as TimerWindow;
    this.orig = { setTimeout: w.setTimeout, setInterval: w.setInterval, clearTimeout: w.clearTimeout, clearInterval: w.clearInterval };
    const add = (fn: TimerFn, ms: number | undefined, every: boolean, args: unknown[]) => {
      const id = this.nextId++;
      const d = Math.max(0, Number(ms) || 0);
      this.tasks.set(id, { id, at: this.now + d, every: every ? Math.max(1, d) : 0, fn, args });
      return id;
    };
    const clear = (id?: number) => {
      if (id === undefined) return;
      if (!this.tasks.delete(id) && id < 1_000_000_000) this.orig?.clearTimeout.call(window, id);
    };
    w.setTimeout = (fn, ms, ...args) => add(fn, ms, false, args);
    w.setInterval = (fn, ms, ...args) => add(fn, ms, true, args);
    w.clearTimeout = clear;
    w.clearInterval = clear;
  }

  /** Run every task due up to `toMs`, in time order */
  advance(toMs: number) {
    for (let guard = 0; guard < 200000; guard++) {
      let best: Task | null = null;
      for (const t of this.tasks.values()) if (t.at <= toMs && (!best || t.at < best.at)) best = t;
      if (!best) break;
      this.now = best.at;
      if (best.every) best.at += best.every;
      else this.tasks.delete(best.id);
      try { best.fn(...best.args); } catch (e) { this.errors.push(String(e)); }
    }
    this.now = Math.max(this.now, toMs);
  }

  /** Restore the real timers; anything still pending moves onto them */
  uninstall() {
    if (!this.orig) return;
    const w = window as unknown as TimerWindow;
    w.setTimeout = this.orig.setTimeout;
    w.setInterval = this.orig.setInterval;
    w.clearTimeout = this.orig.clearTimeout;
    w.clearInterval = this.orig.clearInterval;
    this.tasks.forEach(t => {
      if (t.every) w.setInterval(t.fn, t.every, ...t.args);
      else w.setTimeout(t.fn, Math.max(0, t.at - this.now), ...t.args);
    });
    this.tasks.clear();
    this.orig = null;
  }
}

// ----------------------------------------------------------------------------
// Worklet-node counting (iPad budget: about 40 per instrument)
// ----------------------------------------------------------------------------

function countWorkletNodes(): { counts: Record<string, number>; restore: () => void } {
  const w = window as unknown as { AudioWorkletNode: typeof AudioWorkletNode };
  const Orig = w.AudioWorkletNode;
  const counts: Record<string, number> = {};
  class Counting extends Orig {
    constructor(ctx: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
      super(ctx, name, options);
      counts[name] = (counts[name] || 0) + 1;
    }
  }
  w.AudioWorkletNode = Counting;
  return { counts, restore: () => { w.AudioWorkletNode = Orig; } };
}

// ----------------------------------------------------------------------------
// Results
// ----------------------------------------------------------------------------

export interface DeviceRun {
  device: string;
  name: string;
  variant: Variant;
  ok: boolean;
  error?: string;
  demo: string;
  /** Best (lowest) wall-clock render time over the repetitions, ms */
  renderMs: number;
  /** Seconds of audio rendered per second of CPU */
  realtime: number;
  peak: number;
  rms: number;
  /** AudioWorklet nodes the engine created, by processor name */
  worklets: Record<string, number>;
  timerErrors: string[];
}

export interface ProcRun {
  id: string;
  label: string;
  processor: string;
  variant: Variant;
  instances: number;
  ok: boolean;
  error?: string;
  renderMs: number;
  baselineMs: number;
  /** Processor cost per instance: ns of CPU per audio sample */
  nsPerSample: number;
  /** Share of one CPU core one instance needs in real time at 48 kHz (%) */
  corePct: number;
  peak: number;
}

export interface BenchResults {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: string;
  sampleRate: number;
  seconds: number;
  userAgent: string;
  startedAt: string;
  finishedAt?: string;
  framework: { emptyMs: number; suspendMs: number; suspends: number };
  devices: DeviceRun[];
  processors: ProcRun[];
  errors: string[];
}

function stats(buf: AudioBuffer) {
  let peak = 0, sum = 0, cnt = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = d[i] < 0 ? -d[i] : d[i];
      if (a > peak) peak = a;
      sum += d[i] * d[i];
    }
    cnt += d.length;
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, cnt)) };
}

const pause = () => new Promise<void>(r => setTimeout(r, 0));

// ----------------------------------------------------------------------------
// Framework overhead
// ----------------------------------------------------------------------------

export async function measureFramework(): Promise<BenchResults['framework']> {
  let emptyMs = Infinity, suspendMs = Infinity, suspends = 0;
  for (let rep = 0; rep < 3; rep++) {
    for (const withSuspend of [false, true]) {
      const ctx = new OfflineAudioContext(2, FRAMES, SR);
      const src = ctx.createConstantSource();
      src.connect(ctx.destination);
      src.start();
      let n = 0;
      if (withSuspend) {
        for (let f = SUSPEND_FRAMES; f < FRAMES; f += SUSPEND_FRAMES) {
          ctx.suspend(f / SR).then(() => { n++; void ctx.resume(); });
        }
      }
      const t0 = performance.now();
      await ctx.startRendering();
      const ms = performance.now() - t0;
      if (withSuspend) { suspendMs = Math.min(suspendMs, ms); suspends = n; } else emptyMs = Math.min(emptyMs, ms);
      await pause();
    }
  }
  return { emptyMs, suspendMs, suspends };
}

// ----------------------------------------------------------------------------
// Devices
// ----------------------------------------------------------------------------

function defaults(mod: DeviceModule): Record<string, ControlValue> {
  const v: Record<string, ControlValue> = {};
  Object.entries(mod.spec.controls).forEach(([id, c]) => {
    const d = defaultOf(c);
    if (d !== undefined) v[id] = d;
  });
  return v;
}

/** Start the demo; returns its description */
function startDemo(engine: SynthEngine, mod: DeviceModule): string {
  if (mod.transportControl) {
    engine.setParam(mod.transportControl, true);
    return `${mod.transportControl} on`;
  }
  if (mod.keyboard) {
    // A riff on a 256 ms grid (a multiple of the suspend interval, so notes land on time)
    const root = mod.keyboard.lowNote + 12;
    const riff = [0, 7, 12, 7, 3, 10, 15, 10];
    const step = 256;
    for (let k = 0; k * step < SECONDS * 1000 - step; k++) {
      const note = root + riff[k % riff.length];
      const w = window as unknown as TimerWindow;
      w.setTimeout(() => engine.noteOn(note, 0.9), k * step);
      w.setTimeout(() => engine.noteOff(note), k * step + step * 0.75);
    }
    return 'keyboard riff';
  }
  engine.event('trigger');
  return 'trigger event';
}

async function renderDevice(mod: DeviceModule, variant: Variant) {
  const ctx = new OfflineAudioContext(2, FRAMES, SR);
  await ctx.audioWorklet.addModule(coreUrl(variant));
  for (const url of mod.worklets ?? []) await ctx.audioWorklet.addModule(url);
  const timers = new VirtualTimers();
  const counter = countWorkletNodes();
  timers.install();
  let engine: SynthEngine | null = null;
  try {
    engine = mod.createEngine();
    const vals = defaults(mod);
    for (const k in vals) engine.setParam(k, vals[k]);
    if (mod.data) engine.setData(mod.data.initial());
    engine.start(ctx as unknown as AudioContext, ctx.destination);
    counter.restore();
    const demo = startDemo(engine, mod);
    timers.advance(0);
    for (let f = SUSPEND_FRAMES; f < FRAMES; f += SUSPEND_FRAMES) {
      const t = f / SR;
      ctx.suspend(t).then(() => {
        timers.advance(t * 1000);
        void ctx.resume();
      });
    }
    const t0 = performance.now();
    const buf = await ctx.startRendering();
    const ms = performance.now() - t0;
    return { ms, buf, demo, worklets: { ...counter.counts }, timerErrors: timers.errors.slice(0, 5) };
  } finally {
    counter.restore();
    try { engine?.dispose(); } catch { /* ignore */ }
    timers.uninstall();
  }
}

export async function runDevice(entry: DeviceEntry, mod: DeviceModule, variant: Variant, reps = 3): Promise<DeviceRun> {
  const base: DeviceRun = {
    device: entry.id, name: `${entry.manufacturer} ${entry.name}`, variant, ok: false, demo: '',
    renderMs: 0, realtime: 0, peak: 0, rms: 0, worklets: {}, timerErrors: [],
  };
  try {
    let best = Infinity;
    for (let r = 0; r < reps; r++) {
      const res = await renderDevice(mod, variant);
      best = Math.min(best, res.ms);
      const s = stats(res.buf);
      Object.assign(base, { demo: res.demo, peak: s.peak, rms: s.rms, worklets: res.worklets, timerErrors: res.timerErrors });
      await pause();
    }
    base.ok = true;
    base.renderMs = best;
    base.realtime = (SECONDS * 1000) / best;
  } catch (e) {
    base.error = e instanceof Error ? e.message : String(e);
  }
  return base;
}

// ----------------------------------------------------------------------------
// Processors
// ----------------------------------------------------------------------------

type Build = (ctx: OfflineAudioContext, variant: Variant, real: boolean, sum: GainNode) => void;

export interface ProcScenario {
  id: string;
  label: string;
  processor: string;
  instances: number;
  /** 'after' only (the processor or option did not exist before) */
  afterOnly?: boolean;
  /** What 'before' runs instead, when it is not the same processor */
  beforeIs?: string;
  build: Build;
}

const worklet = (ctx: BaseAudioContext, name: string, opts: AudioWorkletNodeOptions) => new AudioWorkletNode(ctx, name, opts);
const p = (n: AudioWorkletNode, name: string) => n.parameters.get(name)!;

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.start();
  return o;
}
function gain(ctx: BaseAudioContext, g: number) {
  const n = ctx.createGain();
  n.gain.value = g;
  return n;
}
/** Placeholder for a processor in the baseline graph: passes the input through */
function stand(ctx: BaseAudioContext) { return gain(ctx, 1); }

const vcoScenario = (id: string, label: string, opts: {
  pitchMod?: boolean; fm?: boolean; sync?: boolean; mask?: number; subs?: boolean; afterOnly?: boolean;
}): ProcScenario => ({
  id, label, processor: 'vco', instances: 16, afterOnly: opts.afterOnly,
  build: (ctx, _variant, real, sum) => {
    const lfo = opts.pitchMod ? osc(ctx, 'triangle', 5) : null;
    const lfoAmt = lfo ? gain(ctx, 0.2) : null;
    if (lfo && lfoAmt) lfo.connect(lfoAmt);
    const mod = opts.fm ? osc(ctx, 'sine', 173) : null;
    const modAmt = mod ? gain(ctx, 300) : null;
    if (mod && modAmt) mod.connect(modAmt);
    const master = opts.sync && real ? worklet(ctx, 'vco', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [4], parameterData: { frequency: 97 } }) : null;
    for (let i = 0; i < 16; i++) {
      if (!real) {
        // baseline: the same modulation sources pulled through a gain
        const s = stand(ctx);
        if (lfoAmt) lfoAmt.connect(s);
        if (modAmt) modAmt.connect(s);
        s.connect(sum);
        continue;
      }
      const ch = opts.subs ? 6 : 4;
      const pd: Record<string, number> = { frequency: 55 * Math.pow(2, i / 5) };
      if (opts.mask !== undefined) pd.mask = opts.mask;
      if (opts.sync) pd.sync = 1;
      const init: AudioWorkletNodeOptions = { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [ch], parameterData: pd };
      if (opts.subs) init.processorOptions = { subs: true };
      const n = worklet(ctx, 'vco', init);
      if (lfoAmt) lfoAmt.connect(p(n, 'pitch'));
      if (modAmt) modAmt.connect(p(n, 'fm'));
      if (master) master.connect(n);
      n.connect(sum);
    }
    if (master) master.connect(gain(ctx, 0)).connect(sum);
  },
});

const filterScenario = (id: string, label: string, processor: 'ladder' | 'svf', opts: { mod?: boolean; quality?: number; afterOnly?: boolean }): ProcScenario => ({
  id, label, processor, instances: 16, afterOnly: opts.afterOnly,
  beforeIs: processor === 'svf' ? "Analog Four 'a4-svf'" : undefined,
  build: (ctx, variant, real, sum) => {
    const src = osc(ctx, 'sawtooth', 110);
    const lfo = opts.mod ? osc(ctx, 'sine', 3) : null;
    const lfoAmt = lfo ? gain(ctx, 2) : null;
    if (lfo && lfoAmt) lfo.connect(lfoAmt);
    const name = processor === 'svf' && variant === 'before' ? 'a4-svf' : processor;
    for (let i = 0; i < 16; i++) {
      if (!real) {
        const s = stand(ctx);
        src.connect(s);
        if (lfoAmt) lfoAmt.connect(s);
        s.connect(sum);
        continue;
      }
      const pd: Record<string, number> = { cutoff: 300 * Math.pow(2, i / 4), resonance: processor === 'svf' ? 0.6 : 0.7 };
      if (opts.quality) pd.quality = opts.quality;
      if (processor === 'svf') pd.mode = i % 7;
      const n = worklet(ctx, name, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], parameterData: pd });
      src.connect(n);
      if (lfoAmt) lfoAmt.connect(p(n, 'cutoffCv'));
      n.connect(sum);
    }
  },
});

const envScenario = (id: string, label: string, opts: { active: boolean; timeCv?: boolean }): ProcScenario => ({
  id, label, processor: 'env', instances: 32,
  build: (ctx, _variant, real, sum) => {
    const gate = opts.active ? osc(ctx, 'square', 8) : null;
    const cv = opts.timeCv ? osc(ctx, 'sine', 0.7) : null;
    const cvAmt = cv ? gain(ctx, 0.1) : null;
    if (cv && cvAmt) cv.connect(cvAmt);
    for (let i = 0; i < 32; i++) {
      if (!real) {
        const s = stand(ctx);
        if (gate) gate.connect(s);
        if (cvAmt) cvAmt.connect(s);
        s.connect(sum);
        continue;
      }
      const n = worklet(ctx, 'env', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], parameterData: { mode: 1, attack: 0.004, decay: 0.05, sustain: 0.5, release: 0.03 } });
      if (gate) gate.connect(n);
      if (cvAmt) cvAmt.connect(p(n, 'timeCv'));
      n.connect(sum);
    }
  },
});

/** A gated saw: bursts of 250 ms every 500 ms (so the reverb has tails and silences) */
function burst(ctx: BaseAudioContext) {
  const s = osc(ctx, 'sawtooth', 220);
  const g = gain(ctx, 0);
  for (let t = 0; t < SECONDS; t += 0.5) { g.gain.setValueAtTime(0.5, t); g.gain.setValueAtTime(0, t + 0.25); }
  s.connect(g);
  return g;
}

/** The old Reverb wrapper (predelay -> damping low-pass -> stereo convolver, 2.5 s IR) */
function convolverReverb(ctx: BaseAudioContext) {
  const pre = ctx.createDelay(0.5);
  pre.delayTime.value = 0.02;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 8000;
  const conv = ctx.createConvolver();
  const len = Math.floor(SR * 2.5);
  const ir = ctx.createBuffer(2, len, SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  conv.buffer = ir;
  pre.connect(damp).connect(conv);
  return { input: pre, output: conv };
}

/** A native-node stereo chorus like the Analog Four FX track (2 modulated delays) */
function nativeChorus(ctx: BaseAudioContext) {
  const input = gain(ctx, 1), out = gain(ctx, 1);
  const lfo = osc(ctx, 'sine', 0.6);
  const depth = gain(ctx, 0.002), inv = gain(ctx, -1);
  lfo.connect(depth);
  depth.connect(inv);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9000;
  for (let k = 0; k < 2; k++) {
    const d = ctx.createDelay(0.1);
    d.delayTime.value = 0.0035;
    const fb = gain(ctx, 0.1);
    const pan = ctx.createStereoPanner();
    pan.pan.value = k ? 0.8 : -0.8;
    input.connect(d);
    d.connect(fb).connect(d);
    d.connect(pan).connect(lp);
    (k ? inv : depth).connect(d.delayTime);
  }
  lp.connect(out);
  return { input, output: out };
}

export const SCENARIOS: ProcScenario[] = [
  vcoScenario('vco', 'VCO, 4 outputs, steady pitch', {}),
  vcoScenario('vco-pitchmod', 'VCO, pitch CV (a-rate LFO)', { pitchMod: true }),
  vcoScenario('vco-fm', 'VCO, audio-rate FM through zero', { fm: true }),
  vcoScenario('vco-sync', 'VCO, hard sync to a master', { sync: true }),
  vcoScenario('vco-mask', 'VCO, mask = pulse only', { mask: 4, afterOnly: true }),
  vcoScenario('vco-subs', 'VCO + 2 sub outputs (6 ch)', { subs: true, afterOnly: true }),
  filterScenario('ladder', 'Ladder 1x, steady cutoff', 'ladder', {}),
  filterScenario('ladder-mod', 'Ladder 1x, cutoff CV (a-rate)', 'ladder', { mod: true }),
  filterScenario('ladder-q1', 'Ladder 2x oversampled core', 'ladder', { quality: 1, afterOnly: true }),
  filterScenario('ladder-q1-mod', 'Ladder 2x, cutoff CV (a-rate)', 'ladder', { quality: 1, mod: true, afterOnly: true }),
  envScenario('env', 'Env ADSR, retriggered at 8 Hz', { active: true }),
  envScenario('env-timecv', 'Env ADSR, retriggered + time CV', { active: true, timeCv: true }),
  envScenario('env-idle', 'Env idle', { active: false }),
  filterScenario('svf', 'SVF, steady cutoff', 'svf', {}),
  filterScenario('svf-mod', 'SVF, cutoff CV (a-rate)', 'svf', { mod: true }),
  {
    id: 'reverb', label: 'Reverb, gated input', processor: 'fdn-reverb', instances: 4,
    beforeIs: 'Reverb (ConvolverNode, 2.5 s stereo IR)',
    build: (ctx, variant, real, sum) => {
      const src = burst(ctx);
      for (let i = 0; i < 4; i++) {
        if (!real) { const s = stand(ctx); src.connect(s); s.connect(sum); continue; }
        if (variant === 'before') {
          const r = convolverReverb(ctx);
          src.connect(r.input);
          r.output.connect(sum);
        } else {
          const n = worklet(ctx, 'fdn-reverb', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], parameterData: { decay: 2.5 } });
          src.connect(n);
          n.connect(sum);
        }
      }
    },
  },
  {
    id: 'chorus', label: 'Chorus, stereo', processor: 'chorus', instances: 8,
    beforeIs: 'native-node chorus (2 DelayNodes, LFO, panners)',
    build: (ctx, variant, real, sum) => {
      const src = osc(ctx, 'sawtooth', 220);
      for (let i = 0; i < 8; i++) {
        if (!real) { const s = stand(ctx); src.connect(s); s.connect(sum); continue; }
        if (variant === 'before') {
          const c = nativeChorus(ctx);
          src.connect(c.input);
          c.output.connect(sum);
        } else {
          const n = worklet(ctx, 'chorus', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
          src.connect(n);
          n.connect(sum);
        }
      }
    },
  },
];

async function renderScenario(s: ProcScenario, variant: Variant, real: boolean) {
  const ctx = new OfflineAudioContext(2, FRAMES, SR);
  await ctx.audioWorklet.addModule(coreUrl(variant));
  if (s.processor === 'svf' && variant === 'before') await ctx.audioWorklet.addModule(A4_URL);
  const sum = gain(ctx, 1 / s.instances);
  sum.connect(ctx.destination);
  s.build(ctx, variant, real, sum);
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return { ms: performance.now() - t0, buf };
}

export async function runScenario(s: ProcScenario, variant: Variant, reps = 3): Promise<ProcRun> {
  const run: ProcRun = {
    id: s.id, label: s.label, processor: variant === 'before' && s.beforeIs ? s.beforeIs : s.processor, variant,
    instances: s.instances, ok: false, renderMs: 0, baselineMs: 0, nsPerSample: 0, corePct: 0, peak: 0,
  };
  try {
    let best = Infinity, base = Infinity;
    for (let r = 0; r < reps; r++) {
      const a = await renderScenario(s, variant, true);
      best = Math.min(best, a.ms);
      run.peak = stats(a.buf).peak;
      await pause();
      const b = await renderScenario(s, variant, false);
      base = Math.min(base, b.ms);
      await pause();
    }
    const own = Math.max(0, best - base);
    run.ok = true;
    run.renderMs = best;
    run.baselineMs = base;
    run.nsPerSample = (own * 1e6) / (s.instances * FRAMES);
    run.corePct = (own / s.instances / (SECONDS * 1000)) * 100;
  } catch (e) {
    run.error = e instanceof Error ? e.message : String(e);
  }
  return run;
}
