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
import { Chorus, Env, Ladder, Reverb, Reverb2, Svf, Vco, createNoise, type SvfMode } from '@/lib/audio/dsp';
import { LEGACY_SYNTH_PROCESSORS } from './legacy-processors';

export const SR = 48000;
export const SECONDS = 10;
const FRAMES = SR * SECONDS;
/**
 * Suspend every 24 render quanta (64 ms). Main-thread timers run at each suspend, and offline
 * rendering hands port messages to processors only while suspended (sometimes one suspend
 * later). Engines schedule 100-120 ms ahead, so events land on time or a few ms late at worst.
 */
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

export interface WrapperCheck {
  name: string;
  ok: boolean;
  detail: string;
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
  wrappers: WrapperCheck[];
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
    // Offline rendering only delivers port messages (envelope triggers...) while suspended,
    // so the demo starts at the first quantum boundary and timers run at every suspend.
    let demo = '';
    const eng = engine;
    ctx.suspend(128 / SR).then(() => {
      demo = startDemo(eng, mod);
      timers.advance((128 / SR) * 1000);
      void ctx.resume();
    });
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

/**
 * One instrument with the original core ('before') and the upgraded one ('after').
 * Repetitions alternate the order (before/after, after/before, ...) so load changes on
 * the machine hit both alike; each variant keeps its best render.
 */
export async function runDevicePair(entry: DeviceEntry, mod: DeviceModule, reps = 3): Promise<DeviceRun[]> {
  const variants: Variant[] = ['before', 'after'];
  const runs: DeviceRun[] = variants.map(variant => ({
    device: entry.id, name: `${entry.manufacturer} ${entry.name}`, variant, ok: false, demo: '',
    renderMs: 0, realtime: 0, peak: 0, rms: 0, worklets: {}, timerErrors: [],
  }));
  const best = [Infinity, Infinity];
  for (let r = 0; r < reps; r++) {
    for (const k of r % 2 === 0 ? [0, 1] : [1, 0]) {
      const run = runs[k];
      if (run.error) continue;
      try {
        const res = await renderDevice(mod, run.variant);
        best[k] = Math.min(best[k], res.ms);
        const s = stats(res.buf);
        // levels: the loudest repetition (oscillators start at random phases, like hardware)
        Object.assign(run, { demo: res.demo, peak: Math.max(run.peak, s.peak), rms: Math.max(run.rms, s.rms), worklets: res.worklets, timerErrors: res.timerErrors });
      } catch (e) {
        run.error = e instanceof Error ? e.message : String(e);
      }
      await pause();
    }
  }
  runs.forEach((run, k) => {
    if (run.error) return;
    run.ok = true;
    run.renderMs = best[k];
    run.realtime = (SECONDS * 1000) / best[k];
  });
  return runs;
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
      if (opts.sync) pd.sync = 1;
      const init: AudioWorkletNodeOptions = { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [ch], parameterData: pd };
      if (opts.subs || opts.mask !== undefined) init.processorOptions = { subs: !!opts.subs, mask: opts.mask };
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
      if (processor === 'svf') pd.mode = i % 7;
      const init: AudioWorkletNodeOptions = { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], parameterData: pd };
      if (opts.quality) init.processorOptions = { quality: opts.quality };
      const n = worklet(ctx, name, init);
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

/**
 * One scenario, before and after (or after only). Repetitions alternate the order
 * (before/after, after/before, ...) so load changes on the machine hit both alike.
 */
export async function runScenarioPair(s: ProcScenario, reps = 3): Promise<ProcRun[]> {
  const variants: Variant[] = s.afterOnly ? ['after'] : ['before', 'after'];
  const runs: ProcRun[] = variants.map(variant => ({
    id: s.id, label: s.label, processor: variant === 'before' && s.beforeIs ? s.beforeIs : s.processor, variant,
    instances: s.instances, ok: false, renderMs: 0, baselineMs: 0, nsPerSample: 0, corePct: 0, peak: 0,
  }));
  const best = runs.map(() => Infinity), base = runs.map(() => Infinity);
  for (let r = 0; r < reps; r++) {
    const order = r % 2 === 0 ? runs.map((_, k) => k) : runs.map((_, k) => runs.length - 1 - k);
    for (const k of order) {
      const run = runs[k];
      if (run.error) continue;
      try {
        const a = await renderScenario(s, run.variant, true);
        best[k] = Math.min(best[k], a.ms);
        run.peak = stats(a.buf).peak;
        await pause();
        const b = await renderScenario(s, run.variant, false);
        base[k] = Math.min(base[k], b.ms);
        await pause();
      } catch (e) {
        run.error = e instanceof Error ? e.message : String(e);
      }
    }
  }
  runs.forEach((run, k) => {
    if (run.error) return;
    const own = Math.max(0, best[k] - base[k]);
    run.ok = true;
    run.renderMs = best[k];
    run.baselineMs = base[k];
    run.nsPerSample = (own * 1e6) / (s.instances * FRAMES);
    run.corePct = (own / s.instances / (SECONDS * 1000)) * 100;
  });
  return runs;
}

// ----------------------------------------------------------------------------
// Wrapper self-checks (lib/audio/dsp.ts on the current core, in a real browser)
// ----------------------------------------------------------------------------

async function offline(seconds: number, channels: number, build: (ctx: OfflineAudioContext) => void) {
  const ctx = new OfflineAudioContext(channels, Math.round(SR * seconds), SR);
  await ctx.audioWorklet.addModule(CORE_URL);
  build(ctx);
  flushMessages(ctx);
  return ctx.startRendering();
}

/**
 * Offline rendering only hands port messages to processors while it is suspended (and a
 * message can wait for the next suspend). Messages posted before rendering - trigger(),
 * set(), useOutputs()... - therefore need a few early suspends to arrive in time.
 */
function flushMessages(ctx: OfflineAudioContext, quanta = 3) {
  for (let q = 1; q <= quanta; q++) ctx.suspend((q * 128) / SR).then(() => { void ctx.resume(); });
}

/** Route each node to its own output channel */
function toChannels(ctx: OfflineAudioContext, nodes: AudioNode[]) {
  const m = ctx.createChannelMerger(nodes.length);
  nodes.forEach((n, i) => n.connect(m, 0, i));
  m.connect(ctx.destination);
}

function rmsOf(d: Float32Array, from = 0, to = d.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += d[i] * d[i];
  return Math.sqrt(s / Math.max(1, to - from));
}

/** Rising zero crossings per second between two sample indices */
function zcRate(d: Float32Array, from: number, to: number) {
  let n = 0;
  for (let i = from + 1; i < to; i++) if (d[i - 1] < 0 && d[i] >= 0) n++;
  return (n * SR) / (to - from);
}

const db = (x: number) => 20 * Math.log10(Math.max(1e-12, x));

export async function runWrapperChecks(): Promise<WrapperCheck[]> {
  const out: WrapperCheck[] = [];
  const check = async (name: string, fn: () => Promise<[boolean, string]>) => {
    try {
      const [ok, detail] = await fn();
      out.push({ name, ok, detail });
    } catch (e) {
      out.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  };

  await check('Vco: default 4 outputs', async () => {
    let hasSubs = true;
    const b = await offline(1, 4, ctx => {
      const v = new Vco(ctx, 220);
      hasSubs = v.sub1 !== null || v.sub2 !== null;
      toChannels(ctx, [v.tri, v.saw, v.pulse, v.sine]);
    });
    const r = [0, 1, 2, 3].map(c => rmsOf(b.getChannelData(c), 1000));
    return [!hasSubs && r.every(x => x > 0.5 && x < 1.05), `rms tri/saw/pulse/sine ${r.map(x => x.toFixed(3)).join(' / ')}, sub taps ${hasSubs ? 'present' : 'null'}`];
  });

  await check('Vco: { subs: true } -> sub1 f/2, sub2 f/4', async () => {
    const b = await offline(1, 2, ctx => {
      const v = new Vco(ctx, 400, { subs: true });
      toChannels(ctx, [v.sub1!, v.sub2!]);
    });
    const f1 = zcRate(b.getChannelData(0), 2000, SR), f2 = zcRate(b.getChannelData(1), 2000, SR);
    return [Math.abs(f1 - 200) < 3 && Math.abs(f2 - 100) < 3, `sub1 ${f1.toFixed(1)} Hz, sub2 ${f2.toFixed(1)} Hz (VCO 400 Hz)`];
  });

  await check("Vco: useOutputs('pulse') silences the rest", async () => {
    const b = await offline(0.5, 2, ctx => {
      const v = new Vco(ctx, 220);
      v.useOutputs('pulse');
      toChannels(ctx, [v.tri, v.pulse]);
    });
    const t = rmsOf(b.getChannelData(0), 512), p = rmsOf(b.getChannelData(1), 512);
    return [t === 0 && p > 0.9, `tri rms ${t.toFixed(4)}, pulse rms ${p.toFixed(3)}`];
  });

  await check('Vco: fmRatio through-zero (fm = -2 runs the saw backwards)', async () => {
    const b = await offline(0.5, 1, ctx => {
      const v = new Vco(ctx, 300, { fmRatio: true });
      const c = ctx.createConstantSource();
      c.offset.value = -2;
      c.connect(v.fm);
      c.start();
      v.saw.connect(ctx.destination);
    });
    const d = b.getChannelData(0);
    let up = 0, down = 0;
    for (let i = 1000; i < d.length; i++) { if (d[i] > d[i - 1]) up++; else down++; }
    return [down > up * 5, `falling ${down} / rising ${up} samples`];
  });

  await check('Vco: drift + tolerance (seeded)', async () => {
    const b = await offline(4, 1, ctx => {
      const v = new Vco(ctx, 500, { drift: 20, driftRate: 1, tolerance: 10, seed: 3 });
      v.sine.connect(ctx.destination);
    });
    const d = b.getChannelData(0);
    const f: number[] = [];
    for (let s = 0; s + SR / 2 <= d.length; s += SR / 2) f.push(zcRate(d, s, s + SR / 2));
    const lo = Math.min(...f), hi = Math.max(...f);
    return [hi - lo > 1 && hi - lo < 40 && f.every(Number.isFinite), `frequency per 0.5 s: ${lo.toFixed(1)}..${hi.toFixed(1)} Hz`];
  });

  await check('Ladder: { quality: 1 } level matches quality 0', async () => {
    const b = await offline(1, 2, ctx => {
      const s = ctx.createOscillator();
      s.type = 'sawtooth';
      s.frequency.value = 110;
      s.start();
      const a = new Ladder(ctx, 2000), q = new Ladder(ctx, 2000, { quality: 1 });
      a.resonance.value = 0.5;
      q.resonance.value = 0.5;
      s.connect(a.input);
      s.connect(q.input);
      toChannels(ctx, [a.output, q.output]);
    });
    const r0 = rmsOf(b.getChannelData(0), 4800), r1 = rmsOf(b.getChannelData(1), 4800);
    return [Math.abs(db(r1 / r0)) < 1 && r0 > 0.05, `rms q0 ${r0.toFixed(3)}, q1 ${r1.toFixed(3)} (${db(r1 / r0).toFixed(2)} dB)`];
  });

  await check('Env: { delay, hold } options (DAHDSR)', async () => {
    const b = await offline(0.6, 1, ctx => {
      const e = new Env(ctx, 'ad', { delay: 0.1, hold: 0.05 });
      e.attack.value = 0.001;
      e.decay.value = 0.1;
      e.trigger(0.05, 1);
      e.output.connect(ctx.destination);
    });
    const d = b.getChannelData(0);
    const start = d.findIndex(v => v > 0) / SR;
    let hold = 0;
    for (let i = 0; i < d.length; i++) if (d[i] >= 0.9999) hold++;
    return [Math.abs(start - 0.15) < 0.003 && Math.abs(hold / SR - 0.05) < 0.003, `starts at ${(start * 1000).toFixed(1)} ms (expect 150), holds ${((hold / SR) * 1000).toFixed(1)} ms (expect 50)`];
  });

  await check('Env: set({ shape }, time) applies at that time', async () => {
    const b = await offline(1, 1, ctx => {
      const e = new Env(ctx, 'ad');
      e.attack.value = 0.1;
      e.decay.value = 0.05;
      e.trigger(0.1, 1);
      e.set({ shape: -1 }, 0.5);
      e.trigger(0.6, 1);
      e.output.connect(ctx.destination);
    });
    const d = b.getChannelData(0);
    const a = d[Math.round(0.15 * SR)], c = d[Math.round(0.65 * SR)];
    return [a > 0.45 && c < 0.2, `level half-way through the attack: before ${a.toFixed(3)} (linear), after ${c.toFixed(3)} (concave)`];
  });

  await check('Svf: all 7 modes', async () => {
    const modes: SvfMode[] = ['lp2', 'lp1', 'bp', 'hp1', 'hp2', 'notch', 'peak'];
    const b = await offline(0.5, 7, ctx => {
      const n = createNoise(ctx);
      const f = modes.map(m => {
        const s = new Svf(ctx, 1000, m);
        s.resonance.value = 0.5;
        n.connect(s.input);
        return s.output;
      });
      toChannels(ctx, f);
    });
    const r = modes.map((_, i) => rmsOf(b.getChannelData(i), 2000));
    return [r.every(x => x > 0.02 && Number.isFinite(x)), modes.map((m, i) => `${m} ${r[i].toFixed(3)}`).join(', ')];
  });

  await check('Reverb2: level vs the old Reverb (same input)', async () => {
    const b = await offline(4, 4, ctx => {
      const n = createNoise(ctx);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, 0);
      g.gain.setValueAtTime(0, 0.5);
      n.connect(g);
      const r1 = new Reverb(ctx, 2.5), r2 = new Reverb2(ctx, 2.5, { seed: 1 });
      g.connect(r1.input);
      g.connect(r2.input);
      const s1 = ctx.createChannelSplitter(2), s2 = ctx.createChannelSplitter(2);
      r1.output.connect(s1);
      r2.output.connect(s2);
      const m = ctx.createChannelMerger(4);
      s1.connect(m, 0, 0); s1.connect(m, 1, 1); s2.connect(m, 0, 2); s2.connect(m, 1, 3);
      m.connect(ctx.destination);
    });
    const o = rmsOf(b.getChannelData(0)) + rmsOf(b.getChannelData(1));
    const n = rmsOf(b.getChannelData(2)) + rmsOf(b.getChannelData(3));
    const diff = db(n / o);
    return [Math.abs(diff) < 3, `Reverb2 is ${diff >= 0 ? '+' : ''}${diff.toFixed(1)} dB vs Reverb`];
  });

  await check('Chorus: stereo, wet/dry', async () => {
    const b = await offline(1, 2, ctx => {
      const s = ctx.createOscillator();
      s.type = 'sawtooth';
      s.frequency.value = 220;
      s.start();
      const c = new Chorus(ctx);
      c.dry.value = 1;
      c.wet.value = 0.7;
      s.connect(c.input);
      c.output.connect(ctx.destination);
    });
    const l = b.getChannelData(0), r = b.getChannelData(1);
    let x = 0, ll = 0, rr = 0;
    for (let i = 4800; i < l.length; i++) { x += l[i] * r[i]; ll += l[i] * l[i]; rr += r[i] * r[i]; }
    const corr = x / Math.sqrt(ll * rr);
    return [corr < 0.98 && rmsOf(l) > 0.2, `L/R correlation ${corr.toFixed(3)}, rms ${rmsOf(l).toFixed(3)}`];
  });

  return out;
}
