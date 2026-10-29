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
  CHANGE_OFF, LEN_DEFAULT, MASTER_MAX, MAX_STEPS, NOTE_LENGTHS, PAGE_SIZE, QUANTIZE_MAX, RETRIG_RATES, RETRIG_VEL_MAX,
  RETRIG_VEL_MIN, SPEEDS, SWING_MAX, SWING_MIN, TEMPO_MAX, TEMPO_MIN, TRIG_CONDITIONS,
  type ChangeMode, type Pattern, type PatternId, type PlayMode, type Project, type Retrig, type SongEntry,
  type SongRow, type Speed, type Step, type TempoMode, type Track, type TrackDefaults,
} from './types';
import {
  DEFAULT_SWING_TRIGS, createPattern, createTrack, getPattern, isPatternId, lockedParamCount, normalizePattern,
  normalizeTrack, pageSteps, rowSize, trackLength,
} from './project';
import { normalizeCondition } from './conditions';

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/**
 * Step fields an encoder can write by returning these keys from LockOptions.lockKey
 * (numbers: 'cond' is an index into TRIG_CONDITIONS, 0 = none)
 */
export const STEP_FIELDS = ['note', 'vel', 'len', 'micro', 'cond'] as const;
export type StepField = (typeof STEP_FIELDS)[number];
export const isStepField = (k: string): k is StepField => (STEP_FIELDS as readonly string[]).includes(k);
/** lockKey value for the track's trig probability (a track setting, never a lock) */
export const TRACK_PROB_KEY = 'prob';

/** A step field as the number an encoder shows (cond -> TRIG_CONDITIONS index) */
export function stepFieldValue(s: Step | undefined, f: StepField): number | undefined {
  if (!s) return undefined;
  if (f === 'cond') return s.cond ? Math.max(0, TRIG_CONDITIONS.indexOf(s.cond)) : undefined;
  return s[f];
}

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
  opts: { create?: boolean; limit?: number } = {},
): Project {
  const create = opts.create !== false;
  // Lock budget: a parameter not locked yet on this track counts against the pattern's limit
  if (opts.limit !== undefined && value !== null && key !== 'cond' && !isStepField(key)) {
    const pat = getPattern(p, id);
    const t = pat.tracks[track];
    let has = false;
    if (t) for (const k in t.steps) if (t.steps[k].locks && key in t.steps[k].locks!) { has = true; break; }
    if (!has && lockedParamCount(pat) >= opts.limit) return p;
  }
  return withSteps(p, id, track, steps, s => {
    if (!s) {
      if (value === null || !create) return s;
      s = { trigless: true };
    }
    let next: Step;
    if (key === 'cond') {
      const c = value === null ? '' : TRIG_CONDITIONS[clampInt(value, 0, TRIG_CONDITIONS.length - 1)];
      if ((s.cond ?? '') === c) return s;
      next = patchStep(s, { cond: c || null });
    } else if (isStepField(key)) {
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

/**
 * PER TRACK length / speed of one track (null = follow the pattern).
 * `copyPages`: a length growing into new pages copies the existing ones (as
 * the hardware's TRACK column does, A4 MKII manual p.49).
 */
export function setTrackScale(
  p: Project, id: PatternId, track: number, patch: { length?: number | null; speed?: Speed | null }, opts: { copyPages?: boolean } = {},
): Project {
  const before = trackLength(getPattern(p, id), track);
  return withTrack(p, id, track, t => {
    let next = { ...t };
    if (patch.length === null) delete next.length;
    else if (patch.length !== undefined) next.length = clampInt(patch.length, 1, MAX_STEPS);
    if (patch.speed === null) delete next.speed;
    else if (patch.speed !== undefined && (SPEEDS as readonly string[]).includes(patch.speed)) next.speed = patch.speed;
    if (opts.copyPages && next.length !== undefined && next.length > before) next = copyPagesOnExtend(next, before, next.length);
    return next;
  });
}

/**
 * A length growing into new pages fills them with copies of the old pages:
 * new page k = old page (k mod old pages) - 2 pages extended to 4 give pages
 * 1, 2, 1, 2 (A4 MKII manual p.49, Rytm MKII manual p.46).
 */
export function copyPagesOnExtend(t: Track, fromLength: number, toLength: number): Track {
  const oldPages = Math.max(1, Math.ceil(fromLength / PAGE_SIZE));
  const newPages = Math.min(MAX_STEPS / PAGE_SIZE, Math.ceil(toLength / PAGE_SIZE));
  if (newPages <= oldPages) return t;
  const steps = { ...t.steps };
  for (let pg = oldPages; pg < newPages; pg++) {
    const src = (pg % oldPages) * PAGE_SIZE;
    for (let i = 0; i < PAGE_SIZE; i++) {
      const s = t.steps[src + i];
      if (s) steps[pg * PAGE_SIZE + i] = cloneStep(s);
      else delete steps[pg * PAGE_SIZE + i];
    }
  }
  return { ...t, steps };
}

const cloneStep = (s: Step): Step => JSON.parse(JSON.stringify(s)) as Step;

/** Clear every trig of a track (keeps the track's defaults) */
export function clearTrack(p: Project, id: PatternId, track: number): Project {
  return withTrack(p, id, track, t => (Object.keys(t.steps).length ? { ...t, steps: {} } : t));
}

// ----------------------------------------------------------------------------
// Patterns
// ----------------------------------------------------------------------------

export type PatternSettings = Partial<Pick<Pattern, 'name' | 'length' | 'speed' | 'scaleMode' | 'master' | 'change' | 'swing' | 'kit' | 'tempo' | 'quantize'>>;

/**
 * Pattern settings. `tempo` 0 and `quantize` 0 remove them.
 * `copyPages`: a length that grows into new pages fills them with copies of the
 * existing pages, as the hardware's SCALE menu does (A4 MKII manual p.49, Rytm
 * MKII manual p.46) - for every track that follows the pattern length.
 */
export function updatePatternSettings(p: Project, id: PatternId, patch: PatternSettings, opts: { copyPages?: boolean } = {}): Project {
  return withPattern(p, id, pat => {
    const n: Pattern = { ...pat };
    if (patch.name !== undefined) n.name = String(patch.name).slice(0, 16);
    if (patch.length !== undefined) n.length = clampInt(patch.length, 1, MAX_STEPS);
    if (patch.speed !== undefined && (SPEEDS as readonly string[]).includes(patch.speed)) n.speed = patch.speed;
    if (patch.scaleMode !== undefined) {
      const mode = patch.scaleMode === 'track' ? 'track' : 'pattern';
      // Entering PER TRACK: the master length starts at the pattern length, so playback doesn't
      // change, and the master change at OFF, the hardware default (A4 MKII manual p.49)
      if (mode === 'track' && pat.scaleMode !== 'track') {
        if (patch.master === undefined) n.master = n.length;
        if (patch.change === undefined) n.change = CHANGE_OFF;
      }
      n.scaleMode = mode;
    }
    if (patch.master !== undefined) n.master = clampInt(patch.master, 0, MASTER_MAX);
    if (patch.change !== undefined) n.change = clampInt(patch.change, 0, MASTER_MAX);
    if (patch.swing !== undefined) n.swing = clampInt(patch.swing, SWING_MIN, SWING_MAX);
    if (patch.kit !== undefined) n.kit = String(patch.kit);
    if (patch.tempo !== undefined) {
      if (patch.tempo > 0) n.tempo = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(patch.tempo * 10) / 10));
      else delete n.tempo;
    }
    if (patch.quantize !== undefined) {
      const q = clampInt(patch.quantize, 0, QUANTIZE_MAX);
      if (q) n.quantize = q;
      else delete n.quantize;
    }
    if (opts.copyPages && n.length > pat.length) {
      n.tracks = n.tracks.map(t => (n.scaleMode === 'track' && t.length !== undefined ? t : copyPagesOnExtend(t, pat.length, n.length)));
    }
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

/**
 * Select a pattern. Changing patterns auto-saves the one left, so the newly
 * selected pattern's restore point (RELOAD PATTERN) is its state now (A4 MKII
 * manual p.42, Rytm MKII manual p.52).
 */
export function setActive(p: Project, id: PatternId): Project {
  if (!isPatternId(id) || p.active === id) return p;
  return { ...p, active: id, restore: { id, pattern: p.patterns[id] ?? null } };
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

// ----------------------------------------------------------------------------
// Trig mutes, swing trigs
// ----------------------------------------------------------------------------

/**
 * Trig mute on / off for trigs (TRIG MUTE menu: silences the trig, A4 MKII
 * manual p.51, Rytm MKII manual p.49). Empty steps are skipped.
 */
export function setTrigMute(p: Project, id: PatternId, track: number, steps: readonly number[], on: boolean): Project {
  return withSteps(p, id, track, steps, s => {
    if (!s || !!s.mute === on) return s;
    return patchStep(s, { mute: on ? true : null });
  });
}

/** The pattern's swing trigs (step indices 0..63); null = the default, every second step */
export function setSwingTrigs(p: Project, id: PatternId, steps: readonly number[] | null): Project {
  return withPattern(p, id, pat => {
    const list = steps === null ? null : Array.from(new Set(steps.filter(i => Number.isInteger(i) && i >= 0 && i < MAX_STEPS))).sort((a, b) => a - b);
    const isDefault = list === null || (list.length === DEFAULT_SWING_TRIGS.length && list.every((v, i) => v === DEFAULT_SWING_TRIGS[i]));
    if (isDefault ? pat.swingTrigs === undefined : JSON.stringify(list) === JSON.stringify(pat.swingTrigs)) return pat;
    const n = { ...pat };
    if (isDefault) delete n.swingTrigs;
    else n.swingTrigs = list!;
    return n;
  });
}

/** Place or remove one swing trig (SWING menu, Rytm MKII manual p.50) */
export function toggleSwingTrig(p: Project, id: PatternId, step: number): Project {
  const cur = getPattern(p, id).swingTrigs ?? DEFAULT_SWING_TRIGS;
  return setSwingTrigs(p, id, cur.includes(step) ? cur.filter(s => s !== step) : [...cur, step]);
}

// ----------------------------------------------------------------------------
// Master (track) mutes, tempo mode, quantize
// ----------------------------------------------------------------------------

/**
 * Track mute ([FUNC] + [TRACK] on the A4, MUTE mode on the Rytm): global,
 * kept when patterns change, saved with the project (A4 MKII manual p.16,
 * p.37; Rytm MKII manual p.23)
 */
export function setMasterMute(p: Project, track: number, on: boolean): Project {
  if (!(Number.isInteger(track) && track >= 0 && track < p.tracks)) return p;
  const cur = p.mutes ?? [];
  if (cur.includes(track) === on) return p;
  return setMasterMutes(p, on ? [...cur, track] : cur.filter(t => t !== track));
}

/** Set every track mute at once (the hardware's [FUNC]-held preselection applies on release) */
export function setMasterMutes(p: Project, tracks: readonly number[]): Project {
  const next = Array.from(new Set(tracks.filter(t => Number.isInteger(t) && t >= 0 && t < p.tracks))).sort((a, b) => a - b);
  if (JSON.stringify(next) === JSON.stringify(p.mutes ?? [])) return p;
  const out = { ...p };
  if (next.length) out.mutes = next;
  else delete out.mutes;
  return out;
}

/** PROJECT or PATTERN tempo mode (A4 MKII manual p.39, Rytm MKII manual p.38) */
export function setTempoMode(p: Project, mode: TempoMode): Project {
  if ((p.tempoMode ?? 'project') === mode) return p;
  const out = { ...p };
  if (mode === 'pattern') out.tempoMode = 'pattern';
  else delete out.tempoMode;
  return out;
}

/** TRACK QUANTIZE 0..127 of the micro timing (0 = off) */
export function setTrackQuantize(p: Project, id: PatternId, track: number, quantize: number): Project {
  const q = clampInt(quantize, 0, QUANTIZE_MAX);
  return withTrack(p, id, track, t => {
    if ((t.quantize ?? 0) === q) return t;
    const next = { ...t };
    if (q) next.quantize = q;
    else delete next.quantize;
    return next;
  });
}

// ----------------------------------------------------------------------------
// Copy, paste and clear: tracks, track pages, trigs (patterns: copyPattern...)
// A4 MKII manual p.54, Rytm MKII manual p.51. Clipboards are deep copies; paste
// returns the new project, so an undo is pasting back what was there.
// ----------------------------------------------------------------------------

/** Steps relative to a start (a page, or the first copied trig) */
export type StepsClip = Record<number, Step>;

/** Deep copy of a track (trigs, locks and its settings), null when the pattern slot is empty */
export function copyTrack(p: Project, id: PatternId, track: number): Track | null {
  const t = p.patterns[id]?.tracks[track];
  return t ? (JSON.parse(JSON.stringify(t)) as Track) : null;
}

/** Replace a track with a copied one (null = an empty track with the project's trig defaults) */
export function pasteTrack(p: Project, id: PatternId, track: number, clip: Track | null): Project {
  if (!(track >= 0 && track < p.tracks)) return p;
  const d = p.defaults[track] ?? { note: 60, vel: 100, len: LEN_DEFAULT };
  return withTrack(p, id, track, () => (clip ? normalizeTrack(JSON.parse(JSON.stringify(clip)), d) : createTrack(d)));
}

/** The trigs of one track page (0..3), keyed 0..15 */
export function copyPage(p: Project, id: PatternId, track: number, page: number): StepsClip {
  const t = getPattern(p, id).tracks[track];
  const [a, b] = pageSteps(page);
  const out: StepsClip = {};
  if (t) for (let i = a; i < b; i++) if (t.steps[i]) out[i - a] = cloneStep(t.steps[i]);
  return out;
}

/** Replace one track page with a copied page */
export function pastePage(p: Project, id: PatternId, track: number, page: number, clip: StepsClip): Project {
  const [a, b] = pageSteps(page);
  const steps = Array.from({ length: b - a }, (_, i) => a + i);
  return withSteps(p, id, track, steps, (_s, i) => (clip[i - a] ? cloneStep(clip[i - a]) : undefined));
}

/** Remove every trig of one track page */
export function clearPage(p: Project, id: PatternId, track: number, page: number): Project {
  return pastePage(p, id, track, page, {});
}

/** Trigs with all their locks, keyed by their distance from the first copied trig */
export function copyTrigs(p: Project, id: PatternId, track: number, steps: readonly number[]): StepsClip {
  const t = getPattern(p, id).tracks[track];
  const out: StepsClip = {};
  if (!t) return out;
  const held = steps.filter(i => t.steps[i]).sort((x, y) => x - y);
  for (const i of held) out[i - held[0]] = cloneStep(t.steps[i]);
  return out;
}

/** Paste copied trigs from `at` on, in the same relation to each other (steps in between are left alone) */
export function pasteTrigs(p: Project, id: PatternId, track: number, at: number, clip: StepsClip): Project {
  const targets = Object.keys(clip).map(k => at + Number(k)).filter(i => i >= 0 && i < MAX_STEPS);
  return withSteps(p, id, track, targets, (_s, i) => cloneStep(clip[i - at]));
}

/**
 * Move every trig of the track `by` steps (negative = earlier), wrapping round
 * inside the track length ([FUNC] + [LEFT] / [RIGHT], A4 MKII manual p.40, p.84)
 */
export function shiftTrigs(p: Project, id: PatternId, track: number, by: number): Project {
  const len = trackLength(getPattern(p, id), track);
  const d = ((Math.round(by) % len) + len) % len;
  if (!d) return p;
  return withTrack(p, id, track, t => {
    const steps = { ...t.steps };
    let any = false;
    for (let i = 0; i < len; i++) if (steps[i]) { delete steps[i]; any = true; }
    if (!any) return t;
    for (let i = 0; i < len; i++) if (t.steps[i]) steps[(i + d) % len] = t.steps[i];
    return { ...t, steps };
  });
}

// ----------------------------------------------------------------------------
// SAVE / RELOAD (pattern and track) - the restore point of the active pattern
// ----------------------------------------------------------------------------

/** SAVE PATTERN: the active pattern's current state becomes its restore point */
export function savePattern(p: Project): Project {
  const cur = p.patterns[p.active] ?? null;
  if (p.restore?.id === p.active && p.restore.pattern === cur) return p;
  return { ...p, restore: { id: p.active, pattern: cur } };
}

/**
 * RELOAD PATTERN: the active pattern goes back to its restore point (its state
 * when it was selected, or at the last SAVE PATTERN). An undo for live edits
 * until another pattern is selected (Rytm MKII manual p.52).
 */
export function reloadPattern(p: Project): Project {
  const r = p.restore;
  if (!r || r.id !== p.active) return p;
  const cur = p.patterns[p.active] ?? null;
  if (cur === r.pattern) return p;
  return r.pattern ? { ...p, patterns: { ...p.patterns, [p.active]: r.pattern } } : clearPattern(p, p.active);
}

/** SAVE TRACK: one track of the restore point takes the track's current state */
export function saveTrack(p: Project, track: number): Project {
  if (!(track >= 0 && track < p.tracks)) return p;
  const base = (p.restore?.id === p.active ? p.restore.pattern : p.patterns[p.active] ?? null) ?? createPattern(p.defaults);
  const cur = getPattern(p, p.active).tracks[track] ?? createTrack(p.defaults[track]);
  const tracks = base.tracks.slice();
  for (let i = tracks.length; i < p.tracks; i++) tracks[i] = createTrack(p.defaults[i]);
  tracks[track] = cur;
  return { ...p, restore: { id: p.active, pattern: { ...base, tracks } } };
}

/** RELOAD TRACK: one track of the active pattern goes back to the restore point */
export function reloadTrack(p: Project, track: number): Project {
  const r = p.restore;
  if (!r || r.id !== p.active || !(track >= 0 && track < p.tracks)) return p;
  const saved = r.pattern?.tracks[track] ?? createTrack(p.defaults[track]);
  return withTrack(p, p.active, track, t => (t === saved ? t : saved));
}

// ----------------------------------------------------------------------------
// Song rows with chains: pattern positions (0 = the row's own pattern)
// ----------------------------------------------------------------------------

export type SongEntryPatch = { pattern?: PatternId; mutes?: number[] | null; transpose?: number | null };

function patchEntry<T extends SongEntry>(e: T, patch: SongEntryPatch, tracks: number): T {
  const n: T = { ...e };
  if (patch.pattern !== undefined && isPatternId(patch.pattern)) n.pattern = patch.pattern;
  if (patch.mutes === null) delete n.mutes;
  else if (patch.mutes !== undefined) n.mutes = Array.from(new Set(patch.mutes.filter(t => t >= 0 && t < tracks))).sort((a, b) => a - b);
  if (patch.transpose === null || patch.transpose === 0) delete n.transpose;
  else if (patch.transpose !== undefined) n.transpose = clampInt(patch.transpose, -48, 48);
  return n;
}

function withRow(p: Project, index: number, fn: (r: SongRow) => SongRow): Project {
  const r = p.song.rows[index];
  if (!r) return p;
  const next = fn(r);
  if (next === r) return p;
  const rows = p.song.rows.slice();
  rows[index] = next;
  return { ...p, song: { ...p.song, rows } };
}

/** Add a pattern position to a song row (a chain row); `at` 1.. counts from the row's own pattern (default: at the end) */
export function songAddEntry(p: Project, row: number, pattern: PatternId, at?: number): Project {
  if (!isPatternId(pattern)) return p;
  return withRow(p, row, r => {
    const chain = (r.chain ?? []).slice();
    if (chain.length >= 255) return r;
    const pos = at === undefined ? chain.length : Math.max(0, Math.min(chain.length, Math.round(at) - 1));
    chain.splice(pos, 0, { pattern });
    return { ...r, chain };
  });
}

/** Remove a pattern position from a song row (a row keeps at least one pattern) */
export function songRemoveEntry(p: Project, row: number, pos: number): Project {
  return withRow(p, row, r => {
    const chain = r.chain ?? [];
    if (!chain.length || !(pos >= 0 && pos <= chain.length)) return r;
    const n: SongRow = { ...r };
    if (pos === 0) {
      // the first chain entry becomes the row's own pattern
      const [first, ...rest] = chain;
      n.pattern = first.pattern;
      if (first.mutes) n.mutes = first.mutes; else delete n.mutes;
      if (first.transpose) n.transpose = first.transpose; else delete n.transpose;
      if (rest.length) n.chain = rest; else delete n.chain;
      return n;
    }
    const next = chain.slice();
    next.splice(pos - 1, 1);
    if (next.length) n.chain = next; else delete n.chain;
    return n;
  });
}

/** Pattern, song mutes and transpose of one pattern position */
export function songUpdateEntry(p: Project, row: number, pos: number, patch: SongEntryPatch): Project {
  if (pos <= 0) return songUpdateRow(p, row, patch);
  return withRow(p, row, r => {
    const chain = r.chain ?? [];
    const e = chain[pos - 1];
    if (!e) return r;
    const next = chain.slice();
    next[pos - 1] = patchEntry(e, patch, p.tracks);
    return { ...r, chain: next };
  });
}

/** Toggle a song mute of one pattern position */
export function songToggleEntryMute(p: Project, row: number, pos: number, track: number): Project {
  const r = p.song.rows[row];
  if (!r) return p;
  const e = pos <= 0 ? r : r.chain?.[pos - 1];
  if (!e) return p;
  const m = new Set(e.mutes ?? []);
  if (m.has(track)) m.delete(track);
  else m.add(track);
  return songUpdateEntry(p, row, pos, { mutes: m.size ? Array.from(m) : null });
}

/** Number of pattern positions in a song row (0 when there is no such row) */
export const songRowSize = (p: Project, row: number): number => (p.song.rows[row] ? rowSize(p.song.rows[row]) : 0);
