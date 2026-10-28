// ============================================================================
// Elektron sequencer - immutable edits
//
// Every function takes a Project and returns a new Project with structural
// sharing (untouched patterns / tracks / steps keep their identity, which keeps
// the scheduler's compile cache warm). Inputs are never mutated, so these are
// safe inside `updateData(d => ...)` whether the host passes plain objects or
// drafts.
//
//   ctx.updateData(d => toggleTrig(asProject(d), 'A01', track, step))
// ============================================================================

import {
  LEN_DEFAULT, MASTER_MAX, MAX_STEPS, NOTE_LENGTHS, RETRIG_RATES, RETRIG_VEL_MAX, RETRIG_VEL_MIN, SPEEDS,
  SWING_MAX, SWING_MIN, TEMPO_MAX, TEMPO_MIN,
  type ChangeMode, type Pattern, type PatternId, type PlayMode, type Project, type Retrig, type SongRow,
  type Speed, type Step, type Track, type TrackDefaults,
} from './types';
import { createTrack, getPattern, isPatternId, normalizePattern } from './project';
import { normalizeCondition } from './conditions';

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** Step fields an encoder can lock by returning these keys from LockOptions.lockKey */
export const STEP_FIELDS = ['note', 'vel', 'len', 'micro'] as const;
export type StepField = (typeof STEP_FIELDS)[number];
export const isStepField = (k: string): k is StepField => (STEP_FIELDS as readonly string[]).includes(k);

/** Field updates: a value sets it, null (or false / 0 micro / '' cond) removes it */
export type StepPatch = { [K in keyof Step]?: Step[K] | null | false };

// ----------------------------------------------------------------------------
// Structural helpers
// ----------------------------------------------------------------------------

export function withPattern(p: Project, id: PatternId, fn: (pat: Pattern) => Pattern): Project {
  if (!isPatternId(id)) return p;
  const cur = getPattern(p, id);
  const next = fn(cur);
  if (next === cur) return p;
  return { ...p, patterns: { ...p.patterns, [id]: next } };
}

export function withTrack(p: Project, id: PatternId, track: number, fn: (t: Track) => Track): Project {
  if (!(track >= 0 && track < p.tracks)) return p;
  return withPattern(p, id, pat => {
    const cur = pat.tracks[track] ?? createTrack(p.defaults[track]);
    const next = fn(cur);
    if (next === cur) return pat;
    const tracks = pat.tracks.slice();
    for (let i = tracks.length; i < p.tracks; i++) tracks[i] = createTrack(p.defaults[i]);
    tracks[track] = next;
    return { ...pat, tracks };
  });
}

/** Rewrite several steps of one track; fn returns the new step, or undefined to remove it */
export function withSteps(
  p: Project, id: PatternId, track: number, steps: readonly number[],
  fn: (s: Step | undefined, step: number) => Step | undefined,
): Project {
  return withTrack(p, id, track, t => {
    let out: Track['steps'] | null = null;
    for (const i of steps) {
      if (!(Number.isInteger(i) && i >= 0 && i < MAX_STEPS)) continue;
      const cur = (out ?? t.steps)[i];
      const next = fn(cur, i);
      if (next === cur) continue;
      out ??= { ...t.steps };
      if (next) out[i] = next;
      else delete out[i];
    }
    return out ? { ...t, steps: out } : t;
  });
}

export function withStep(p: Project, id: PatternId, track: number, step: number, fn: (s: Step | undefined) => Step | undefined): Project {
  return withSteps(p, id, track, [step], s => fn(s));
}

function cleanRetrig(r: Retrig): Retrig {
  return {
    rate: clampInt(r.rate, 0, RETRIG_RATES.length - 1),
    len: clampInt(r.len, 0, NOTE_LENGTHS.length - 1),
    vel: clampInt(r.vel, RETRIG_VEL_MIN, RETRIG_VEL_MAX),
  };
}

/** New step = `s` with `patch` applied (values clamped, empty fields dropped) */
export function patchStep(s: Step, patch: StepPatch): Step {
  const out: Step = { ...s };
  const o = out as Record<string, unknown>;
  for (const k in patch) {
    const key = k as keyof Step;
    const v = patch[key];
    if (v === null || v === undefined || v === false) { delete o[key]; continue; }
    switch (key) {
      case 'note': o.note = clampInt(v as number, 0, 127); break;
      case 'vel': o.vel = clampInt(v as number, 1, 127); break;
      case 'len': o.len = clampInt(v as number, 0, NOTE_LENGTHS.length - 1); break;
      case 'micro': { const m = clampInt(v as number, -23, 23); if (m) o.micro = m; else delete o.micro; break; }
      case 'cond': { const c = normalizeCondition(v); if (c) o.cond = c; else delete o.cond; break; }
      case 'retrig': o.retrig = cleanRetrig(v as Retrig); break;
      case 'locks': {
        const l = v as Record<string, number>;
        if (Object.keys(l).length) o.locks = { ...l }; else delete o.locks;
        break;
      }
      default: o[key] = v; // trigless / slide / pslide / accent: true
    }
  }
  return out;
}

const isEmptyLockTrig = (s: Step) => s.trigless === true && !s.locks && s.note === undefined && s.vel === undefined && s.len === undefined;

// ----------------------------------------------------------------------------
// Trigs
// ----------------------------------------------------------------------------

/** Tap on a trig key: add a note trig (with `init`) or remove the trig and everything it holds */
export function toggleTrig(p: Project, id: PatternId, track: number, step: number, init: Step = {}): Project {
  return withStep(p, id, track, step, s => (s ? undefined : { ...init }));
}

export function setTrig(p: Project, id: PatternId, track: number, step: number, on: boolean, init: Step = {}): Project {
  return withStep(p, id, track, step, s => (on ? s ?? { ...init } : undefined));
}

/** Replace a step wholesale (null removes it) */
export function setStep(p: Project, id: PatternId, track: number, step: number, value: Step | null | undefined): Project {
  return withStep(p, id, track, step, () => (value ? { ...value } : undefined));
}

/**
 * Apply field changes to existing trigs. `create` decides what happens on empty
 * steps: 'note' adds a note trig, 'lock' a lock trig, false (default) skips them.
 */
export function updateSteps(
  p: Project, id: PatternId, track: number, steps: readonly number[], patch: StepPatch,
  opts: { create?: 'note' | 'lock' | false } = {},
): Project {
  return withSteps(p, id, track, steps, s => {
    if (!s) {
      if (!opts.create) return s;
      s = opts.create === 'lock' ? { trigless: true } : {};
    }
    return patchStep(s, patch);
  });
}

/**
 * Parameter lock on the given steps. `key` is a device parameter key, or a step
 * field ('note' | 'vel' | 'len' | 'micro'). value null removes the lock.
 * Empty steps get a lock trig (hardware: turning an encoder while holding an
 * empty step places a trigless lock trig) unless `create` is false.
 * A lock trig left with nothing to lock is removed.
 */
export function setLock(
  p: Project, id: PatternId, track: number, steps: readonly number[], key: string, value: number | null,
  opts: { create?: boolean } = {},
): Project {
  const create = opts.create !== false;
  return withSteps(p, id, track, steps, s => {
    if (!s) {
      if (value === null || !create) return s;
      s = { trigless: true };
    }
    let next: Step;
    if (isStepField(key)) {
      next = patchStep(s, { [key]: value } as StepPatch);
    } else {
      const has = !!s.locks && key in s.locks;
      if (value === null && !has) return s;
      if (value !== null && has && s.locks![key] === value) return s;
      const locks = { ...(s.locks ?? {}) };
      if (value === null) delete locks[key];
      else locks[key] = value;
      next = { ...s };
      if (Object.keys(locks).length) next.locks = locks;
      else delete next.locks;
    }
    return isEmptyLockTrig(next) ? undefined : next;
  });
}

/** Remove every parameter lock (and the trig's own note/vel/len locks when `fields`) from the steps */
export function clearLocks(p: Project, id: PatternId, track: number, steps: readonly number[], opts: { fields?: boolean } = {}): Project {
  return withSteps(p, id, track, steps, s => {
    if (!s) return s;
    const next = patchStep(s, opts.fields ? { locks: null, note: null, vel: null, len: null } : { locks: null });
    return isEmptyLockTrig(next) ? undefined : next;
  });
}

// ----------------------------------------------------------------------------
// Tracks
// ----------------------------------------------------------------------------

/** TRIG page defaults of a track in a pattern */
export function setTrackDefault(p: Project, id: PatternId, track: number, field: keyof TrackDefaults, value: number): Project {
  const v = field === 'note' ? clampInt(value, 0, 127) : field === 'vel' ? clampInt(value, 1, 127) : clampInt(value, 0, NOTE_LENGTHS.length - 1);
  return withTrack(p, id, track, t => (t[field] === v ? t : { ...t, [field]: v }));
}

export function setTrackMute(p: Project, id: PatternId, track: number, mute: boolean): Project {
  return withTrack(p, id, track, t => {
    if (!!t.mute === mute) return t;
    const next = { ...t };
    if (mute) next.mute = true;
    else delete next.mute;
    return next;
  });
}

/** Track trig probability 0..100 % for trigs without a condition (100 = always) */
export function setTrackProb(p: Project, id: PatternId, track: number, prob: number): Project {
  const v = clampInt(prob, 0, 100);
  return withTrack(p, id, track, t => {
    if ((t.prob ?? 100) === v) return t;
    const next = { ...t };
    if (v < 100) next.prob = v;
    else delete next.prob;
    return next;
  });
}

/** PER TRACK length / speed of one track (null = follow the pattern) */
export function setTrackScale(p: Project, id: PatternId, track: number, patch: { length?: number | null; speed?: Speed | null }): Project {
  return withTrack(p, id, track, t => {
    const next = { ...t };
    if (patch.length === null) delete next.length;
    else if (patch.length !== undefined) next.length = clampInt(patch.length, 1, MAX_STEPS);
    if (patch.speed === null) delete next.speed;
    else if (patch.speed !== undefined && (SPEEDS as readonly string[]).includes(patch.speed)) next.speed = patch.speed;
    return next;
  });
}

/** Clear every trig of a track (keeps the track's defaults) */
export function clearTrack(p: Project, id: PatternId, track: number): Project {
  return withTrack(p, id, track, t => (Object.keys(t.steps).length ? { ...t, steps: {} } : t));
}

// ----------------------------------------------------------------------------
// Patterns
// ----------------------------------------------------------------------------

export type PatternSettings = Partial<Pick<Pattern, 'name' | 'length' | 'speed' | 'scaleMode' | 'master' | 'change' | 'swing' | 'kit'>>;

export function updatePatternSettings(p: Project, id: PatternId, patch: PatternSettings): Project {
  return withPattern(p, id, pat => {
    const n: Pattern = { ...pat };
    if (patch.name !== undefined) n.name = String(patch.name).slice(0, 16);
    if (patch.length !== undefined) n.length = clampInt(patch.length, 1, MAX_STEPS);
    if (patch.speed !== undefined && (SPEEDS as readonly string[]).includes(patch.speed)) n.speed = patch.speed;
    if (patch.scaleMode !== undefined) {
      const mode = patch.scaleMode === 'track' ? 'track' : 'pattern';
      // Entering PER TRACK: the master length / change start at the pattern length, so playback doesn't change
      if (mode === 'track' && pat.scaleMode !== 'track') {
        if (patch.master === undefined) n.master = n.length;
        if (patch.change === undefined) n.change = n.length;
      }
      n.scaleMode = mode;
    }
    if (patch.master !== undefined) n.master = clampInt(patch.master, 0, MASTER_MAX);
    if (patch.change !== undefined) n.change = clampInt(patch.change, 0, MASTER_MAX);
    if (patch.swing !== undefined) n.swing = clampInt(patch.swing, SWING_MIN, SWING_MAX);
    if (patch.kit !== undefined) n.kit = String(patch.kit);
    return n;
  });
}

/** Empty a pattern slot */
export function clearPattern(p: Project, id: PatternId): Project {
  if (!p.patterns[id]) return p;
  const patterns = { ...p.patterns };
  delete patterns[id];
  return { ...p, patterns };
}

/** Deep copy of a pattern for a clipboard (null for an empty slot) */
export function copyPattern(p: Project, id: PatternId): Pattern | null {
  const pat = p.patterns[id];
  return pat ? (JSON.parse(JSON.stringify(pat)) as Pattern) : null;
}

/** Paste a copied pattern into a slot (normalised to this project's track count) */
export function pastePattern(p: Project, id: PatternId, pattern: Pattern | null): Project {
  if (!isPatternId(id)) return p;
  if (!pattern) return clearPattern(p, id);
  return { ...p, patterns: { ...p.patterns, [id]: normalizePattern(JSON.parse(JSON.stringify(pattern)), p.defaults) } };
}

export function setActive(p: Project, id: PatternId): Project {
  return isPatternId(id) && p.active !== id ? { ...p, active: id } : p;
}

export function setPlayMode(p: Project, mode: PlayMode): Project {
  return p.mode === mode ? p : { ...p, mode };
}

export function setChangeMode(p: Project, changeMode: ChangeMode): Project {
  return p.changeMode === changeMode ? p : { ...p, changeMode };
}

// ----------------------------------------------------------------------------
// Chain
// ----------------------------------------------------------------------------

export function setChain(p: Project, ids: readonly PatternId[]): Project {
  return { ...p, chain: ids.filter(isPatternId).slice(0, 256) };
}

export function chainAdd(p: Project, id: PatternId, at = p.chain.length): Project {
  if (!isPatternId(id) || p.chain.length >= 256) return p;
  const chain = p.chain.slice();
  chain.splice(Math.max(0, Math.min(chain.length, at)), 0, id);
  return { ...p, chain };
}

export function chainRemove(p: Project, index: number): Project {
  if (!(index >= 0 && index < p.chain.length)) return p;
  const chain = p.chain.slice();
  chain.splice(index, 1);
  return { ...p, chain };
}

export function chainMove(p: Project, from: number, to: number): Project {
  if (!(from >= 0 && from < p.chain.length) || from === to) return p;
  const chain = p.chain.slice();
  const [x] = chain.splice(from, 1);
  chain.splice(Math.max(0, Math.min(chain.length, to)), 0, x);
  return { ...p, chain };
}

// ----------------------------------------------------------------------------
// Song
// ----------------------------------------------------------------------------

export type SongRowPatch = {
  pattern?: PatternId; repeats?: number; length?: number | null; tempo?: number | null; mutes?: number[] | null; transpose?: number | null;
};

function patchRow(r: SongRow, patch: SongRowPatch, tracks: number): SongRow {
  const n: SongRow = { ...r };
  if (patch.pattern !== undefined && isPatternId(patch.pattern)) n.pattern = patch.pattern;
  if (patch.repeats !== undefined) n.repeats = clampInt(patch.repeats, 1, 99);
  if (patch.length === null) delete n.length;
  else if (patch.length !== undefined) n.length = clampInt(patch.length, 1, MASTER_MAX);
  if (patch.tempo === null) delete n.tempo;
  else if (patch.tempo !== undefined) n.tempo = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(patch.tempo * 10) / 10));
  if (patch.mutes === null) delete n.mutes;
  else if (patch.mutes !== undefined) n.mutes = Array.from(new Set(patch.mutes.filter(t => t >= 0 && t < tracks))).sort((a, b) => a - b);
  if (patch.transpose === null || patch.transpose === 0) delete n.transpose;
  else if (patch.transpose !== undefined) n.transpose = clampInt(patch.transpose, -48, 48);
  return n;
}

export function songAddRow(p: Project, row: SongRowPatch = {}, at = p.song.rows.length): Project {
  const base: SongRow = { pattern: p.active, repeats: 1 };
  const rows = p.song.rows.slice();
  rows.splice(Math.max(0, Math.min(rows.length, at)), 0, patchRow(base, row, p.tracks));
  return { ...p, song: { ...p.song, rows } };
}

export function songRemoveRow(p: Project, index: number): Project {
  if (!(index >= 0 && index < p.song.rows.length)) return p;
  const rows = p.song.rows.slice();
  rows.splice(index, 1);
  const song = { ...p.song, rows };
  if (song.loopRow !== undefined) song.loopRow = Math.max(0, Math.min(rows.length - 1, song.loopRow > index ? song.loopRow - 1 : song.loopRow));
  return { ...p, song };
}

export function songMoveRow(p: Project, from: number, to: number): Project {
  const rows = p.song.rows;
  if (!(from >= 0 && from < rows.length) || !(to >= 0 && to < rows.length) || from === to) return p;
  const next = rows.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return { ...p, song: { ...p.song, rows: next } };
}

export function songUpdateRow(p: Project, index: number, patch: SongRowPatch): Project {
  const r = p.song.rows[index];
  if (!r) return p;
  const rows = p.song.rows.slice();
  rows[index] = patchRow(r, patch, p.tracks);
  return { ...p, song: { ...p.song, rows } };
}

export function songToggleMute(p: Project, index: number, track: number): Project {
  const r = p.song.rows[index];
  if (!r) return p;
  const m = new Set(r.mutes ?? []);
  if (m.has(track)) m.delete(track);
  else m.add(track);
  return songUpdateRow(p, index, { mutes: m.size ? Array.from(m) : null });
}

export function setSongLoop(p: Project, loop: boolean, loopRow?: number): Project {
  const song = { ...p.song, loop };
  if (loopRow !== undefined) song.loopRow = clampInt(loopRow, 0, Math.max(0, p.song.rows.length - 1));
  return { ...p, song };
}

export function setSongName(p: Project, name: string): Project {
  return { ...p, song: { ...p.song, name: name.slice(0, 16) } };
}

/** Default LEN of a new trig when none is stored (exported for UIs) */
export const DEFAULT_LEN = LEN_DEFAULT;
