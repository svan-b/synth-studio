// ============================================================================
// Synth engine framework
//
// Every instrument extends BaseEngine. It builds a Web Audio graph in build(),
// reacts to control changes in onParam(), and declares its patch points:
//
//   this.outputs[jackId] = { node?, event? }
//   this.inputs[jackId]  = { params?, node?, scale?, onEvent?, onConnect?, onDisconnect? }
//
// The base class does the patching. A cable from an output with a `node` to an
// input with `params`/`node` becomes a real audio connection through a gain of
// `scale` (so CV is audio-rate, exactly like the hardware). A cable between an
// output `event` bus and an input `onEvent` handler routes trigger/clock events.
// onConnect/onDisconnect let an input break and restore its internal normal.
//
// Signal convention: 1.0 = 5 V. Inputs convert with `scale`
// (e.g. a 1V/oct pitch input into a VCO 'pitch' param in octaves uses scale 5).
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import type { EngineState } from '@/types/panel';
import type { Transport } from './transport';

export type EventHandler = (time: number, value: number) => void;

/** A trigger / gate / clock source that can be patched to event inputs */
export class EventBus {
  private handlers = new Set<EventHandler>();
  on(h: EventHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(time: number, value = 1): void {
    this.handlers.forEach(h => h(time, value));
  }
}

export interface OutputJack {
  node?: AudioNode;
  event?: EventBus;
}

export interface InputJack {
  params?: AudioParam[];
  node?: AudioNode;
  /** Gain applied between the source and the destination (unit conversion) */
  scale?: number;
  onEvent?: EventHandler;
  /** Called when the first cable is inserted (break the normal) */
  onConnect?: () => void;
  /** Called when the last cable is removed (restore the normal) */
  onDisconnect?: () => void;
}

export interface SynthEngine {
  start(ctx: AudioContext, destination: AudioNode | null): void;
  setParam(id: string, value: ControlValue): void;
  setPatches(connections: PatchConnection[]): void;
  /** Momentary UI events: buttons with `event`, pads, transport */
  event(name: string, payload?: unknown): void;
  noteOn(note: number, velocity?: number): void;
  noteOff(note: number): void;
  subscribe(listener: (state: EngineState) => void): () => void;
  getState(): EngineState;
  dispose(): void;

  // ---- v2: studio integration ---------------------------------------------
  /** A patch point other instruments can take a cable from */
  getOutput(jackId: string): OutputJack | undefined;
  /** Connect another instrument's output into one of our inputs. Returns a teardown, or null if incompatible. */
  connectExternal(inputId: string, source: OutputJack): (() => void) | null;
  /** The instrument's main audio output (what the studio routes to the mixer or master) */
  getMainOutput(): AudioNode;
  /** Re-route the main output (null = disconnected) */
  setDestination(node: AudioNode | null): void;
  /** Follow the studio transport like MIDI clock (null = run on the internal clock) */
  followTransport(transport: Transport | null): void;
  /** Structured device data (patterns, songs...) - see DeviceModule.data */
  setData(data: unknown): void;
}

interface ActiveCable {
  key: string;
  inputId: string;
  teardown: () => void;
}

export abstract class BaseEngine implements SynthEngine {
  protected ctx!: AudioContext;
  /** Final output of the instrument - connect your last stage here */
  protected out!: GainNode;
  protected params: Record<string, ControlValue> = {};
  protected outputs: Record<string, OutputJack> = {};
  protected inputs: Record<string, InputJack> = {};
  protected started = false;

  private cables = new Map<string, ActiveCable>();
  private inputCounts: Record<string, number> = {};
  private pendingPatches: PatchConnection[] = [];
  private listeners = new Set<(s: EngineState) => void>();
  private state: EngineState = {};
  private disposers: (() => void)[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private destination: AudioNode | null = null;
  /** Studio transport when following it (MIDI-clock style), else null */
  protected transport: Transport | null = null;
  /** Latest structured device data (DeviceModule.data) */
  protected data: unknown = undefined;

  /** Build the audio graph. this.ctx and this.out are ready. */
  protected abstract build(): void;
  /** React to a control change. Called for every param once after build(). */
  protected abstract onParam(id: string, value: ControlValue): void;

  start(ctx: AudioContext, destination: AudioNode | null): void {
    if (this.started) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.destination = destination;
    if (destination) this.out.connect(destination);
    this.build();
    this.started = true;
    Object.entries(this.params).forEach(([id, v]) => this.onParam(id, v));
    this.setPatches(this.pendingPatches);
    if (this.data !== undefined) this.onData(this.data);
    if (this.transport) this.onTransport(this.transport);
  }

  getMainOutput(): AudioNode {
    return this.out;
  }

  setDestination(node: AudioNode | null): void {
    if (node === this.destination) return;
    if (this.out && this.destination) {
      try { this.out.disconnect(this.destination); } catch { /* not connected */ }
    }
    this.destination = node;
    if (this.out && node) this.out.connect(node);
  }

  followTransport(transport: Transport | null): void {
    if (transport === this.transport) return;
    this.transport = transport;
    if (this.started) this.onTransport(transport);
  }

  /** Override to react to transport follow on/off (subscribe to transport.onTick / onEvent) */
  protected onTransport(_transport: Transport | null): void {}

  setData(data: unknown): void {
    if (data === this.data) return;
    this.data = data;
    if (this.started) this.onData(data);
  }

  /** Override to react to new device data (patterns, songs...) */
  protected onData(_data: unknown): void {}

  getOutput(jackId: string): OutputJack | undefined {
    return this.outputs[jackId];
  }

  connectExternal(inputId: string, source: OutputJack): (() => void) | null {
    if (!this.started) return null;
    const i = this.inputs[inputId];
    if (!i) return null;
    const teardown = this.link(source, i);
    if (!teardown) return null;
    this.inputCounts[inputId] = (this.inputCounts[inputId] || 0) + 1;
    if (this.inputCounts[inputId] === 1) i.onConnect?.();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      teardown();
      this.inputCounts[inputId] = (this.inputCounts[inputId] || 1) - 1;
      if (this.inputCounts[inputId] === 0) i.onDisconnect?.();
    };
  }

  setParam(id: string, value: ControlValue): void {
    const prev = this.params[id];
    this.params[id] = value;
    if (this.started && prev !== value) this.onParam(id, value);
  }

  /** Numeric param with fallback */
  protected num(id: string, fallback = 0): number {
    const v = this.params[id];
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return fallback;
  }

  protected bool(id: string): boolean {
    return !!this.params[id];
  }

  protected str(id: string, fallback = ''): string {
    const v = this.params[id];
    return typeof v === 'string' ? v : fallback;
  }

  event(_name: string, _payload?: unknown): void {}
  noteOn(_note: number, _velocity = 1): void {}
  noteOff(_note: number): void {}

  // --------------------------------------------------------------------------
  // Patching
  // --------------------------------------------------------------------------

  setPatches(connections: PatchConnection[]): void {
    this.pendingPatches = connections;
    if (!this.started) return;
    const wanted = new Map<string, { out: string; inp: string }>();
    connections.forEach(c => {
      const resolved = this.resolve(c.from, c.to);
      if (resolved) wanted.set(`${resolved.out}>${resolved.inp}`, resolved);
    });
    // Remove cables no longer present
    this.cables.forEach((cable, key) => {
      if (!wanted.has(key)) {
        cable.teardown();
        this.cables.delete(key);
        this.inputCounts[cable.inputId] = (this.inputCounts[cable.inputId] || 1) - 1;
        if (this.inputCounts[cable.inputId] === 0) this.inputs[cable.inputId]?.onDisconnect?.();
      }
    });
    // Add new cables
    wanted.forEach((w, key) => {
      if (this.cables.has(key)) return;
      const teardown = this.connectCable(w.out, w.inp);
      if (!teardown) return;
      this.cables.set(key, { key, inputId: w.inp, teardown });
      this.inputCounts[w.inp] = (this.inputCounts[w.inp] || 0) + 1;
      if (this.inputCounts[w.inp] === 1) this.inputs[w.inp]?.onConnect?.();
    });
  }

  /** Is anything patched into this input? */
  protected isPatched(inputId: string): boolean {
    return (this.inputCounts[inputId] || 0) > 0;
  }

  private resolve(a: string, b: string): { out: string; inp: string } | null {
    if (this.outputs[a] && this.inputs[b]) return { out: a, inp: b };
    if (this.outputs[b] && this.inputs[a]) return { out: b, inp: a };
    return null;
  }

  private connectCable(outId: string, inId: string): (() => void) | null {
    return this.link(this.outputs[outId], this.inputs[inId]);
  }

  /** Wire an output to an input (audio-rate CV/audio and/or events) */
  private link(o: OutputJack, i: InputJack): (() => void) | null {
    const teardowns: (() => void)[] = [];

    if (o.node && ((i.params && i.params.length) || i.node)) {
      const g = this.ctx.createGain();
      g.gain.value = i.scale ?? 1;
      o.node.connect(g);
      i.params?.forEach(p => g.connect(p));
      if (i.node) g.connect(i.node);
      teardowns.push(() => {
        try { o.node!.disconnect(g); } catch { /* already gone */ }
        g.disconnect();
      });
    }
    if (o.event && i.onEvent) {
      teardowns.push(o.event.on(i.onEvent));
    }
    if (!teardowns.length) return null;
    return () => teardowns.forEach(t => t());
  }

  // --------------------------------------------------------------------------
  // State for the UI
  // --------------------------------------------------------------------------

  subscribe(listener: (s: EngineState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): EngineState {
    return this.state;
  }

  protected emit(partial: EngineState): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(l => l(this.state));
  }

  /** Emit UI state when the audio clock reaches `time` (keeps LEDs in sync with sound) */
  protected emitAt(time: number, partial: EngineState): void {
    this.atTime(time, () => this.emit(partial));
  }

  /** Run a main-thread callback when the audio clock reaches `time` */
  protected atTime(time: number, fn: () => void): void {
    const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, delay);
    this.timers.add(t);
  }

  /** Register cleanup (stop sources, clear intervals) */
  protected onDispose(fn: () => void): void {
    this.disposers.push(fn);
  }

  dispose(): void {
    this.cables.forEach(c => c.teardown());
    this.cables.clear();
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
    this.disposers.forEach(d => {
      try { d(); } catch { /* ignore */ }
    });
    this.disposers = [];
    if (this.out) {
      const now = this.ctx.currentTime;
      this.out.gain.setTargetAtTime(0, now, 0.01);
      const o = this.out;
      setTimeout(() => o.disconnect(), 60);
    }
    this.listeners.clear();
    this.started = false;
  }
}

// ============================================================================
// Clock - look-ahead scheduler (timing from the audio clock, not setInterval)
// ============================================================================

export class Clock {
  /**
   * Minimum look-ahead for every Clock, seconds (0 = each clock's own). The studio raises
   * it while the page is hidden: WebKit runs hidden pages' timers only once a second.
   */
  static minLookahead = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private tick = 0;
  private interval: number;
  running = false;

  constructor(
    private ctx: AudioContext,
    private onTick: (time: number, tick: number) => void,
    intervalSeconds = 0.5,
    private lookahead = 0.12,
  ) {
    this.interval = intervalSeconds;
  }

  /** Seconds between ticks */
  setInterval(seconds: number): void {
    this.interval = Math.max(0.001, seconds);
  }

  getInterval(): number {
    return this.interval;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tick = 0;
    this.nextTime = this.ctx.currentTime + 0.03;
    this.timer = setInterval(() => this.schedule(), 20);
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const horizon = this.ctx.currentTime + Math.max(this.lookahead, Clock.minLookahead);
    // If the tab was throttled, skip ahead instead of firing a burst of old ticks
    if (this.nextTime < this.ctx.currentTime - 0.25) this.nextTime = this.ctx.currentTime + 0.01;
    let guard = 0;
    while (this.nextTime < horizon && guard++ < 512) {
      this.onTick(this.nextTime, this.tick++);
      this.nextTime += this.interval;
    }
  }
}

// ============================================================================
// CvReader - lets main-thread logic (clocks, sequencers) read a patched CV
// ============================================================================

export class CvReader {
  readonly input: AnalyserNode;
  private buf: Float32Array<ArrayBuffer>;

  constructor(ctx: AudioContext) {
    this.input = ctx.createAnalyser();
    this.input.fftSize = 256;
    this.buf = new Float32Array(this.input.fftSize);
  }

  /** Latest sample (most recent render quantum) */
  read(): number {
    this.input.getFloatTimeDomainData(this.buf);
    return this.buf[this.buf.length - 1];
  }
}
