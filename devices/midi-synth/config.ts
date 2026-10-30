// ============================================================================
// "Your synth (MIDI)" - per-instance configuration (DeviceModule.data).
// Pure data helpers, no browser APIs: shared by the engine, the panel, the
// setup dialog, the lessons, the validator and the tests.
// ============================================================================

import type { ControlValue } from '@/types';
import type { PortRef } from '@/store/midi';
import { PRACTICE_SYNTH_ID, PRACTICE_SYNTH_NAME } from '@/lib/midi/practice-core';
import { shortLabel, type GuideDevice } from './guide';

export const MAX_KNOBS = 16;
export const STEPS = 16;
/** Knob controls k1..k16 hold the knob *position* 0..127; each knob's range maps it to CC values */
export const KNOB_IDS = Array.from({ length: MAX_KNOBS }, (_, i) => `k${i + 1}`);
export const POS_MAX = 127;

/** The built-in Practice synth's port (lib/midi/practice-synth.ts) */
export const PRACTICE_PORT: PortRef = { id: PRACTICE_SYNTH_ID, name: PRACTICE_SYNTH_NAME };
export const isPractice = (p: PortRef | null | undefined) => !!p && (p.id === PRACTICE_SYNTH_ID || p.name === PRACTICE_SYNTH_NAME);

export interface CcKnob {
  label: string;
  /** Controller number 0-127 (the MSB for 14-bit controllers) */
  cc: number;
  /** CC value sent at the knob's minimum / maximum (0-127; max < min reverses the knob) */
  min: number;
  max: number;
  /** 14-bit controllers: the LSB controller number (usually cc + 32) */
  lsb?: number;
  /** Bipolar parameter: the middle is "zero" */
  centered?: boolean;
}

export interface SeqStep {
  on: boolean;
  /** MIDI note 0-127 */
  note: number;
  /** Velocity 1-127 */
  vel: number;
}

export interface MidiSynthData {
  v: 1;
  /** What the panel calls this synth (also its name in the rack once changed) */
  name: string;
  /** Output port (ids are tried first, then the name) */
  port: PortRef | null;
  /** MIDI channel 0-15 (shown as 1-16) */
  channel: number;
  /** midi.guide template the knobs came from (attribution) */
  template: { id: string; manufacturer: string; device: string; source: string } | null;
  knobs: CcKnob[];
  /** 16 sequencer steps */
  steps: SeqStep[];
  /** Timing trim for this synth in ms (+ later, - earlier), on top of the global MIDI offset */
  offsetMs: number;
  /** Send MIDI clock, Start and Stop to this synth's port (joins the clock targets in MIDI settings) */
  clock: boolean;
  /** Bank select sent before every program change (null = not sent) */
  bank: { msb: number | null; lsb: number | null };
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(lo, Math.min(hi, n));
};

/** A generic starting point: the General MIDI 2 "sound controller" CCs many synths honour */
export const GENERIC_KNOBS: CcKnob[] = [
  { label: 'Cutoff', cc: 74, min: 0, max: 127 },
  { label: 'Resonance', cc: 71, min: 0, max: 127 },
  { label: 'Attack', cc: 73, min: 0, max: 127 },
  { label: 'Decay', cc: 75, min: 0, max: 127 },
  { label: 'Release', cc: 72, min: 0, max: 127 },
  { label: 'Vibrato rate', cc: 76, min: 0, max: 127 },
  { label: 'Vibrato depth', cc: 77, min: 0, max: 127 },
  { label: 'Volume', cc: 7, min: 0, max: 127 },
];

/** What the Practice synth follows: the generic map plus glide, pan and its arpeggiator */
export const PRACTICE_KNOBS: CcKnob[] = [
  { label: 'Cutoff', cc: 74, min: 0, max: 127 },
  { label: 'Resonance', cc: 71, min: 0, max: 127 },
  { label: 'Attack', cc: 73, min: 0, max: 127 },
  { label: 'Decay', cc: 75, min: 0, max: 127 },
  { label: 'Release', cc: 72, min: 0, max: 127 },
  { label: 'Glide', cc: 5, min: 0, max: 127 },
  { label: 'Vibrato rate', cc: 76, min: 0, max: 127 },
  { label: 'Vibrato depth', cc: 77, min: 0, max: 127 },
  { label: 'Volume', cc: 7, min: 0, max: 127 },
  { label: 'Pan', cc: 10, min: 0, max: 127, centered: true },
  { label: 'Arp on/off', cc: 80, min: 0, max: 127 },
];

// A two-bar-feel bass line in C minor (0 = rest)
const DEFAULT_NOTES = [36, 0, 36, 48, 0, 36, 46, 0, 36, 0, 39, 0, 43, 0, 46, 48];

const stepsFrom = (notes: number[], vel: (i: number) => number = i => (i % 4 === 0 ? 118 : 96)): SeqStep[] =>
  notes.map((n, i) => ({ on: n > 0, note: n || 36, vel: vel(i) }));

export function defaultSteps(): SeqStep[] {
  return stepsFrom(DEFAULT_NOTES);
}

export const DEFAULT_NAME = 'My synth';

export function initialData(): MidiSynthData {
  return {
    v: 1,
    name: DEFAULT_NAME,
    // Out of the box it plays the built-in Practice synth: sound in the first minute, no gear needed
    port: { ...PRACTICE_PORT },
    channel: 0,
    template: null,
    knobs: GENERIC_KNOBS.map(k => ({ ...k })),
    steps: defaultSteps(),
    offsetMs: 0,
    clock: false,
    bank: { msb: null, lsb: null },
  };
}

export function sanitizeKnob(k: Partial<CcKnob> | undefined): CcKnob | null {
  if (!k || typeof k !== 'object') return null;
  const cc = clampInt(k.cc, 0, 127, -1);
  if (cc < 0) return null;
  const out: CcKnob = {
    label: typeof k.label === 'string' && k.label.trim() ? k.label.trim().slice(0, 24) : `CC ${cc}`,
    cc,
    min: clampInt(k.min, 0, 127, 0),
    max: clampInt(k.max, 0, 127, 127),
  };
  if (k.lsb !== undefined && k.lsb !== null) {
    const lsb = clampInt(k.lsb, 0, 127, -1);
    if (lsb >= 0 && lsb !== cc) out.lsb = lsb;
  }
  if (k.centered) out.centered = true;
  return out;
}

const bankByte = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? clampInt(v, 0, 127, 0) : null);

/** Accept anything that was saved (older versions, hand-edited projects) and return valid data */
export function migrateData(saved: unknown): MidiSynthData {
  const init = initialData();
  if (!saved || typeof saved !== 'object') return init;
  const s = saved as Partial<MidiSynthData>;
  const port = s.port && typeof s.port === 'object' && typeof s.port.name === 'string'
    ? { id: String(s.port.id ?? ''), name: s.port.name }
    : null;
  const knobs = Array.isArray(s.knobs)
    ? s.knobs.map(k => sanitizeKnob(k)).filter((k): k is CcKnob => !!k).slice(0, MAX_KNOBS)
    : init.knobs;
  const steps = Array.from({ length: STEPS }, (_, i) => {
    const st = Array.isArray(s.steps) ? s.steps[i] : undefined;
    const d = init.steps[i];
    if (!st || typeof st !== 'object') return Array.isArray(s.steps) ? { on: false, note: d.note, vel: d.vel } : d;
    return { on: !!st.on, note: clampInt(st.note, 0, 127, d.note), vel: clampInt(st.vel, 1, 127, d.vel) };
  });
  const tpl = s.template && typeof s.template === 'object' && typeof s.template.id === 'string' ? s.template : null;
  const bank = s.bank && typeof s.bank === 'object' ? s.bank : null;
  const out: MidiSynthData = {
    v: 1,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 40) : init.name,
    // A saved "no output" stays "no output"
    port,
    channel: clampInt(s.channel, 0, 15, 0),
    template: tpl ? { id: tpl.id, manufacturer: String(tpl.manufacturer ?? ''), device: String(tpl.device ?? ''), source: String(tpl.source ?? '') } : null,
    knobs,
    steps,
    offsetMs: Math.max(-200, Math.min(200, typeof s.offsetMs === 'number' && Number.isFinite(s.offsetMs) ? s.offsetMs : 0)),
    clock: s.clock === true,
    bank: { msb: bankByte(bank?.msb), lsb: bankByte(bank?.lsb) },
  };
  // Keep the saved object when nothing changed, so the hub doesn't see new data
  return JSON.stringify(out) === JSON.stringify(saved) ? (saved as MidiSynthData) : out;
}

let fallback: MidiSynthData | null = null;
/** Data saved before `clock` / `bank` existed, completed once (the same object every call, so React sees no change) */
const completed = new WeakMap<object, MidiSynthData>();

/**
 * Narrow unknown device data (the store holds `unknown`). Checks the shape, not
 * just the version: for one render after switching instruments the panel can be
 * handed another device's data.
 */
export function asData(d: unknown): MidiSynthData {
  const s = d as Partial<MidiSynthData> | null;
  if (s && typeof s === 'object' && s.v === 1 && Array.isArray(s.knobs) && Array.isArray(s.steps)) {
    if (typeof s.clock === 'boolean' && s.bank && typeof s.bank === 'object') return s as MidiSynthData;
    let c = completed.get(s);
    if (!c) {
      c = { ...(s as MidiSynthData), clock: s.clock === true, bank: { msb: null, lsb: null, ...(s.bank ?? {}) } };
      completed.set(s, c);
    }
    return c;
  }
  return (fallback ??= initialData());
}

// ----------------------------------------------------------------------------
// Knob position -> CC value
// ----------------------------------------------------------------------------

/** The CC value (fractional) a knob position stands for */
export function knobValue(k: CcKnob, pos: number): number {
  const n = Math.max(0, Math.min(1, pos / POS_MAX));
  return k.min + (k.max - k.min) * n;
}

/** Bytes for a knob position: one CC, or MSB + LSB for 14-bit controllers */
export function knobMessages(k: CcKnob, pos: number, channel: number): number[][] {
  const v = knobValue(k, pos);
  const status = 0xb0 | (channel & 0x0f);
  if (k.lsb === undefined) return [[status, k.cc & 0x7f, Math.max(0, Math.min(127, Math.round(v)))]];
  const v14 = Math.max(0, Math.min(16383, Math.round((v / 127) * 16383)));
  return [[status, k.cc & 0x7f, v14 >> 7], [status, k.lsb & 0x7f, v14 & 0x7f]];
}

/** What the knob shows: the CC value being sent */
export function knobText(k: CcKnob, pos: number): string {
  const v = Math.round(knobValue(k, pos));
  if (!k.centered) return String(v);
  const d = v - Math.round((k.min + k.max) / 2);
  return d > 0 ? `+${d}` : String(d);
}

/** Program change, after bank select (MSB on CC 0, LSB on CC 32) when the synth needs it */
export function programMessages(program: number, channel: number, bank: MidiSynthData['bank'] | undefined): number[][] {
  const ch = channel & 0x0f;
  const out: number[][] = [];
  if (bank?.msb !== null && bank?.msb !== undefined) out.push([0xb0 | ch, 0, bank.msb & 0x7f]);
  if (bank?.lsb !== null && bank?.lsb !== undefined) out.push([0xb0 | ch, 32, bank.lsb & 0x7f]);
  out.push([0xc0 | ch, Math.max(0, Math.min(127, Math.round(program)))]);
  return out;
}

// ----------------------------------------------------------------------------
// midi.guide templates -> knobs
// ----------------------------------------------------------------------------

/** Parameters of a template that can become knobs (they need a CC) */
export function knobCandidates(device: GuideDevice): number[] {
  return device.params.map((p, i) => (p.cc !== undefined ? i : -1)).filter(i => i >= 0);
}

/** Knobs from chosen template parameters (defaults to the suggested ones) */
export function knobsFromTemplate(device: GuideDevice, indices?: number[]): CcKnob[] {
  const pick = (indices ?? device.suggested).filter(i => device.params[i]?.cc !== undefined);
  return pick.slice(0, MAX_KNOBS).map(i => {
    const p = device.params[i];
    return sanitizeKnob({ label: shortLabel(p.name), cc: p.cc, min: p.min ?? 0, max: p.max ?? 127, lsb: p.lsb, centered: p.centered })!;
  });
}

export function applyTemplate(data: MidiSynthData, device: GuideDevice, indices?: number[]): MidiSynthData {
  const knobs = knobsFromTemplate(device, indices);
  return {
    ...data,
    name: data.name === initialData().name || data.template ? device.device : data.name,
    template: { id: device.id, manufacturer: device.manufacturer, device: device.device, source: device.source },
    knobs: knobs.length ? knobs : data.knobs,
  };
}

// ----------------------------------------------------------------------------
// Several synths in one studio
// ----------------------------------------------------------------------------

export interface SynthUse {
  instance: string;
  name: string;
  port: PortRef | null;
  channel: number;
}

const samePortRef = (a: PortRef | null, b: PortRef | null) => !!a && !!b && (a.id === b.id || (!!a.name && a.name === b.name));

/** Other "Your synth" instances that would play the same synth part: same port and channel */
export function channelClashes(self: string, port: PortRef | null, channel: number, all: SynthUse[]): SynthUse[] {
  return all.filter(u => u.instance !== self && u.channel === channel && samePortRef(u.port, port));
}

/** Lowest channel no other instance uses on this port (for a second synth) */
export function freeChannel(self: string, port: PortRef | null, all: SynthUse[]): number {
  for (let ch = 0; ch < 16; ch++) if (!channelClashes(self, port, ch, all).length) return ch;
  return 0;
}

/** The rack name for an instance: its own name once you give it one */
export function rackLabel(name: string, channel: number, self: string, all: SynthUse[]): string | undefined {
  const n = name.trim();
  if (!n || n === DEFAULT_NAME) return undefined;
  // Two synths with the same name: add the channel so the rack and routing tell them apart
  const twin = all.some(u => u.instance !== self && u.name.trim() === n);
  return twin ? `${n} · ch ${channel + 1}` : n;
}

// ----------------------------------------------------------------------------
// Starter setups ("Category / Name")
// ----------------------------------------------------------------------------

export interface StarterContext {
  /** First hardware output that is plugged in (null on iPad, Safari, or with nothing connected) */
  hardware: PortRef | null;
}

export interface Starter {
  id: string;
  /** "Category / Name" */
  name: string;
  description: string;
  /** Needs a hardware output to make sense */
  hardware?: boolean;
  apply: (d: MidiSynthData, c: StarterContext) => { data: MidiSynthData; values?: Record<string, ControlValue> };
}

const KEYS = [60, 0, 63, 67, 0, 70, 67, 0, 72, 0, 70, 67, 0, 63, 67, 0];
// One drum per step (General MIDI: 36 kick, 38 snare, 42 closed hat, 46 open hat)
const BEAT = [36, 42, 42, 36, 38, 42, 36, 42, 36, 42, 36, 46, 38, 42, 42, 42];
const ACID = [36, 36, 48, 36, 0, 39, 36, 51, 36, 0, 46, 36, 48, 0, 43, 36];
const OFFBEAT = [0, 0, 36, 0, 0, 0, 36, 0, 0, 0, 36, 0, 0, 0, 43, 0];
const PRACTICE_NAMES = ['Practice bass', 'Practice keys', 'Practice drums'];

const keepRealPort = (d: MidiSynthData, c: StarterContext) => (d.port && !isPractice(d.port) ? d.port : c.hardware);
const hardwareName = (d: MidiSynthData, fallbackName: string) => (d.name === DEFAULT_NAME || PRACTICE_NAMES.includes(d.name) ? fallbackName : d.name);

export const STARTERS: Starter[] = [
  {
    id: 'practice-bass', name: 'Setup / Practice synth: bass on channel 1',
    description: 'No gear needed. The built-in Practice synth plays its bass part on channel 1, with its own knob map and clock.',
    apply: d => ({
      data: { ...d, name: 'Practice bass', port: { ...PRACTICE_PORT }, channel: 0, clock: true, template: null, knobs: PRACTICE_KNOBS.map(k => ({ ...k })), steps: stepsFrom(DEFAULT_NOTES) },
      values: { seq: true, gate: 50, length: 16, transpose: 0 },
    }),
  },
  {
    id: 'practice-keys', name: 'Setup / Practice synth: keys on channel 2',
    description: 'The Practice synth\'s six-voice keys part. Play chords on the keys, or turn Arp on/off up and play a chord.',
    apply: d => ({
      data: { ...d, name: 'Practice keys', port: { ...PRACTICE_PORT }, channel: 1, clock: true, template: null, knobs: PRACTICE_KNOBS.map(k => ({ ...k })), steps: stepsFrom(KEYS, i => (i % 4 === 0 ? 110 : 84)) },
      values: { seq: true, gate: 40, length: 16, transpose: 0 },
    }),
  },
  {
    id: 'practice-drums', name: 'Setup / Practice synth: drums on channel 10',
    description: 'Channel 10 is the General MIDI drum channel: each note number is a different drum (36 kick, 38 snare, 42 hi-hat).',
    apply: d => ({
      data: {
        ...d, name: 'Practice drums', port: { ...PRACTICE_PORT }, channel: 9, clock: true, template: null,
        knobs: [{ label: 'Volume', cc: 7, min: 0, max: 127 }, { label: 'Pan', cc: 10, min: 0, max: 127, centered: true }],
        steps: stepsFrom(BEAT, i => (i % 4 === 0 ? 120 : i % 2 ? 70 : 96)),
      },
      values: { seq: true, gate: 25, length: 16, transpose: 0 },
    }),
  },
  {
    id: 'hw-ch1-clock', name: 'Setup / Hardware synth on channel 1 with clock', hardware: true,
    description: 'Your synth on its MIDI output, channel 1 (most synths listen there out of the box), with MIDI clock so its arpeggiator and LFO sync follow the studio.',
    apply: (d, c) => ({ data: { ...d, name: hardwareName(d, DEFAULT_NAME), port: keepRealPort(d, c), channel: 0, clock: true } }),
  },
  {
    id: 'hw-second', name: 'Setup / Second synth on channel 2', hardware: true,
    description: 'For a second synth on the same cable (MIDI thru, or a multitimbral synth): channel 2, so each one only hears its own part.',
    apply: (d, c) => ({ data: { ...d, name: hardwareName(d, 'Synth 2'), port: keepRealPort(d, c), channel: 1, clock: true } }),
  },
  {
    id: 'hw-drums', name: 'Setup / Drum machine on channel 10 with clock', hardware: true,
    description: 'Many drum machines listen on channel 10 with General MIDI note numbers. Clock keeps their own patterns in time with the studio.',
    apply: (d, c) => ({
      data: { ...d, name: hardwareName(d, 'Drum machine'), port: keepRealPort(d, c), channel: 9, clock: true, steps: stepsFrom(BEAT, i => (i % 4 === 0 ? 120 : i % 2 ? 70 : 96)) },
      values: { gate: 25 },
    }),
  },
  {
    id: 'seq-acid', name: 'Sequence / Acid line',
    description: 'A busy 16th-note bass line with octave jumps and accents. Short notes leave room for the filter to snap.',
    apply: d => ({ data: { ...d, steps: stepsFrom(ACID, i => ([0, 3, 7, 12].includes(i) ? 124 : 88)) }, values: { gate: 35, length: 16, transpose: 0, seq: true } }),
  },
  {
    id: 'seq-offbeat', name: 'Sequence / Off-beat bass',
    description: 'One note on every "and": the classic house bass that leaves the beat to the kick drum.',
    apply: d => ({ data: { ...d, steps: stepsFrom(OFFBEAT, () => 108) }, values: { gate: 60, length: 16, transpose: 0, seq: true } }),
  },
  {
    id: 'seq-clear', name: 'Sequence / Empty pattern',
    description: 'Every step off (the notes stay, so you can switch steps back on). Start a pattern from scratch.',
    apply: d => ({ data: { ...d, steps: d.steps.map(st => ({ ...st, on: false })) } }),
  },
  {
    id: 'knobs-generic', name: 'Knobs / General MIDI sound controllers',
    description: 'Cutoff 74, Resonance 71, Attack 73, Decay 75, Release 72, Vibrato 76/77, Volume 7. Many synths follow these.',
    apply: d => ({ data: { ...d, template: null, knobs: GENERIC_KNOBS.map(k => ({ ...k })) } }),
  },
  {
    id: 'knobs-practice', name: 'Knobs / Practice synth controls',
    description: 'Every control the Practice synth has, including glide, pan and its arpeggiator (CC 80).',
    apply: d => ({ data: { ...d, template: null, knobs: PRACTICE_KNOBS.map(k => ({ ...k })) } }),
  },
];

/** Starters grouped by their category, in order */
export function starterGroups(list: Starter[] = STARTERS): [string, Starter[]][] {
  const groups = new Map<string, Starter[]>();
  list.forEach(st => {
    const cat = st.name.split(' / ')[0];
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(st);
  });
  return [...groups.entries()];
}
