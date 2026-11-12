// ============================================================================
// Lesson check helpers for studio lessons (Lesson API v3 – studio state,
// docs/research/producer-path/curriculum.md §5). Checks call these instead of
// reaching into the check state, so lesson text stays about the music and a
// missing instrument reads as "not done" instead of throwing: every helper
// returns undefined (or a safe default) when it can't answer.
// Pure: no audio, no store - the validator runs every check in Node.
// ============================================================================

import type { ControlValue, LessonCheckState } from '@/types';
import { NOTE_LENGTHS, type PatternId, type Pattern, type Project, type Step } from '@/lib/sequencer/elektron/types';
import { getPattern, isPatternId, isProject } from '@/lib/sequencer/elektron/project';

type S = LessonCheckState;

// ---- instruments ------------------------------------------------------------

/** First instance id of a device in the rack ('xone96' -> 'xone96'), or an instance id as given */
export function inst(s: S, devOrInstance: string): string | undefined {
  if (s.instances[devOrInstance]) return devOrInstance;
  return Object.entries(s.instances).find(([, i]) => i.device === devOrInstance)?.[0];
}

/** Is a device in the rack? */
export function has(s: S, dev: string): boolean {
  return inst(s, dev) !== undefined;
}

/** A control value of a device (its first instance) by control id */
export function val(s: S, dev: string, control: string): ControlValue | undefined {
  const id = inst(s, dev);
  return id ? s.instances[id]?.values[control] : undefined;
}

/** A numeric control value (NaN when missing, so every comparison is false) */
export function num(s: S, dev: string, control: string): number {
  const v = val(s, dev, control);
  return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : NaN;
}

export const between = (v: number | null | undefined, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;

/** A cable between two instruments, either direction (by device or instance) */
export function cable(s: S, fromDev: string, fromJack: string, toDev: string, toJack: string): boolean {
  const a = inst(s, fromDev);
  const b = inst(s, toDev);
  if (!a || !b) return false;
  return s.studioCables.some(c =>
    (c.from.instance === a && c.from.jack === fromJack && c.to.instance === b && c.to.jack === toJack) ||
    (c.to.instance === a && c.to.jack === fromJack && c.from.instance === b && c.from.jack === toJack));
}

/** The instrument follows the studio clock (missing means on, for MIDI-syncable gear) */
export function synced(s: S, dev: string): boolean {
  const id = inst(s, dev);
  return !!id && s.sync[id] !== false;
}

// ---- the Xone:96 ----------------------------------------------------------------

const XONE = 'xone96';
const STUDIO_TO_CH: Record<string, string> = { studio_1: '1', studio_2: '2', studio_3: '3', studio_4: '4', studio_a: 'a', studio_b: 'b', studio_c: 'c', studio_d: 'd' };

/** The Xone:96 channel a device is routed to: '1'..'4', 'a'..'d', or null */
export function xch(s: S, dev: string): string | null {
  const id = inst(s, dev);
  const r = id ? s.routes[id] : undefined;
  if (!r || r === 'master') return null;
  const [mixer, input] = r.split(':');
  if (s.instances[mixer]?.device !== XONE) return null;
  return STUDIO_TO_CH[input] ?? null;
}

/** Xone:96 control names, as printed, to control ids on a channel */
const XONE_NAMES: Record<string, string> = {
  GAIN: 'gain', HI: 'hi', 'HI MID': 'himid', 'LO MID': 'lomid', LO: 'lo', MID: 'mid', FREQ: 'midf',
  FADER: 'fader', 'SEND 1': 'snd1', 'SEND 2': 'snd2', PRE: 'pre', FILTER: 'filter', INPUT: 'input', DECK: 'src', CUE: 'cue', XFADER: 'xf',
};

/** A Xone:96 channel control by its printed name: xv(s, '2', 'LO MID') (raw knob value; see xdb for dB) */
export function xv(s: S, ch: string | null | undefined, name: string): number {
  if (!ch) return NaN;
  const id = XONE_NAMES[name.toUpperCase()];
  return id ? num(s, XONE, `ch${ch}_${id}`) : NaN;
}

/** HI / LO knob (-1 kill .. +1) -> dB: +6 dB clockwise, a full kill anticlockwise */
export function killDb(v: number): number {
  if (!Number.isFinite(v)) return NaN;
  if (v >= 0) return 6 * v;
  const g = Math.pow(1 + v, 2);
  return g > 0 ? 20 * Math.log10(g) : -Infinity;
}

/** Mid knob (-1 .. +1) -> dB: +10 dB boost, -27 dB cut (CH 1-4) or -24 dB (CH A/B) */
export function midDb(v: number, aux = false): number {
  if (!Number.isFinite(v)) return NaN;
  return v >= 0 ? 10 * v : (aux ? 24 : 27) * v;
}

/** dB -> HI / LO knob (lesson values: write killKnob(-6), not -0.29) */
export function killKnob(db: number): number {
  if (db >= 0) return Math.round((db / 6) * 1000) / 1000;
  return Math.round((Math.pow(10, db / 40) - 1) * 1000) / 1000;
}

/** dB -> mid knob */
export function midKnob(db: number, aux = false): number {
  return Math.round((db >= 0 ? db / 10 : db / (aux ? 24 : 27)) * 1000) / 1000;
}

/** A Xone:96 EQ band in dB: xdb(s, '3', 'LO') */
export function xdb(s: S, ch: string | null | undefined, band: 'HI' | 'HI MID' | 'LO MID' | 'LO' | 'MID'): number {
  if (!ch) return NaN;
  const v = xv(s, ch, band);
  return band === 'HI' || band === 'LO' ? killDb(v) : midDb(v, ch === 'a' || ch === 'b');
}

/** Xone:96 filter section (1 or 2): on, type index (0 HPF, 1 BPF, 2 LPF...), FREQ Hz, RES */
export function xfilter(s: S, f: 1 | 2) {
  return {
    on: val(s, XONE, `f${f}_on`) === true,
    type: num(s, XONE, `f${f}_type`),
    freq: num(s, XONE, `f${f}_freq`),
    res: num(s, XONE, `f${f}_res`),
  };
}

/** Is a Xone channel high-passed by its filter assign? (assigned to an ON section set to HPF at `minHz` or higher) */
export function xHighPassed(s: S, ch: string | null | undefined, minHz = 60): boolean {
  if (!ch) return false;
  const a = xv(s, ch, 'FILTER');
  const f = a === 0 ? xfilter(s, 1) : a === 2 ? xfilter(s, 2) : null;
  return !!f && f.on && (f.type === 0 || f.type === 3) && f.freq >= minHz;
}

/** A Xone:96 channel meter from the live meters: peak in the last 2 s (dBu) and PK */
export function xmeter(s: S, ch: string | null | undefined) {
  if (!ch) return undefined;
  const id = inst(s, XONE);
  return id ? s.meters?.channels[`${id}:${ch}`] : undefined;
}

// ---- the master ------------------------------------------------------------------

/** The master meter, when audio runs */
export function master(s: S) {
  return s.meters?.live ? s.meters.master : undefined;
}

/** Studio swing as a percentage (50 straight .. 75), as the top bar shows it */
export function swingPct(s: S): number {
  return Math.round(50 + (s.transport.swing ?? 0) * 50);
}

/** Song length in seconds (0 without sections) */
export function songSeconds(s: S): number {
  const bars = s.arrangement.sections.reduce((n, x) => n + Math.max(1, x.bars), 0);
  return (bars * 4 * 60) / Math.max(20, s.transport.bpm);
}

// ---- the song arranger -------------------------------------------------------------

const norm = (x: string) => x.toLowerCase().replace(/\s+/g, '');

/** A section by name (case and spaces ignored) or index */
export function sec(s: S, nameOrIndex: string | number) {
  const list = s.arrangement.sections;
  return typeof nameOrIndex === 'number' ? list[nameOrIndex] : list.find(x => norm(x.name) === norm(nameOrIndex));
}

/** That section's part for a device */
export function part(s: S, section: ReturnType<typeof sec>, dev: string) {
  const id = inst(s, dev);
  return section && id ? section.parts[id] : undefined;
}

/** A value in a section's knob snapshot for a device (undefined without a snapshot) */
export function snap(s: S, section: ReturnType<typeof sec>, dev: string, control: string): ControlValue | undefined {
  const p = part(s, section, dev);
  const sn = p?.snapshot as Record<string, ControlValue> | undefined;
  return sn ? sn[control] : undefined;
}

/** Number of bars in the song */
export function songBars(s: S): number {
  return s.arrangement.sections.reduce((n, x) => n + Math.max(1, x.bars), 0);
}

/**
 * What a control is set to while a section plays. Snapshots apply on a section's first
 * beat and hold until the next snapshot that sets the control, so this is the nearest
 * snapshot at or before the section; without one, the instrument's live value.
 */
export function sectionValue(s: S, section: string | number, dev: string, control: string): ControlValue | undefined {
  const list = s.arrangement.sections;
  const i = typeof section === 'number' ? section : list.findIndex(x => norm(x.name) === norm(section));
  if (i < 0 || i >= list.length) return undefined;
  for (let k = i; k >= 0; k--) {
    const v = snap(s, list[k], dev, control);
    if (v !== undefined) return v;
  }
  return val(s, dev, control);
}

/**
 * The fader of a Xone:96 channel while a section plays (see sectionValue); 0 when the
 * section mutes the Xone:96 itself. Good for "the kick is out in the Break" checks.
 */
export function sectionFader(s: S, section: string | number, ch: string): number {
  const list = s.arrangement.sections;
  const i = typeof section === 'number' ? section : list.findIndex(x => norm(x.name) === norm(section));
  if (i < 0 || i >= list.length) return NaN;
  if (part(s, list[i], XONE)?.muted) return 0;
  const v = sectionValue(s, i, XONE, `ch${ch}_fader`);
  return typeof v === 'number' ? v : NaN;
}

/** Is an instrument muted by the arranger in a section? */
export function sectionMuted(s: S, section: string | number, dev: string): boolean {
  const x = sec(s, section);
  return !!part(s, x, dev)?.muted;
}

// ---- Elektron sequencers (Analog Rytm, Analog Four) ---------------------------------------
// Trigs are numbered 1..64 like the trig keys and the lesson text (trig 17 is page 2's first
// key); tracks by index (Rytm BD 0 … CB 11; Analog Four T1 0 … T4 3). `pattern` defaults to
// the instrument's active pattern.

/** The Elektron project of a device (undefined when it has none) */
export function proj(s: S, dev: string): Project | undefined {
  const id = inst(s, dev);
  const d = id ? s.instances[id]?.data : undefined;
  return isProject(d) ? d : undefined;
}

/** A pattern of a device's project: the active one, or `pattern` */
export function pat(s: S, dev: string, pattern?: string): Pattern | undefined {
  const p = proj(s, dev);
  if (!p) return undefined;
  return getPattern(p, (pattern && isPatternId(pattern) ? pattern : p.active) as PatternId);
}

/** The trigs (note trigs, not lock trigs) of a track, as trig numbers 1..64 */
export function trigs(s: S, dev: string, track: number, pattern?: string): number[] {
  const t = pat(s, dev, pattern)?.tracks[track];
  if (!t) return [];
  return Object.entries(t.steps).filter(([, x]) => !x.trigless).map(([k]) => Number(k) + 1).sort((a, b) => a - b);
}

/** Does a track hold note trigs on every one of these trig numbers? */
export const hasTrigs = (s: S, dev: string, track: number, nums: number[], pattern?: string) => {
  const t = new Set(trigs(s, dev, track, pattern));
  return nums.every(n => t.has(n));
};

/** A trig or lock trig by number (undefined when the step is empty) */
export function trig(s: S, dev: string, track: number, n: number, pattern?: string): Step | undefined {
  return pat(s, dev, pattern)?.tracks[track]?.steps[n - 1];
}

/** The note a trig plays: its own NOTE, else the track's (Analog Four: MIDI note; Rytm: 60 = the sound's pitch) */
export function noteOf(s: S, dev: string, track: number, n: number, pattern?: string): number | undefined {
  const t = pat(s, dev, pattern)?.tracks[track];
  const x = t?.steps[n - 1];
  if (!t || !x || x.trigless) return undefined;
  return x.note ?? t.note;
}

/** A trig's velocity: its own, else the track's */
export function velOf(s: S, dev: string, track: number, n: number, pattern?: string): number | undefined {
  const t = pat(s, dev, pattern)?.tracks[track];
  const x = t?.steps[n - 1];
  if (!t || !x || x.trigless) return undefined;
  return x.vel ?? t.vel;
}

/** A trig's note length in steps (one step = a 16th): its own LEN, else the track's */
export function lenOf(s: S, dev: string, track: number, n: number, pattern?: string): number | undefined {
  const t = pat(s, dev, pattern)?.tracks[track];
  const x = t?.steps[n - 1];
  if (!t || !x || x.trigless) return undefined;
  const i = x.len ?? t.len;
  return NOTE_LENGTHS[Math.max(0, Math.min(NOTE_LENGTHS.length - 1, Math.round(i)))];
}

/** Trig numbers of a track that lock a parameter (lock key: the control id without the track prefix) */
export function lockedTrigs(s: S, dev: string, track: number, key: string, pattern?: string): number[] {
  const t = pat(s, dev, pattern)?.tracks[track];
  if (!t) return [];
  return Object.entries(t.steps).filter(([, x]) => x.locks && key in x.locks).map(([k]) => Number(k) + 1).sort((a, b) => a - b);
}

/** Every trig of a pattern with a condition, as [track, trig number, condition] */
export function conditions(s: S, dev: string, pattern?: string): [number, number, string][] {
  const p = pat(s, dev, pattern);
  if (!p) return [];
  const out: [number, number, string][] = [];
  p.tracks.forEach((t, ti) => Object.entries(t.steps).forEach(([k, x]) => { if (x.cond) out.push([ti, Number(k) + 1, x.cond]); }));
  return out;
}

/** Number of parameter locks (one per locked parameter per trig) in a pattern */
export function lockCount(s: S, dev: string, pattern?: string): number {
  const p = pat(s, dev, pattern);
  if (!p) return 0;
  return p.tracks.reduce((n, t) => n + Object.values(t.steps).reduce((m, x) => m + Object.keys(x.locks ?? {}).length, 0), 0);
}

/** Tracks of a pattern that hold note trigs */
export function busyTracks(s: S, dev: string, pattern?: string): number[] {
  const p = pat(s, dev, pattern);
  if (!p) return [];
  return p.tracks.map((t, i) => (Object.values(t.steps).some(x => !x.trigless) ? i : -1)).filter(i => i >= 0);
}

/** Pattern SWING, 50..80 % (NaN without a project) */
export const pswing = (s: S, dev: string, pattern?: string) => pat(s, dev, pattern)?.swing ?? NaN;

/** Pattern LENGTH in steps (NaN without a project) */
export const plen = (s: S, dev: string, pattern?: string) => pat(s, dev, pattern)?.length ?? NaN;

/** The trig numbers 1..64 of a bar (bar 1 = 1..16) */
export const barOf = (n: number) => Math.floor((n - 1) / 16) + 1;

// ---- music ----------------------------------------------------------------------------

/** Pitch class 0..11 of a MIDI note (A = 9) */
export const pc = (note: number) => ((Math.round(note) % 12) + 12) % 12;

/** A natural minor (A B C D E F G) and A minor pentatonic (A C D E G) as pitch classes */
export const A_MINOR = [9, 11, 0, 2, 4, 5, 7];
export const A_MINOR_PENTA = [9, 0, 2, 4, 7];

/** Is every note in one major / natural minor key (any of the 12)? */
export function oneKey(notes: number[]): boolean {
  const pcs = new Set(notes.map(pc));
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  for (let root = 0; root < 12; root++) {
    const scale = new Set(MAJOR.map(x => (x + root) % 12));
    if ([...pcs].every(x => scale.has(x))) return true;
  }
  return false;
}
