// ============================================================================
// LIVE RECORDING and STEP RECORDING edits (Rytm MKII manual pp.40-41, 43, 47)
//
// Pure Project -> Project functions; the engine works out where a hit or an
// encoder turn lands (the step and its micro timing) and reports it as an op,
// the panel applies the op to the project with these.
//
// - A pad (or key) hit becomes a note trig with the hit's velocity, its micro
//   timing unless quantized, and its pitch in CHROMATIC mode; how long the pad
//   was held becomes the trig's LEN (or its retrig length, with [RTRG] held).
//   A trig already on the step keeps its parameter locks (manual p.41).
// - An encoder turn becomes a parameter lock on the step the sequencer is at:
//   a note trig there is locked, an empty step gets a lock trig (manual p.47).
//   **Design** (the manual doesn't say): the turn is also an ordinary edit, so
//   the kit value follows the knob and you hear it at once; and when the turns
//   of one encoder come less than about three steps apart, the steps passed in
//   between get the value that was playing there, so a slow sweep records as a
//   continuous one.
// - [FUNC] + [NO] erases the active track's parameter locks on every step
//   reached while held; [NO] + an encoder erases that parameter's locks; [NO] +
//   pads erase those tracks' trigs. Sound locks stay (manual pp.40, 47).
//
// Generic enough for the Analog Four's live recording too; it lives here until
// the shared library grows a helper for it (docs/ELEKTRON_SEQUENCER.md §8).
// ============================================================================

import {
  LEN_INF, NOTE_LENGTHS, getPattern, setLock, trackLength, withSteps,
  type PatternId, type Project, type Step,
} from '@/lib/sequencer/elektron';

/** The lock key that holds a trig's sound lock (a Sound pool slot, 1-128; manual p.48) */
export const SOUND_LOCK = 'sound';

/** Steps strictly after `from` and before `to`, going forward round a loop of `len` steps */
export function stepsBetween(from: number, to: number, len: number): number[] {
  const out: number[] = [];
  if (len <= 0 || from === to) return out;
  for (let s = (from + 1) % len, guard = 0; s !== to && guard < len; s = (s + 1) % len, guard++) out.push(s);
  return out;
}

/** NOTE_LENGTHS index closest to `steps` (on a log scale); INF past the longest */
export function lenIndexOf(steps: number): number {
  if (!(steps > 0)) return 0;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < LEN_INF; i++) {
    const d = Math.abs(Math.log(NOTE_LENGTHS[i] / steps));
    if (d < bestD) { bestD = d; best = i; }
  }
  return steps > NOTE_LENGTHS[LEN_INF - 1] * 1.5 ? LEN_INF : best;
}

export interface LiveHit {
  pattern: PatternId;
  track: number;
  step: number;
  /** Micro timing -23..23 (0 when quantized) */
  micro: number;
  vel: number;
  /** CHROMATIC mode: the trig's pitch (60 = the sound's own) */
  note?: number;
  /** [RTRG] held: the roll, at the track's RETRIG menu settings */
  retrig?: { rate: number; len: number; vel: number };
  /** STEP RECORDING JUMP mode: LEN locked on the trig */
  len?: number;
}

/** A recorded hit: a note trig on the step, keeping what an existing trig holds (manual pp.40-41) */
export function recordHit(p: Project, h: LiveHit): Project {
  return withSteps(p, h.pattern, h.track, [h.step], cur => {
    const s: Step = { ...(cur ?? {}), vel: Math.max(1, Math.min(127, Math.round(h.vel))) };
    delete s.trigless;
    if (h.micro) s.micro = Math.max(-23, Math.min(23, Math.round(h.micro))); else delete s.micro;
    if (h.note !== undefined) s.note = Math.max(0, Math.min(127, Math.round(h.note)));
    if (h.retrig) s.retrig = { ...h.retrig };
    if (h.len !== undefined) s.len = Math.max(0, Math.min(LEN_INF, Math.round(h.len)));
    return s;
  });
}

/** The press of a recorded hit ended: how long it was held, as the trig's LEN (or its retrig's length) */
export function recordHitLength(p: Project, h: { pattern: PatternId; track: number; step: number; len: number; retrig?: boolean }): Project {
  return withSteps(p, h.pattern, h.track, [h.step], cur => {
    if (!cur || cur.trigless) return cur;
    const len = Math.max(0, Math.min(LEN_INF, Math.round(h.len)));
    if (h.retrig) return cur.retrig ? { ...cur, retrig: { ...cur.retrig, len } } : cur;
    if (cur.len === len) return cur;
    const track = getPattern(p, h.pattern).tracks[h.track];
    const s: Step = { ...cur, len };
    // the track's own LEN: nothing to store
    if (track && track.len === len) delete s.len;
    return s;
  });
}

export interface LiveLock {
  pattern: PatternId;
  track: number;
  step: number;
  key: string;
  value: number;
  /** Steps passed since this encoder's previous turn, and the value that was playing there */
  fill?: { steps: number[]; value: number };
}

/** A recorded encoder turn (manual p.47): lock trigs on empty steps, the locks on trigs */
export function recordLock(p: Project, l: LiveLock, limit?: number): Project {
  let q = p;
  if (l.fill?.steps.length) q = setLock(q, l.pattern, l.track, l.fill.steps, l.key, l.fill.value, { limit });
  return setLock(q, l.pattern, l.track, [l.step], l.key, l.value, { limit });
}

/**
 * [FUNC] + [NO] (key null: every parameter lock) or [NO] + an encoder (one key) in
 * LIVE RECORDING: the locks go from the steps; a sound lock stays (manual p.47).
 * A lock trig left with nothing is removed.
 */
export function eraseLocks(p: Project, pattern: PatternId, track: number, steps: readonly number[], key: string | null): Project {
  return withSteps(p, pattern, track, steps, s => {
    if (!s?.locks) return s;
    const locks: Record<string, number> = {};
    let changed = false;
    for (const k in s.locks) {
      const keep = key === null ? k === SOUND_LOCK : k !== key;
      if (keep) locks[k] = s.locks[k];
      else changed = true;
    }
    if (!changed) return s;
    const next: Step = { ...s };
    if (Object.keys(locks).length) next.locks = locks; else delete next.locks;
    return next.trigless && !next.locks && next.note === undefined && next.vel === undefined && next.len === undefined ? undefined : next;
  });
}

/**
 * [NO] + pads in LIVE RECORDING: the trigs on the steps are erased. A sound lock is
 * not (manual pp.40, 47): its step keeps it in a lock trig, so a hit recorded there
 * later plays that Sound again. **Design**: sound locks act on note trigs only, so the
 * leftover lock trig is silent.
 */
export function eraseTrigs(p: Project, pattern: PatternId, track: number, steps: readonly number[]): Project {
  return withSteps(p, pattern, track, steps, s => {
    if (!s) return s;
    const snd = s.locks?.[SOUND_LOCK];
    if (snd === undefined) return undefined;
    if (s.trigless && s.locks && Object.keys(s.locks).length === 1) return s;
    return { trigless: true, locks: { [SOUND_LOCK]: snd } };
  });
}

/** Steps 0..len-1 of `track` in `pattern` (the track's own length) */
export const trackSteps = (p: Project, pattern: PatternId, track: number) => trackLength(getPattern(p, pattern), track);
