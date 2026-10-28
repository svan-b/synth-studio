// ============================================================================
// Built-in plugins: two small plugins that ship with Synth Studio and follow
// the same contract the host uses for WAM 2 plugins (wam-midi and
// wam-transport events through scheduleEvents, getState / setState for the
// project, createGui / destroyGui for the plugin window). They load with no
// network and no third-party code, so plugin lessons work offline and on any
// school network.
//
//   Studio Mono  instrument: one oscillator, a low-pass filter with its own
//                envelope, glide. Follows CC 74 (cutoff) and CC 71 (resonance).
//   Studio Echo  effect: a tempo-synced delay with feedback and tone. With
//                "Sync to studio clock" it follows the studio tempo through
//                wam-transport events, like a hardware delay on MIDI clock.
// ============================================================================

import type { WamEvent, WamNode, WebAudioModule } from '@webaudiomodules/api';
import type { LoadedWam } from './host';

export const BUILTIN_MONO = 'builtin:studio-mono';
export const BUILTIN_ECHO = 'builtin:studio-echo';
export const isBuiltin = (url: string | null | undefined) => !!url && url.startsWith('builtin:');

type Listener = () => void;

interface ParamDef {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  log?: boolean;
  unit?: string;
  format?: (v: number) => string;
}

/** What both built-ins share: state, change listeners, a small GUI built from param defs */
abstract class Builtin<S extends Record<string, number | string | boolean>> {
  state: S;
  private listeners = new Set<Listener>();
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly isInstrument: boolean;
  protected abstract readonly params: ParamDef[];
  protected abstract readonly choices: { id: keyof S & string; label: string; options: { value: string; label: string }[] }[];

  constructor(protected ctx: BaseAudioContext, initial: S) {
    this.state = { ...initial };
  }

  set(patch: Partial<S>) {
    this.state = { ...this.state, ...patch };
    this.apply();
    this.listeners.forEach(l => l());
  }

  protected abstract apply(): void;
  abstract scheduleEvents(...events: WamEvent[]): void;
  abstract connectOut(dest: AudioNode): void;
  abstract get input(): AudioNode | undefined;
  abstract get output(): AudioNode;
  abstract destroy(): void;

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** The plugin's own window: plain HTML controls, 44 px touch targets */
  createGui(): HTMLElement {
    const root = document.createElement('div');
    root.style.cssText = 'font:13px system-ui,sans-serif;color:#ece8f7;padding:12px;min-width:300px;max-width:420px;background:linear-gradient(180deg,#2a2342,#191428);border-radius:8px';
    root.innerHTML = `<div style="font-weight:800;font-size:15px;letter-spacing:.5px">${this.name}</div><div style="font-size:11px;color:#a99fc4;margin:2px 0 10px">${this.description}</div>`;
    const sync: (() => void)[] = [];
    this.choices.forEach(c => {
      const row = document.createElement('div');
      row.style.cssText = 'margin:6px 0';
      row.innerHTML = `<div style="font-size:11px;color:#c9c2df;margin-bottom:4px">${c.label}</div>`;
      const group = document.createElement('div');
      group.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', c.label);
      c.options.forEach(o => {
        const b = document.createElement('button');
        b.textContent = o.label;
        b.setAttribute('role', 'radio');
        b.style.cssText = 'min-height:44px;min-width:56px;padding:0 10px;border-radius:6px;border:1px solid #4b4170;font-weight:700;cursor:pointer';
        b.onclick = () => this.set({ [c.id]: o.value } as Partial<S>);
        const upd = () => {
          const on = String(this.state[c.id]) === o.value;
          b.setAttribute('aria-checked', String(on));
          b.style.background = on ? '#a78bfa' : '#2a2440';
          b.style.color = on ? '#160f2a' : '#ece8f7';
        };
        sync.push(upd);
        upd();
        group.appendChild(b);
      });
      row.appendChild(group);
      root.appendChild(row);
    });
    this.params.forEach(p => {
      const row = document.createElement('label');
      row.style.cssText = 'display:block;margin:8px 0';
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;color:#c9c2df';
      const name = document.createElement('span');
      name.textContent = p.label;
      const val = document.createElement('span');
      val.style.cssText = 'font-family:ui-monospace,monospace;color:#ece8f7';
      head.append(name, val);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1000';
      input.setAttribute('aria-label', p.label);
      input.style.cssText = 'width:100%;height:36px;accent-color:#a78bfa';
      const toNorm = (v: number) => (p.log ? Math.log(v / p.min) / Math.log(p.max / p.min) : (v - p.min) / (p.max - p.min));
      const fromNorm = (n: number) => {
        let v = p.log ? p.min * Math.pow(p.max / p.min, n) : p.min + (p.max - p.min) * n;
        if (p.step) v = Math.round(v / p.step) * p.step;
        return v;
      };
      input.oninput = () => this.set({ [p.id]: fromNorm(Number(input.value) / 1000) } as Partial<S>);
      const upd = () => {
        const v = Number(this.state[p.id]);
        input.value = String(Math.round(toNorm(v) * 1000));
        val.textContent = p.format ? p.format(v) : `${Math.round(v * 100) / 100}${p.unit ?? ''}`;
      };
      sync.push(upd);
      upd();
      row.append(head, input);
      root.appendChild(row);
    });
    const off = this.subscribe(() => sync.forEach(f => f()));
    (root as HTMLElement & { __off?: () => void }).__off = off;
    return root;
  }

  destroyGui(gui: Element) {
    (gui as HTMLElement & { __off?: () => void }).__off?.();
  }
}

// ----------------------------------------------------------------------------
// Studio Mono
// ----------------------------------------------------------------------------

type MonoState = { wave: string; cutoff: number; resonance: number; envAmount: number; decay: number; glide: number; level: number };

class StudioMono extends Builtin<MonoState> {
  readonly name = 'Studio Mono';
  readonly description = 'Built-in instrument: one oscillator into a low-pass filter. CC 74 = cutoff, CC 71 = resonance.';
  readonly isInstrument = true;
  protected readonly params: ParamDef[] = [
    { id: 'cutoff', label: 'Cutoff', min: 60, max: 12000, log: true, format: v => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`) },
    { id: 'resonance', label: 'Resonance', min: 0, max: 20, unit: ' dB' },
    { id: 'envAmount', label: 'Filter envelope', min: 0, max: 1, format: v => `${Math.round(v * 100)}%` },
    { id: 'decay', label: 'Decay', min: 0.05, max: 2, log: true, format: v => `${Math.round(v * 1000)} ms` },
    { id: 'glide', label: 'Glide', min: 0, max: 0.5, format: v => `${Math.round(v * 1000)} ms` },
    { id: 'level', label: 'Level', min: 0, max: 1, format: v => `${Math.round(v * 100)}%` },
  ];
  protected readonly choices = [
    { id: 'wave' as const, label: 'Wave', options: [{ value: 'sawtooth', label: 'Saw' }, { value: 'square', label: 'Square' }, { value: 'triangle', label: 'Triangle' }] },
  ];
  private osc: OscillatorNode;
  private filter: BiquadFilterNode;
  private amp: GainNode;
  private out: GainNode;
  private keys: number[] = [];
  private vel = 1;

  constructor(ctx: BaseAudioContext, initial?: Partial<MonoState>) {
    super(ctx, { wave: 'sawtooth', cutoff: 900, resonance: 8, envAmount: 0.55, decay: 0.35, glide: 0, level: 0.8, ...initial });
    this.osc = ctx.createOscillator();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.out = ctx.createGain();
    this.osc.connect(this.filter).connect(this.amp).connect(this.out);
    this.osc.start();
    this.apply();
  }

  get input() { return undefined; }
  get output() { return this.out; }
  connectOut(dest: AudioNode) { this.out.connect(dest); }

  protected apply() {
    const t = this.ctx.currentTime;
    this.osc.type = (['sawtooth', 'square', 'triangle'].includes(this.state.wave) ? this.state.wave : 'sawtooth') as OscillatorType;
    this.filter.frequency.setTargetAtTime(this.state.cutoff, t, 0.01);
    this.filter.Q.setTargetAtTime(this.state.resonance, t, 0.01);
    this.out.gain.setTargetAtTime(this.state.level * 0.5, t, 0.01);
  }

  scheduleEvents(...events: WamEvent[]) {
    events.forEach(e => {
      if (e.type !== 'wam-midi') return;
      const [status, d1, d2] = (e.data as { bytes: number[] }).bytes;
      const t = Math.max(this.ctx.currentTime, e.time ?? 0);
      const kind = status & 0xf0;
      if (kind === 0x90 && d2 > 0) this.noteOn(d1, d2 / 127, t);
      else if (kind === 0x80 || (kind === 0x90 && d2 === 0)) this.noteOff(d1, t);
      else if (kind === 0xb0 && d1 === 74) this.set({ cutoff: 60 * Math.pow(200, d2 / 127) });
      else if (kind === 0xb0 && d1 === 71) this.set({ resonance: (d2 / 127) * 20 });
      else if (kind === 0xb0 && (d1 === 123 || d1 === 120)) { this.keys = []; this.release(t); }
    });
  }

  private noteOn(note: number, vel: number, t: number) {
    const legato = this.keys.length > 0;
    this.keys = this.keys.filter(k => k !== note).concat(note);
    const f = 440 * Math.pow(2, (note - 69) / 12);
    if (legato && this.state.glide > 0) this.osc.frequency.setTargetAtTime(f, t, this.state.glide / 3);
    else { this.osc.frequency.cancelScheduledValues(t); this.osc.frequency.setValueAtTime(f, t); }
    if (legato) return;
    this.vel = vel;
    const level = Math.pow(vel, 1.4);
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(level, t, 0.002);
    this.amp.gain.setTargetAtTime(level * 0.6, t + 0.01, this.state.decay / 3);
    const cents = this.state.envAmount * 4 * 1200;
    this.filter.detune.cancelScheduledValues(t);
    this.filter.detune.setTargetAtTime(cents, t, 0.002);
    this.filter.detune.setTargetAtTime(cents * 0.2, t + 0.01, this.state.decay / 3);
  }

  private noteOff(note: number, t: number) {
    const top = this.keys[this.keys.length - 1] === note;
    this.keys = this.keys.filter(k => k !== note);
    if (this.keys.length) {
      if (top) this.osc.frequency.setTargetAtTime(440 * Math.pow(2, (this.keys[this.keys.length - 1] - 69) / 12), t, Math.max(0.002, this.state.glide / 3));
      return;
    }
    this.release(t);
  }

  private release(t: number) {
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.06);
    this.filter.detune.cancelScheduledValues(t);
    this.filter.detune.setTargetAtTime(0, t, 0.06);
  }

  destroy() {
    try { this.osc.stop(); } catch { /* */ }
    this.osc.disconnect();
    this.out.disconnect();
  }
}

// ----------------------------------------------------------------------------
// Studio Echo
// ----------------------------------------------------------------------------

type EchoState = { division: string; sync: boolean; timeMs: number; feedback: number; tone: number; mix: number };

const DIVISIONS: Record<string, number> = { '1/4': 1, '3/16': 0.75, '1/8': 0.5, '1/16': 0.25 };

class StudioEcho extends Builtin<EchoState> {
  readonly name = 'Studio Echo';
  readonly description = 'Built-in effect: a delay whose repeats lock to the studio tempo. Patch a sound into IN.';
  readonly isInstrument = false;
  protected readonly params: ParamDef[] = [
    { id: 'feedback', label: 'Feedback (repeats)', min: 0, max: 0.9, format: v => `${Math.round(v * 100)}%` },
    { id: 'mix', label: 'Mix (dry / wet)', min: 0, max: 1, format: v => `${Math.round(v * 100)}% wet` },
    { id: 'tone', label: 'Tone', min: 800, max: 16000, log: true, format: v => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`) },
    { id: 'timeMs', label: 'Time when not synced', min: 40, max: 1500, log: true, format: v => `${Math.round(v)} ms` },
  ];
  protected readonly choices = [
    { id: 'division' as const, label: 'Delay time (synced to the studio tempo)', options: Object.keys(DIVISIONS).map(k => ({ value: k, label: k === '3/16' ? '1/8 dotted' : k })) },
  ];
  private inGain: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private delay: DelayNode;
  private fb: GainNode;
  private lp: BiquadFilterNode;
  private out: GainNode;
  private tempo = 120;
  private synced = false;

  constructor(ctx: BaseAudioContext, initial?: Partial<EchoState>) {
    super(ctx, { division: '3/16', sync: true, timeMs: 375, feedback: 0.42, tone: 5000, mix: 0.35, ...initial });
    this.inGain = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.delay = ctx.createDelay(2);
    this.fb = ctx.createGain();
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.out = ctx.createGain();
    this.inGain.connect(this.dry).connect(this.out);
    this.inGain.connect(this.delay);
    this.delay.connect(this.lp);
    this.lp.connect(this.fb).connect(this.delay);
    this.lp.connect(this.wet).connect(this.out);
    this.apply();
  }

  get input() { return this.inGain; }
  get output() { return this.out; }
  connectOut(dest: AudioNode) { this.out.connect(dest); }

  /** Seconds between repeats */
  delaySeconds() {
    if (this.state.sync && this.synced) return Math.min(2, (60 / this.tempo) * (DIVISIONS[this.state.division] ?? 0.75));
    return Math.min(2, this.state.timeMs / 1000);
  }

  protected apply() {
    const t = this.ctx.currentTime;
    this.delay.delayTime.setTargetAtTime(this.delaySeconds(), t, 0.05);
    this.fb.gain.setTargetAtTime(Math.min(0.9, this.state.feedback), t, 0.02);
    this.lp.frequency.setTargetAtTime(this.state.tone, t, 0.02);
    this.dry.gain.setTargetAtTime(1 - this.state.mix * 0.5, t, 0.02);
    this.wet.gain.setTargetAtTime(this.state.mix, t, 0.02);
  }

  scheduleEvents(...events: WamEvent[]) {
    events.forEach(e => {
      if (e.type !== 'wam-transport') return;
      const d = e.data as { tempo?: number };
      if (typeof d.tempo === 'number' && d.tempo > 0) {
        this.tempo = d.tempo;
        this.synced = true;
        this.apply();
      }
    });
  }

  destroy() {
    this.inGain.disconnect();
    this.out.disconnect();
    this.fb.disconnect();
  }
}

// ----------------------------------------------------------------------------
// As a "loaded plugin" for the host
// ----------------------------------------------------------------------------

export interface BuiltinInfo {
  url: string;
  name: string;
  kind: 'instrument' | 'effect';
  description: string;
}

export const BUILTINS: BuiltinInfo[] = [
  { url: BUILTIN_MONO, name: 'Studio Mono', kind: 'instrument', description: 'Built in, works offline: a simple mono synth with its own window' },
  { url: BUILTIN_ECHO, name: 'Studio Echo', kind: 'effect', description: 'Built in, works offline: a tempo-synced delay for anything you patch into IN' },
];

/** Create a built-in plugin with the same shape the host gets from loadWam() */
export function createBuiltin(url: string, ctx: BaseAudioContext, state?: unknown): LoadedWam {
  const saved = state && typeof state === 'object' ? (state as Record<string, never>) : undefined;
  const p: StudioMono | StudioEcho = url === BUILTIN_ECHO ? new StudioEcho(ctx, saved) : new StudioMono(ctx, saved);
  const node = {
    scheduleEvents: (...events: WamEvent[]) => p.scheduleEvents(...events),
    getState: async () => ({ ...p.state }),
    setState: async (s: unknown) => { if (s && typeof s === 'object') p.set(s as never); },
    disconnect: () => { try { p.output.disconnect(); } catch { /* */ } },
    connect: (dest: AudioNode) => p.connectOut(dest),
    destroy: () => p.destroy(),
    numberOfInputs: p.input ? 1 : 0,
  };
  const instance = {
    audioNode: node,
    name: p.name,
    vendor: 'Synth Studio',
    descriptor: { name: p.name, vendor: 'Synth Studio', description: p.description, isInstrument: p.isInstrument, hasAudioInput: !!p.input, hasMidiInput: p.isInstrument },
    createGui: async () => p.createGui(),
    destroyGui: (gui: Element) => p.destroyGui(gui),
  };
  return {
    url,
    instance: instance as unknown as WebAudioModule,
    node: node as unknown as WamNode,
    input: p.input,
    output: p.output,
    name: p.name,
    vendor: 'Synth Studio',
    description: p.description,
    isInstrument: p.isInstrument,
    hasAudioInput: !!p.input,
    hasMidiInput: p.isInstrument,
    builtin: true,
  };
}
