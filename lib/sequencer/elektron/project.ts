// ============================================================================
// Elektron sequencer - project factories, normalisation and read helpers
// (no React, no audio). Writes live in edit.ts.
// ============================================================================

import {
  BANKS, CHANGE_MODES, CHANGE_OFF, CHORD_MAX, CHORD_SPAN, LEN_DEFAULT, MASTER_MAX, MAX_STEPS, NOTE_LENGTHS, PAGE_SIZE, PATTERNS_PER_BANK,
  PLAY_MODES, QUANTIZE_MAX, RETRIG_RATES, RETRIG_VEL_MAX, RETRIG_VEL_MIN, SPEEDS, SWING_MAX, SWING_MIN, TEMPO_MAX,
  TEMPO_MIN,
  type ChangeMode, type Locks, type Pattern, type PatternId, type PlayMode, type Project, type Retrig,
  type Song, type SongEntry, type SongRow, type Speed, type Step, type Track, type TrackDefaults,
} from './types';
import { normalizeCondition } from './conditions';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const int = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export const DEFAULT_TRACK: Readonly<TrackDefaults> = { note: 60, vel: 100, len: LEN_DEFAULT };

// ----------------------------------------------------------------------------
// Pattern ids
// ----------------------------------------------------------------------------

/** bank 0..7 (A-H), index 0..15 -> "A01" */
export function patternId(bank: number, index: number): PatternId {
  const b = BANKS[Math.min(BANKS.length - 1, Math.max(0, bank))];
  const n = Math.min(PATTERNS_PER_BANK, Math.max(1, index + 1));
  return `${b}${n < 10 ? '0' : ''}${n}`;
}

/** "C07" -> { bank: 2, index: 6 }, or null when it isn't a pattern id */
export function parsePatternId(id: string): { bank: number; index: number } | null {
  const m = /^([A-H])(\d{2})$/.exec(id);
  if (!m) return null;
  const n = Number(m[2]);
  if (n < 1 || n > PATTERNS_PER_BANK) return null;
  return { bank: m[1].charCodeAt(0) - 65, index: n - 1 };
}

export const isPatternId = (id: unknown): id is PatternId => typeof id === 'string' && parsePatternId(id) !== null;

/** All 128 ids, A01 .. H16 */
export const ALL_PATTERN_IDS: readonly PatternId[] = BANKS.flatMap((_, b) =>
  Array.from({ length: PATTERNS_PER_BANK }, (__, i) => patternId(b, i)),
);

// ----------------------------------------------------------------------------
// Factories
// ----------------------------------------------------------------------------

export function createTrack(d: Partial<TrackDefaults> = {}): Track {
  return { steps: {}, note: d.note ?? DEFAULT_TRACK.note, vel: d.vel ?? DEFAULT_TRACK.vel, len: d.len ?? DEFAULT_TRACK.len };
}

export function createPattern(defaults: number | readonly Partial<TrackDefaults>[], init: Partial<Omit<Pattern, 'tracks'>> = {}): Pattern {
  const list = typeof defaults === 'number' ? Array.from({ length: defaults }, () => ({})) : defaults;
  return {
    name: init.name ?? '',
    length: init.length ?? 16,
    speed: init.speed ?? '1x',
    scaleMode: init.scaleMode ?? 'pattern',
    master: init.master ?? 16,
    // CHNG OFF: a cued pattern change happens at the end of the pattern (A4 MKII manual p.49)
    change: init.change ?? CHANGE_OFF,
    swing: init.swing ?? SWING_MIN,
    kit: init.kit ?? '',
    tracks: list.map(d => createTrack(d)),
  };
}

export interface CreateProjectOptions {
  tracks: number;
  /** Trig defaults for every track, or one entry per track */
  defaults?: Partial<TrackDefaults> | Partial<TrackDefaults>[];
  active?: PatternId;
  patterns?: Record<PatternId, Pattern>;
  mode?: PlayMode;
  changeMode?: ChangeMode;
}

export function createProject(opts: CreateProjectOptions): Project {
  const n = Math.max(1, Math.round(opts.tracks));
  const d = opts.defaults;
  const defaults: TrackDefaults[] = Array.from({ length: n }, (_, i) => {
    const one = Array.isArray(d) ? d[i] ?? {} : d ?? {};
    return { note: one.note ?? DEFAULT_TRACK.note, vel: one.vel ?? DEFAULT_TRACK.vel, len: one.len ?? DEFAULT_TRACK.len };
  });
  return {
    v: 1,
    tracks: n,
    defaults,
    active: opts.active ?? 'A01',
    patterns: opts.patterns ?? {},
    chain: [],
    // A song plays its rows once and stops, as on the hardware (setSongLoop for a loop)
    song: { name: '', rows: [], loop: false },
    mode: opts.mode ?? 'pattern',
    changeMode: opts.changeMode ?? 'sequential',
  };
}

// ----------------------------------------------------------------------------
// Normalisation (saved data, hand-written presets, older versions)
// ----------------------------------------------------------------------------

function cleanLocks(x: unknown): Locks | undefined {
  if (!isObj(x)) return undefined;
  let out: Locks | undefined;
  for (const k in x) {
    const v = x[k];
    if (typeof v === 'number' && Number.isFinite(v)) (out ??= {})[k] = v;
  }
  return out;
}

function cleanRetrig(x: unknown): Retrig | undefined {
  if (!isObj(x)) return undefined;
  return {
    rate: int(x.rate, 0, RETRIG_RATES.length - 1, 9),
    len: int(x.len, 0, NOTE_LENGTHS.length - 1, LEN_DEFAULT),
    vel: int(x.vel, RETRIG_VEL_MIN, RETRIG_VEL_MAX, 0),
  };
}

/** Chord offsets as stored: integers in +-CHORD_SPAN, non-zero, unique, at most CHORD_MAX - 1 */
export function cleanChord(x: unknown): number[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: number[] = [];
  for (const v of x) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const o = Math.max(-CHORD_SPAN, Math.min(CHORD_SPAN, Math.round(v)));
    if (o !== 0 && !out.includes(o) && out.length < CHORD_MAX - 1) out.push(o);
  }
  return out.length ? out : undefined;
}

export function normalizeStep(x: unknown): Step | undefined {
  if (!isObj(x)) return x === true || x === 1 ? {} : undefined;
  const s: Step = {};
  if (x.trigless === true) s.trigless = true;
  if (typeof x.note === 'number') s.note = int(x.note, 0, 127, 60);
  const ch = cleanChord(x.chord);
  if (ch) s.chord = ch;
  if (typeof x.vel === 'number') s.vel = int(x.vel, 1, 127, 100);
  if (typeof x.len === 'number') s.len = int(x.len, 0, NOTE_LENGTHS.length - 1, LEN_DEFAULT);
  if (typeof x.micro === 'number') { const m = int(x.micro, -23, 23, 0); if (m) s.micro = m; }
  const c = normalizeCondition(x.cond);
  if (c) s.cond = c;
  const r = cleanRetrig(x.retrig);
  if (r) s.retrig = r;
  if (x.slide === true) s.slide = true;
  if (x.pslide === true) s.pslide = true;
  if (x.accent === true) s.accent = true;
  if (x.mute === true) s.mute = true;
  const l = cleanLocks(x.locks);
  if (l) s.locks = l;
  return s;
}

/** Normalise one saved track (steps, defaults, scale, mutes, probability, quantize) */
export function normalizeTrack(x: unknown, d: TrackDefaults): Track {
  const t = createTrack(d);
  if (!isObj(x)) return t;
  t.note = int(x.note, 0, 127, d.note);
  t.vel = int(x.vel, 1, 127, d.vel);
  t.len = int(x.len, 0, NOTE_LENGTHS.length - 1, d.len);
  if (isObj(x.steps)) {
    for (const k in x.steps) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i >= MAX_STEPS) continue;
      const s = normalizeStep(x.steps[k]);
      if (s) t.steps[i] = s;
    }
  }
  if (typeof x.length === 'number') t.length = int(x.length, 1, MAX_STEPS, 16);
  if (typeof x.speed === 'string' && (SPEEDS as readonly string[]).includes(x.speed)) t.speed = x.speed as Speed;
  if (x.mute === true) t.mute = true;
  if (typeof x.prob === 'number') { const pr = int(x.prob, 0, 100, 100); if (pr < 100) t.prob = pr; }
  if (typeof x.quantize === 'number') { const q = int(x.quantize, 0, QUANTIZE_MAX, 0); if (q) t.quantize = q; }
  return t;
}

/** Sorted, unique step / track indices in [0, n) */
function indexList(x: unknown, n: number): number[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const v = x.filter((t): t is number => typeof t === 'number' && Number.isInteger(t) && t >= 0 && t < n);
  return Array.from(new Set(v)).sort((a, b) => a - b);
}

export function normalizePattern(x: unknown, defaults: TrackDefaults[]): Pattern {
  const p = createPattern(defaults);
  if (!isObj(x)) return p;
  if (typeof x.name === 'string') p.name = x.name.slice(0, 16);
  p.length = int(x.length, 1, MAX_STEPS, 16);
  if (typeof x.speed === 'string' && (SPEEDS as readonly string[]).includes(x.speed)) p.speed = x.speed as Speed;
  p.scaleMode = x.scaleMode === 'track' ? 'track' : 'pattern';
  p.master = int(x.master, 0, MASTER_MAX, 16);
  p.change = int(x.change, 0, MASTER_MAX, CHANGE_OFF);
  p.swing = int(x.swing, SWING_MIN, SWING_MAX, SWING_MIN);
  const sw = indexList(x.swingTrigs, MAX_STEPS);
  if (sw) p.swingTrigs = sw;
  if (typeof x.kit === 'string') p.kit = x.kit;
  if (typeof x.tempo === 'number' && Number.isFinite(x.tempo)) p.tempo = num(x.tempo, TEMPO_MIN, TEMPO_MAX, 120);
  if (typeof x.quantize === 'number') { const q = int(x.quantize, 0, QUANTIZE_MAX, 0); if (q) p.quantize = q; }
  const tracks = Array.isArray(x.tracks) ? x.tracks : [];
  p.tracks = defaults.map((d, i) => normalizeTrack(tracks[i], d));
  return p;
}

/** Song mutes and transpose of a pattern position (row or chain entry) */
function cleanEntry<T extends SongEntry>(out: T, x: Record<string, unknown>, n: number): T {
  const m = indexList(x.mutes, n);
  if (m) out.mutes = m;
  if (typeof x.transpose === 'number') { const tr = int(x.transpose, -48, 48, 0); if (tr) out.transpose = tr; }
  return out;
}

function normalizeRow(x: unknown, n: number): SongRow | null {
  if (!isObj(x) || !isPatternId(x.pattern)) return null;
  const r: SongRow = cleanEntry({ pattern: x.pattern, repeats: int(x.repeats, 1, 99, 1) }, x, n);
  if (Array.isArray(x.chain)) {
    const chain = x.chain
      .filter((e): e is Record<string, unknown> => isObj(e) && isPatternId(e.pattern))
      .slice(0, 255)
      .map(e => cleanEntry({ pattern: e.pattern as PatternId }, e, n));
    if (chain.length) r.chain = chain;
  }
  if (typeof x.length === 'number') r.length = int(x.length, 1, MASTER_MAX, 16);
  if (typeof x.tempo === 'number') r.tempo = num(x.tempo, TEMPO_MIN, TEMPO_MAX, 120);
  return r;
}

/**
 * Full normalisation of saved / hand-written data into a valid Project.
 * Use as `DeviceModule.data.migrate`. Unknown fields are dropped.
 */
export function migrateProject(saved: unknown, tracks: number, defaults?: Partial<TrackDefaults> | Partial<TrackDefaults>[]): Project {
  const src = isObj(saved) ? saved : {};
  const n = int(src.tracks, 1, 64, tracks);
  const base = createProject({ tracks: n, defaults });
  if (Array.isArray(src.defaults)) {
    base.defaults = base.defaults.map((d, i) => {
      const x = (src.defaults as unknown[])[i];
      return isObj(x)
        ? { note: int(x.note, 0, 127, d.note), vel: int(x.vel, 1, 127, d.vel), len: int(x.len, 0, NOTE_LENGTHS.length - 1, d.len) }
        : d;
    });
  }
  if (isPatternId(src.active)) base.active = src.active;
  if (isObj(src.patterns)) {
    for (const id in src.patterns) if (isPatternId(id)) base.patterns[id] = normalizePattern(src.patterns[id], base.defaults);
  }
  if (Array.isArray(src.chain)) base.chain = src.chain.filter(isPatternId).slice(0, 256);
  if (isObj(src.song)) {
    const s = src.song;
    const rows = Array.isArray(s.rows) ? s.rows.map(r => normalizeRow(r, n)).filter((r): r is SongRow => !!r) : [];
    const song: Song = { name: typeof s.name === 'string' ? s.name.slice(0, 16) : '', rows, loop: s.loop === true };
    if (typeof s.loopRow === 'number') song.loopRow = int(s.loopRow, 0, Math.max(0, rows.length - 1), 0);
    base.song = song;
  }
  if (typeof src.mode === 'string' && (PLAY_MODES as readonly string[]).includes(src.mode)) base.mode = src.mode as PlayMode;
  if (typeof src.changeMode === 'string' && (CHANGE_MODES as readonly string[]).includes(src.changeMode)) base.changeMode = src.changeMode as ChangeMode;
  const mutes = indexList(src.mutes, n);
  if (mutes?.length) base.mutes = mutes;
  if (src.tempoMode === 'pattern' || src.tempoMode === 'project') base.tempoMode = src.tempoMode;
  if (isObj(src.restore) && isPatternId(src.restore.id)) {
    const rp = src.restore.pattern;
    base.restore = { id: src.restore.id, pattern: isObj(rp) ? normalizePattern(rp, base.defaults) : null };
  }
  return base;
}

/**
 * DeviceModule.data for an Elektron-style instrument:
 *
 *   data: projectData({ tracks: 12, defaults: { note: 60, vel: 100 } }),
 *
 * `initial` creates an empty project; `migrate` repairs saved data and returns
 * it unchanged (same object) when it already is a valid project of this size.
 */
export function projectData(opts: CreateProjectOptions): { initial: () => Project; migrate: (saved: unknown) => unknown } {
  return {
    initial: () => createProject(opts),
    migrate: saved => (isProject(saved) && saved.tracks === Math.max(1, Math.round(opts.tracks)) ? saved : migrateProject(saved, opts.tracks, opts.defaults)),
  };
}

/** Cheap structural check (does not validate every step) */
export function isProject(x: unknown): x is Project {
  return isObj(x) && x.v === 1 && typeof x.tracks === 'number' && Array.isArray(x.defaults)
    && isObj(x.patterns) && typeof x.active === 'string' && Array.isArray(x.chain) && isObj(x.song);
}

const normalized = new WeakMap<object, Project>();
const emptyProjects = new Map<number, Project>();

/**
 * The project in `data`, normalised. Identity-preserving and cheap when `data`
 * already is a Project (call it freely in render functions).
 */
export function asProject(data: unknown, tracks = 4): Project {
  if (isProject(data)) return data;
  if (isObj(data)) {
    let p = normalized.get(data);
    if (!p) { p = migrateProject(data, tracks); normalized.set(data, p); }
    return p;
  }
  let p = emptyProjects.get(tracks);
  if (!p) { p = createProject({ tracks }); emptyProjects.set(tracks, p); }
  return p;
}

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------

const emptyPatterns = new WeakMap<TrackDefaults[], Pattern>();

/** The stored pattern, or the (shared, frozen) empty pattern for that project */
export function getPattern(p: Project, id: PatternId): Pattern {
  const stored = p.patterns[id];
  if (stored) return stored;
  let e = emptyPatterns.get(p.defaults);
  if (!e) {
    e = createPattern(p.defaults);
    e.tracks.forEach(t => { Object.freeze(t.steps); Object.freeze(t); });
    Object.freeze(e.tracks);
    Object.freeze(e);
    emptyPatterns.set(p.defaults, e);
  }
  return e;
}

export function getTrack(pattern: Pattern, track: number): Track | undefined {
  return pattern.tracks[track];
}

export function getStep(p: Project, id: PatternId, track: number, step: number): Step | undefined {
  return p.patterns[id]?.tracks[track]?.steps[step];
}

/** Effective length of a track (PER TRACK mode honours the track's own length) */
export function trackLength(pattern: Pattern, track: number): number {
  const t = pattern.tracks[track];
  const len = pattern.scaleMode === 'track' && t?.length ? t.length : pattern.length;
  return Math.min(MAX_STEPS, Math.max(1, len));
}

export function trackSpeed(pattern: Pattern, track: number): Speed {
  const t = pattern.tracks[track];
  return pattern.scaleMode === 'track' && t?.speed ? t.speed : pattern.speed;
}

export function stepHasLocks(s: Step | undefined): boolean {
  if (!s?.locks) return false;
  for (const _ in s.locks) return true;
  return false;
}

/** Does the step carry anything beyond a plain trig? (for LED markers) */
export function stepIsPlain(s: Step): boolean {
  for (const _ in s) return false;
  return true;
}

export function patternHasContent(pattern: Pattern | undefined): boolean {
  if (!pattern) return false;
  for (const t of pattern.tracks) for (const _ in t.steps) return true;
  return false;
}

/**
 * DeviceModule.studio.patterns: the patterns that hold trigs, for the song
 * arranger ("A01", or "A01 NAME" when named), in bank order.
 */
export function arrangerPatterns(data: unknown, tracks = 4): { id: PatternId; label?: string }[] {
  const p = asProject(data, tracks);
  const out: { id: PatternId; label?: string }[] = [];
  for (const id of ALL_PATTERN_IDS) {
    const pat = p.patterns[id];
    if (!patternHasContent(pat)) continue;
    out.push(pat!.name ? { id, label: `${id} ${pat!.name}` } : { id });
  }
  return out;
}

/** Sorted step indices of the track's note trigs (lesson checks: `trigSteps(...)` equals [0, 4, 8, 12]) */
export function trigSteps(p: Project, id: PatternId, track: number, opts: { trigless?: boolean } = {}): number[] {
  const t = p.patterns[id]?.tracks[track];
  if (!t) return [];
  const out: number[] = [];
  for (const k in t.steps) {
    const s = t.steps[k];
    if (!!s.trigless === !!opts.trigless) out.push(Number(k));
  }
  return out.sort((a, b) => a - b);
}

/**
 * The notes a trig plays: its note (`note`, already transposed when it comes from a TrigEvent),
 * then the notes of its chord (Step.chord offsets), clamped to 0..127, without repeats
 */
export function trigNotes(step: Step | undefined, note: number): number[] {
  const out = [Math.max(0, Math.min(127, Math.round(note)))];
  const ch = step?.chord;
  if (ch) for (const o of ch) { const n = Math.max(0, Math.min(127, out[0] + o)); if (!out.includes(n)) out.push(n); }
  return out;
}

/** Steps of the track that hold a lock for `key` */
export function lockedSteps(p: Project, id: PatternId, track: number, key: string): number[] {
  const t = p.patterns[id]?.tracks[track];
  if (!t) return [];
  const out: number[] = [];
  for (const k in t.steps) if (t.steps[k].locks && key in t.steps[k].locks!) out.push(Number(k));
  return out.sort((a, b) => a - b);
}

/** Steps of the track that carry a trig mute */
export function mutedSteps(p: Project, id: PatternId, track: number): number[] {
  const t = p.patterns[id]?.tracks[track];
  if (!t) return [];
  const out: number[] = [];
  for (const k in t.steps) if (t.steps[k].mute) out.push(Number(k));
  return out.sort((a, b) => a - b);
}

// ----------------------------------------------------------------------------
// Swing trigs
// ----------------------------------------------------------------------------

/** The default swing trigs: every second step (keys 2, 4, 6 ... 64) */
export const DEFAULT_SWING_TRIGS: readonly number[] = Object.freeze(Array.from({ length: MAX_STEPS / 2 }, (_, i) => i * 2 + 1));

/** The pattern's swing trigs (step indices 0..63) */
export function swingTrigs(pattern: Pattern): readonly number[] {
  return pattern.swingTrigs ?? DEFAULT_SWING_TRIGS;
}

/** Does `step` (0..63) carry a swing trig in this pattern? */
export function isSwingStep(pattern: Pattern, step: number): boolean {
  return pattern.swingTrigs ? pattern.swingTrigs.includes(step) : (step & 1) === 1;
}

// ----------------------------------------------------------------------------
// Song rows: a pattern, or a chain of patterns
// ----------------------------------------------------------------------------

/** Pattern positions in a song row (1 + its chain) */
export function rowSize(row: SongRow): number {
  return 1 + (row.chain?.length ?? 0);
}

/** Pattern position `pos` of a song row (0 = the row's own pattern, mutes and transpose) */
export function rowEntry(row: SongRow, pos: number): SongEntry {
  const n = row.chain?.length ?? 0;
  if (pos <= 0 || !n) return row;
  return row.chain![Math.min(pos, n) - 1];
}

// ----------------------------------------------------------------------------
// Pages, trig defaults, lock budget, program changes
// ----------------------------------------------------------------------------

/** Step indices of a page (0..3): [first, end) */
export function pageSteps(page: number): [number, number] {
  const p = Math.max(0, Math.min(MAX_STEPS / PAGE_SIZE - 1, Math.round(page)));
  return [p * PAGE_SIZE, (p + 1) * PAGE_SIZE];
}

/**
 * NOTE / VEL / LEN a trig gets when it is placed. On the Analog Four the NOTE
 * menu values are copied into each new trig, so changing them later only
 * affects trigs placed afterwards (A4 MKII manual p.45): pass this as the trig's
 * `init` (TrigKeys `stampDefaults`). The Rytm's TRIG page is a live default for
 * every unlocked trig (Rytm MKII manual p.43), so it places empty trigs.
 */
export function trackTrigDefaults(p: Project, id: PatternId, track: number): Step {
  const t = getPattern(p, id).tracks[track];
  const d = t ?? p.defaults[track] ?? DEFAULT_TRACK;
  return { note: d.note, vel: d.vel, len: d.len };
}

/**
 * Different parameters locked in a pattern: each (track, parameter) pair
 * counts once, however many trigs lock it (A4 MKII manual p.50: 128 at most,
 * Rytm MKII manual p.47: 72). NOTE / VEL / LEN / micro timing and conditions
 * are trig settings, not locks.
 */
export function lockedParamCount(pattern: Pattern | undefined): number {
  if (!pattern) return 0;
  let n = 0;
  for (const t of pattern.tracks) {
    const keys = new Set<string>();
    for (const k in t.steps) {
      const l = t.steps[k].locks;
      if (l) for (const key in l) keys.add(key);
    }
    n += keys.size;
  }
  return n;
}

/** MIDI program change 0..127 -> pattern A01..H16 (Rytm MKII manual p.22), null when out of range */
export function patternFromProgram(program: number): PatternId | null {
  const n = Math.round(program);
  if (!(n >= 0 && n < BANKS.length * PATTERNS_PER_BANK)) return null;
  return patternId(Math.floor(n / PATTERNS_PER_BANK), n % PATTERNS_PER_BANK);
}

/** Pattern -> MIDI program change 0..127 (PRG CH SEND), -1 for an invalid id */
export function programOfPattern(id: PatternId): number {
  const p = parsePatternId(id);
  return p ? p.bank * PATTERNS_PER_BANK + p.index : -1;
}
