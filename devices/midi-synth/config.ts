// ============================================================================
// "Your synth (MIDI)" - per-instance configuration (DeviceModule.data).
// Pure data helpers, no browser APIs: shared by the engine, the panel, the
// setup dialog, the validator and the tests.
// ============================================================================

import type { PortRef } from '@/store/midi';
import { shortLabel, type GuideDevice } from './guide';

export const MAX_KNOBS = 16;
export const STEPS = 16;
/** Knob controls k1..k16 hold the knob *position* 0..127; each knob's range maps it to CC values */
export const KNOB_IDS = Array.from({ length: MAX_KNOBS }, (_, i) => `k${i + 1}`);
export const POS_MAX = 127;

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
  /** What the panel calls this synth */
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
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(lo, Math.min(hi, n));
};

/** A generic starting point: the General MIDI 2 "sound controller" CCs most synths honour */
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

// A two-bar-feel bass line in C minor (0 = rest)
const DEFAULT_NOTES = [36, 0, 36, 48, 0, 36, 46, 0, 36, 0, 39, 0, 43, 0, 46, 48];

export function defaultSteps(): SeqStep[] {
  return DEFAULT_NOTES.map((n, i) => ({ on: n > 0, note: n || 36, vel: i % 4 === 0 ? 118 : 96 }));
}

export function initialData(): MidiSynthData {
  return {
    v: 1,
    name: 'My synth',
    port: null,
    channel: 0,
    template: null,
    knobs: GENERIC_KNOBS.map(k => ({ ...k })),
    steps: defaultSteps(),
    offsetMs: 0,
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
  const out: MidiSynthData = {
    v: 1,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 40) : init.name,
    port,
    channel: clampInt(s.channel, 0, 15, 0),
    template: tpl ? { id: tpl.id, manufacturer: String(tpl.manufacturer ?? ''), device: String(tpl.device ?? ''), source: String(tpl.source ?? '') } : null,
    knobs,
    steps,
    offsetMs: Math.max(-200, Math.min(200, typeof s.offsetMs === 'number' && Number.isFinite(s.offsetMs) ? s.offsetMs : 0)),
  };
  // Keep the saved object when nothing changed, so the hub doesn't see new data
  return JSON.stringify(out) === JSON.stringify(saved) ? (saved as MidiSynthData) : out;
}

let fallback: MidiSynthData | null = null;

/**
 * Narrow unknown device data (the store holds `unknown`). Checks the shape, not
 * just the version: for one render after switching instruments the panel can be
 * handed another device's data.
 */
export function asData(d: unknown): MidiSynthData {
  const s = d as Partial<MidiSynthData> | null;
  if (s && typeof s === 'object' && s.v === 1 && Array.isArray(s.knobs) && Array.isArray(s.steps)) return s as MidiSynthData;
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
