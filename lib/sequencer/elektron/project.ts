// ============================================================================
// Elektron sequencer - project factories, normalisation and read helpers
// (no React, no audio). Writes live in edit.ts.
// ============================================================================

import {
  BANKS, CHANGE_MODES, LEN_DEFAULT, MASTER_MAX, MAX_STEPS, NOTE_LENGTHS, PATTERNS_PER_BANK, PLAY_MODES,
  RETRIG_RATES, RETRIG_VEL_MAX, RETRIG_VEL_MIN, SPEEDS, SWING_MAX, SWING_MIN, TEMPO_MAX, TEMPO_MIN,
  type ChangeMode, type Locks, type Pattern, type PatternId, type PlayMode, type Project, type Retrig,
  type Song, type SongRow, type Speed, type Step, type Track, type TrackDefaults,
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
    change: init.change ?? 16,
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
    song: { name: '', rows: [], loop: true },
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

export function normalizeStep(x: unknown): Step | undefined {
  if (!isObj(x)) return x === true || x === 1 ? {} : undefined;
  const s: Step = {};
  if (x.trigless === true) s.trigless = true;
  if (typeof x.note === 'number') s.note = int(x.note, 0, 127, 60);
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
  const l = cleanLocks(x.locks);
  if (l) s.locks = l;
  return s;
}

function normalizeTrack(x: unknown, d: TrackDefaults): Track {
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
  return t;
}

export function normalizePattern(x: unknown, defaults: TrackDefaults[]): Pattern {
  const p = createPattern(defaults);
  if (!isObj(x)) return p;
  if (typeof x.name === 'string') p.name = x.name.slice(0, 16);
  p.length = int(x.length, 1, MAX_STEPS, 16);
  if (typeof x.speed === 'string' && (SPEEDS as readonly string[]).includes(x.speed)) p.speed = x.speed as Speed;
  p.scaleMode = x.scaleMode === 'track' ? 'track' : 'pattern';
  p.master = int(x.master, 0, MASTER_MAX, 16);
  p.change = int(x.change, 0, MASTER_MAX, 16);
  p.swing = int(x.swing, SWING_MIN, SWING_MAX, SWING_MIN);
  if (typeof x.kit === 'string') p.kit = x.kit;
  const tracks = Array.isArray(x.tracks) ? x.tracks : [];
  p.tracks = defaults.map((d, i) => normalizeTrack(tracks[i], d));
  return p;
}

function normalizeRow(x: unknown, n: number): SongRow | null {
  if (!isObj(x) || !isPatternId(x.pattern)) return null;
  const r: SongRow = { pattern: x.pattern, repeats: int(x.repeats, 1, 99, 1) };
  if (typeof x.length === 'number') r.length = int(x.length, 1, MASTER_MAX, 16);
  if (typeof x.tempo === 'number') r.tempo = num(x.tempo, TEMPO_MIN, TEMPO_MAX, 120);
  if (Array.isArray(x.mutes)) {
    const m = x.mutes.filter((t): t is number => typeof t === 'number' && Number.isInteger(t) && t >= 0 && t < n);
    r.mutes = Array.from(new Set(m)).sort((a, b) => a - b);
  }
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
    const song: Song = { name: typeof s.name === 'string' ? s.name.slice(0, 16) : '', rows, loop: s.loop !== false };
    if (typeof s.loopRow === 'number') song.loopRow = int(s.loopRow, 0, Math.max(0, rows.length - 1), 0);
    base.song = song;
  }
  if (typeof src.mode === 'string' && (PLAY_MODES as readonly string[]).includes(src.mode)) base.mode = src.mode as PlayMode;
  if (typeof src.changeMode === 'string' && (CHANGE_MODES as readonly string[]).includes(src.changeMode)) base.changeMode = src.changeMode as ChangeMode;
  return base;
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

/** Steps of the track that hold a lock for `key` */
export function lockedSteps(p: Project, id: PatternId, track: number, key: string): number[] {
  const t = p.patterns[id]?.tracks[track];
  if (!t) return [];
  const out: number[] = [];
  for (const k in t.steps) if (t.steps[k].locks && key in t.steps[k].locks!) out.push(Number(k));
  return out.sort((a, b) => a - b);
}
