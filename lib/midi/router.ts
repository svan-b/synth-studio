// ============================================================================
// MIDI input router: plays the studio from MIDI keyboards and controllers.
//
//   notes        -> the focused instrument (or the instance chosen for that input),
//                   through the same path as the on-screen keys; a note-off always
//                   goes where its note-on went, so changing focus never hangs notes
//   pitch bend   -> a `pitch_bend` control (Sub 37 wheel), scaled by its spec
//   mod wheel    -> a `mod_wheel` control (CC 1), unless CC 1 is MIDI-learned
//   learned CCs  -> their instance + control, through lib/controls/mapping normToValue
//   MIDI-aware devices (Your synth, Web Audio plugin) also get everything else
//   raw (bend, CCs, aftertouch) via receiveMidi()
//   MIDI learn   -> armed + a touched control + a CC = a new mapping
// ============================================================================

import type { ControlSpec, ControlValue } from '@/types';
import { normToValue } from '@/lib/controls/mapping';
import { parseMidi, type MidiMessage } from './bytes';
import type { MidiMapping, MidiSettingsState, LearnTarget } from '@/store/midi';

/** Engines that take raw MIDI (devices built around MIDI) */
export interface MidiReceiver {
  receiveMidi(data: number[] | Uint8Array, timeStamp?: number): void;
  /**
   * Echo guard: true when messages from this input port must not reach the
   * device - e.g. "Your synth" sending to the same hardware the notes came
   * from, which would play every note twice (local control + MIDI).
   */
  ignoresInput?(portName: string): boolean;
}

export const isMidiReceiver = (x: unknown): x is MidiReceiver =>
  !!x && typeof (x as Partial<MidiReceiver>).receiveMidi === 'function';

/** The focused DeviceHost plays MIDI notes through its own handlers (keys light up) */
export interface FocusSink {
  instance: string;
  noteOn: (note: number, velocity: number) => void;
  noteOff: (note: number) => void;
}

export interface RouterDeps {
  settings: () => Pick<MidiSettingsState, 'inputChannel' | 'inputTargets' | 'mappings'>;
  noteOn: (instance: string, note: number, velocity: number) => void;
  noteOff: (instance: string, note: number) => void;
  /** The instance's engine when it takes raw MIDI */
  receiver: (instance: string) => MidiReceiver | null;
  spec: (instance: string, control: string) => ControlSpec | undefined;
  value: (instance: string, control: string) => ControlValue | undefined;
  /** Write a control value (batched by the caller) */
  apply: (instance: string, control: string, value: ControlValue) => void;
  inRack: (instance: string) => boolean;
  /** Focus when no DeviceHost holds it (studio view): the store's current instrument */
  fallbackFocus: () => string | null;
  learn: () => { armed: boolean; target: LearnTarget | null };
  addMapping: (m: Omit<MidiMapping, 'id' | 'createdAt'>) => MidiMapping;
  onLearned?: (m: MidiMapping) => void;
}

/** Control ids that wheels drive, in order of preference */
export const BEND_CONTROLS = ['pitch_bend', 'pitchbend', 'pitch_wheel', 'bend'];
export const MOD_CONTROLS = ['mod_wheel', 'modwheel', 'mod_wheel_amt'];

/** CCs that are part of protocols (bank select, NRPN/RPN, data entry, channel mode) - never learned */
const UNLEARNABLE = new Set([0, 6, 32, 38, 96, 97, 98, 99, 100, 101, 120, 121, 122, 123, 124, 125, 126, 127]);

const isContinuous = (s: ControlSpec | undefined): s is Extract<ControlSpec, { type: 'knob' | 'slider' }> =>
  !!s && (s.type === 'knob' || s.type === 'slider');

/** A CC value (0..127) as a control value, scaled through the control's own mapping */
export function ccToValue(spec: ControlSpec | undefined, cc: number): ControlValue | undefined {
  if (!spec) return undefined;
  const norm = Math.max(0, Math.min(127, cc)) / 127;
  switch (spec.type) {
    case 'knob':
    case 'slider': return normToValue(spec, norm);
    case 'switch': return Math.round(norm * (spec.options.length - 1));
    case 'button': return cc >= 64;
    default: return undefined;
  }
}

export class MidiRouter {
  private focus: FocusSink[] = [];
  /** `${port}|${channel}|${note}` -> where its note-on went */
  private active = new Map<string, { instance: string; sink: FocusSink | null }>();
  /** Last CC per mapping (toggle buttons flip on the rising edge) */
  private lastCc = new Map<string, number>();

  constructor(private deps: RouterDeps) {}

  /** The focused DeviceHost registers itself; returns a release function */
  pushFocus(sink: FocusSink): () => void {
    this.focus.push(sink);
    return () => {
      const i = this.focus.lastIndexOf(sink);
      if (i >= 0) this.focus.splice(i, 1);
      // Release notes the departing view was holding - its handlers are going away
      this.active.forEach((a, key) => {
        if (a.sink === sink) {
          this.deps.noteOff(a.instance, Number(key.split('|')[2]));
          this.active.delete(key);
        }
      });
    };
  }

  focusedInstance(): string | null {
    const top = this.focus[this.focus.length - 1];
    if (top && this.deps.inRack(top.instance)) return top.instance;
    const f = this.deps.fallbackFocus();
    return f && this.deps.inRack(f) ? f : null;
  }

  /** Target instance for an input port */
  targetFor(portName: string): string | null {
    const t = this.deps.settings().inputTargets[portName];
    if (t && t !== 'focused' && this.deps.inRack(t)) return t;
    return this.focusedInstance();
  }

  /** Entry point: one raw message from an enabled input */
  handle(portName: string, data: ArrayLike<number>, timeStamp = 0): MidiMessage | null {
    const msg = parseMidi(data);
    if (!msg) return null;
    if (!('channel' in msg)) return msg; // realtime: the clock follower handles it
    const s = this.deps.settings();
    if (s.inputChannel !== 'omni' && msg.channel !== s.inputChannel) return msg;

    switch (msg.type) {
      case 'noteon': this.noteOn(portName, msg.channel, msg.note, msg.velocity); break;
      case 'noteoff': this.noteOff(portName, msg.channel, msg.note); break;
      case 'cc': this.cc(portName, msg.channel, msg.cc, msg.value, data, timeStamp); break;
      case 'pitchbend': this.bend(portName, msg.value, data, timeStamp); break;
      default: {
        const target = this.targetFor(portName);
        if (target) this.receiverFor(target, portName)?.receiveMidi(Array.from(data), timeStamp);
      }
    }
    return msg;
  }

  /** The target's raw-MIDI receiver, unless it refuses this port (echo guard) */
  private receiverFor(instance: string, port: string): MidiReceiver | null {
    const r = this.deps.receiver(instance);
    return r && !r.ignoresInput?.(port) ? r : null;
  }

  /** Echo guard for notes, which travel through noteOn/noteOff rather than receiveMidi */
  private refuses(instance: string, port: string): boolean {
    return !!this.deps.receiver(instance)?.ignoresInput?.(port);
  }

  private noteOn(port: string, channel: number, note: number, velocity: number) {
    const key = `${port}|${channel}|${note}`;
    if (this.active.has(key)) this.noteOff(port, channel, note); // retrigger: close the old one first
    const instance = this.targetFor(port);
    if (!instance || this.refuses(instance, port)) return;
    const top = this.focus[this.focus.length - 1];
    const sink = top && top.instance === instance ? top : null;
    this.active.set(key, { instance, sink });
    const v = velocity / 127;
    if (sink) sink.noteOn(note, v);
    else this.deps.noteOn(instance, note, v);
  }

  private noteOff(port: string, channel: number, note: number) {
    const key = `${port}|${channel}|${note}`;
    const a = this.active.get(key);
    if (!a) return;
    this.active.delete(key);
    if (a.sink && this.focus.includes(a.sink)) a.sink.noteOff(note);
    else this.deps.noteOff(a.instance, note);
  }

  /** Release every note (panic / MIDI disabled) */
  allNotesOff() {
    this.active.forEach((a, key) => this.deps.noteOff(a.instance, Number(key.split('|')[2])));
    this.active.clear();
  }

  private cc(port: string, channel: number, cc: number, value: number, data: ArrayLike<number>, timeStamp: number) {
    // MIDI learn: the touched control takes this CC
    const learn = this.deps.learn();
    if (learn.armed && learn.target && !UNLEARNABLE.has(cc) && this.deps.inRack(learn.target.instance)) {
      const spec = this.deps.spec(learn.target.instance, learn.target.control);
      if (spec && spec.type !== 'pattern' && spec.type !== 'jack') {
        const mapping = this.deps.addMapping({
          port,
          channel,
          cc,
          instance: learn.target.instance,
          control: learn.target.control,
          toggle: spec.type === 'button' && !spec.momentary ? true : undefined,
        });
        this.deps.onLearned?.(mapping);
      }
    }

    let used = false;
    for (const m of this.deps.settings().mappings) {
      if (m.cc !== cc || m.channel !== channel || (m.port && m.port !== port)) continue;
      if (!this.deps.inRack(m.instance)) continue;
      used = true;
      this.applyMapping(m, value);
    }
    if (used) return;

    const target = this.targetFor(port);
    if (!target || this.refuses(target, port)) return;
    const receiver = this.deps.receiver(target);
    if (receiver) {
      receiver.receiveMidi(Array.from(data), timeStamp);
      return;
    }
    if (cc === 1) {
      const id = MOD_CONTROLS.find(c => isContinuous(this.deps.spec(target, c)));
      if (id) this.deps.apply(target, id, normToValue(this.deps.spec(target, id) as Extract<ControlSpec, { type: 'knob' }>, value / 127));
    }
  }

  private applyMapping(m: MidiMapping, value: number) {
    const spec = this.deps.spec(m.instance, m.control);
    if (!spec) return;
    if (m.toggle) {
      const prev = this.lastCc.get(m.id) ?? 0;
      this.lastCc.set(m.id, value);
      if (value >= 64 && prev < 64) this.deps.apply(m.instance, m.control, !this.deps.value(m.instance, m.control));
      return;
    }
    const v = ccToValue(spec, value);
    if (v !== undefined) this.deps.apply(m.instance, m.control, v);
  }

  private bend(port: string, value: number, data: ArrayLike<number>, timeStamp: number) {
    const target = this.targetFor(port);
    if (!target || this.refuses(target, port)) return;
    const receiver = this.deps.receiver(target);
    if (receiver) {
      receiver.receiveMidi(Array.from(data), timeStamp);
      return;
    }
    const id = BEND_CONTROLS.find(c => isContinuous(this.deps.spec(target, c)));
    if (!id) return;
    const spec = this.deps.spec(target, id) as Extract<ControlSpec, { type: 'knob' }>;
    this.deps.apply(target, id, normToValue(spec, (value + 1) / 2));
  }
}
