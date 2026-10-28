// ============================================================================
// Mother-32 sequence data (shared by spec, presets, engine, panel and lessons)
//
// The pattern being played and edited lives in hidden `pattern` controls, one
// character per step, so presets, lessons and arranger snapshots can carry it:
//   seq_notes    note char (see ALPHABET); '0' = rest (legacy); '.' = past the end
//   seq_accent   '1' accent
//   seq_gate     '1'..'8' gate length in eighths of the step ('8' = tie into the next)
//   seq_glide    '1' glide into this step (at the GLIDE knob's time)
//   seq_ratchet  '1'..'4' notes inside the step
//   seq_rest     '1' rest (the step keeps its note, but does not play)
// plus `seq_length` (1-32). Length = seq_length, or the first '.' if earlier.
// The 64-pattern memory (8 banks x 8) is per-instance device data (`bank`).
// ============================================================================

import type { ControlValue } from '@/types';

export const STEPS = 32;
/** MIDI note of the lowest key at the power-up octave (OCTAVE / LOCATION LED 4) */
export const KB_LOW = 48;
/** Lowest note a pattern can store */
const NOTE_BASE = 24;
// '0' and '.' are reserved, so notes use letters then digits 1-9 (61 notes: C1..C6)
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

export const REST = '0';
export const END = '.';
export const NOTE_MIN = NOTE_BASE;
export const NOTE_MAX = NOTE_BASE + ALPHABET.length - 1;

export function encodeNote(note: number): string {
  const i = Math.max(0, Math.min(ALPHABET.length - 1, Math.round(note) - NOTE_BASE));
  return ALPHABET[i];
}

/** MIDI note for a step char, or null for a rest / end */
export function decodeNote(ch: string | undefined): number | null {
  if (!ch || ch === REST || ch === END) return null;
  const i = ALPHABET.indexOf(ch);
  return i < 0 ? null : NOTE_BASE + i;
}

/** Number of steps before the first END marker */
export function patternLength(notes: string): number {
  const i = notes.indexOf(END);
  return i < 0 ? Math.min(STEPS, notes.length) : i;
}

/** Build a pattern string from MIDI notes (null = rest), padded with END */
export function makePattern(notes: (number | null)[]): string {
  return notes.slice(0, STEPS).map(n => (n === null ? REST : encodeNote(n))).join('').padEnd(STEPS, END);
}

/** Accent string from step numbers (1-based) */
export function makeAccents(steps: number[]): string {
  return Array.from({ length: STEPS }, (_, i) => (steps.includes(i + 1) ? '1' : '0')).join('');
}

export const EMPTY_PATTERN = ''.padEnd(STEPS, END);
export const NO_ACCENTS = ''.padEnd(STEPS, '0');

// ----------------------------------------------------------------------------
// Steps and lanes
// ----------------------------------------------------------------------------

export interface Step {
  /** MIDI note; null = rest with no note */
  note: number | null;
  /** Gate length in eighths of the step, 1..8 (8 = tie) */
  gate: number;
  glide: boolean;
  /** Notes inside the step, 1..4 */
  ratchet: number;
  accent: boolean;
  rest: boolean;
}

export const LANES = ['seq_notes', 'seq_accent', 'seq_gate', 'seq_glide', 'seq_ratchet', 'seq_rest'] as const;
export type Lane = (typeof LANES)[number];

/** The pattern as control values: six lanes plus the length */
export interface PatternValues {
  seq_notes: string;
  seq_accent: string;
  seq_gate: string;
  seq_glide: string;
  seq_ratchet: string;
  seq_rest: string;
  seq_length: number;
}

const DEFAULT_GATE = 4;
const pad = (s: string, ch: string) => s.slice(0, STEPS).padEnd(STEPS, ch);

/** Shorthand step: a note, or a note with options */
export type StepSpec = number | null | (Partial<Omit<Step, 'note'>> & { note: number | null });

function toStep(s: StepSpec): Step {
  if (s === null || typeof s === 'number') return { note: s, gate: DEFAULT_GATE, glide: false, ratchet: 1, accent: false, rest: s === null };
  return {
    note: s.note,
    gate: Math.max(1, Math.min(8, Math.round(s.gate ?? DEFAULT_GATE))),
    glide: !!s.glide,
    ratchet: Math.max(1, Math.min(4, Math.round(s.ratchet ?? 1))),
    accent: !!s.accent,
    rest: s.rest ?? s.note === null,
  };
}

/** Control values for a sequence of steps (length = number of steps) */
export function sequence(steps: StepSpec[], opts: { length?: number } = {}): PatternValues {
  const st = steps.slice(0, STEPS).map(toStep);
  const len = Math.max(1, Math.min(STEPS, opts.length ?? st.length));
  // notes past the end are kept (so SET END can extend the pattern again); '.' never appears
  let last: number = 48;
  const notes = st.map(s => { if (s.note !== null) last = s.note; return encodeNote(s.note ?? last); }).join('');
  return {
    seq_notes: pad(notes, encodeNote(last)),
    seq_accent: pad(st.map(s => (s.accent ? '1' : '0')).join(''), '0'),
    seq_gate: pad(st.map(s => String(s.gate)).join(''), String(DEFAULT_GATE)),
    seq_glide: pad(st.map(s => (s.glide ? '1' : '0')).join(''), '0'),
    seq_ratchet: pad(st.map(s => String(s.ratchet)).join(''), '1'),
    seq_rest: pad(st.map(s => (s.rest ? '1' : '0')).join(''), '0'),
    seq_length: len,
  };
}

/**
 * Effective length of the pattern in `values`. An END marker ('.') wins: patterns saved by the
 * first build of this twin, and a pattern being recorded, end at their first '.'.
 */
export function lengthOf(values: Record<string, ControlValue | undefined>): number {
  const notes = typeof values.seq_notes === 'string' ? values.seq_notes : '';
  const end = notes.indexOf(END);
  if (end >= 0) return Math.max(1, end);
  const n = typeof values.seq_length === 'number' ? Math.round(values.seq_length) : 16;
  return Math.max(1, Math.min(STEPS, n));
}

/** The pattern with END markers replaced by notes and the length made explicit (before editing) */
export function normalize(values: Record<string, ControlValue | undefined>): PatternValues {
  const p = patternOf(values);
  if (p.seq_notes.indexOf(END) < 0) return p;
  let last = 'y'; // C3
  const notes = p.seq_notes.split('').map(ch => { if (ch !== END && ch !== REST) last = ch; return ch === END ? last : ch; }).join('');
  const restLane = p.seq_rest.split('').map((r, i) => (p.seq_notes[i] === REST ? '1' : r)).join('');
  return { ...p, seq_notes: notes.replace(/0/g, last), seq_rest: restLane };
}

const lane = (values: Record<string, ControlValue | undefined>, id: Lane, fill: string) =>
  pad(typeof values[id] === 'string' ? (values[id] as string) : '', fill);

/** Read one step from the control values */
export function stepAt(values: Record<string, ControlValue | undefined>, i: number): Step {
  const notes = lane(values, 'seq_notes', END);
  const note = decodeNote(notes[i]);
  const gate = Number(lane(values, 'seq_gate', String(DEFAULT_GATE))[i]) || DEFAULT_GATE;
  const ratchet = Number(lane(values, 'seq_ratchet', '1')[i]) || 1;
  return {
    note,
    gate: Math.max(1, Math.min(8, gate)),
    glide: lane(values, 'seq_glide', '0')[i] === '1',
    ratchet: Math.max(1, Math.min(4, ratchet)),
    accent: lane(values, 'seq_accent', '0')[i] === '1',
    rest: lane(values, 'seq_rest', '0')[i] === '1' || note === null,
  };
}

/** Replace one character of a lane; returns the new lane string */
export function setLaneChar(values: Record<string, ControlValue | undefined>, id: Lane, i: number, ch: string): string {
  const fill = id === 'seq_notes' ? END : id === 'seq_gate' ? String(DEFAULT_GATE) : id === 'seq_ratchet' ? '1' : '0';
  const s = lane(values, id, fill);
  return s.slice(0, i) + ch + s.slice(i + 1);
}

/** What the worklet needs: arrays of numbers */
export function decodeForEngine(values: Record<string, ControlValue | undefined>) {
  const len = lengthOf(values);
  const notes: number[] = [], gate: number[] = [], glide: number[] = [], ratchet: number[] = [], accent: number[] = [], rest: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    const s = stepAt(values, i);
    notes.push(s.note ?? -1);
    gate.push(s.gate);
    glide.push(s.glide ? 1 : 0);
    ratchet.push(s.ratchet);
    accent.push(s.accent ? 1 : 0);
    rest.push(s.rest ? 1 : 0);
  }
  return { notes, gate, glide, ratchet, accent, rest, len };
}

/** Copy of the pattern lanes in `values` */
export function patternOf(values: Record<string, ControlValue | undefined>): PatternValues {
  return {
    seq_notes: lane(values, 'seq_notes', END),
    seq_accent: lane(values, 'seq_accent', '0'),
    seq_gate: lane(values, 'seq_gate', String(DEFAULT_GATE)),
    seq_glide: lane(values, 'seq_glide', '0'),
    seq_ratchet: lane(values, 'seq_ratchet', '1'),
    seq_rest: lane(values, 'seq_rest', '0'),
    seq_length: lengthOf(values),
  };
}

export function samePattern(a: PatternValues, b: PatternValues): boolean {
  return a.seq_length === b.seq_length && LANES.every(l => a[l].slice(0, a.seq_length) === b[l].slice(0, b.seq_length));
}

/** An empty pattern for KB-mode recording */
export function blankPattern(): PatternValues {
  return { ...sequence([48]), seq_notes: EMPTY_PATTERN, seq_length: 1 };
}

/** Rotate the pattern one step left (-1) or right (+1) within its length */
export function rotate(p: PatternValues, dir: -1 | 1): PatternValues {
  const n = p.seq_length;
  const rot = (s: string) => {
    const a = s.slice(0, n), rest = s.slice(n);
    return (dir > 0 ? a.slice(-1) + a.slice(0, -1) : a.slice(1) + a.slice(0, 1)) + rest;
  };
  return {
    seq_notes: rot(p.seq_notes), seq_accent: rot(p.seq_accent), seq_gate: rot(p.seq_gate),
    seq_glide: rot(p.seq_glide), seq_ratchet: rot(p.seq_ratchet), seq_rest: rot(p.seq_rest), seq_length: n,
  };
}

// ----------------------------------------------------------------------------
// Pattern memory: 8 banks x 8 patterns (per-instance device data)
// ----------------------------------------------------------------------------

export interface Mother32Data {
  v: 1;
  /** Selected location 0..63 (bank * 8 + pattern) */
  loc: number;
  bank: (PatternValues | null)[];
}

export const LOCATIONS = 64;
export const locName = (loc: number) => `${Math.floor(loc / 8) + 1}-${(loc % 8) + 1}`;

export function asData(d: unknown): Mother32Data | null {
  const x = d as Partial<Mother32Data> | null | undefined;
  if (!x || x.v !== 1 || !Array.isArray(x.bank)) return null;
  return x as Mother32Data;
}

// ----------------------------------------------------------------------------
// Note names (C3 = MIDI 48)
// ----------------------------------------------------------------------------

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (n: number) => `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
