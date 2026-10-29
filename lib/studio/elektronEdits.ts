// ============================================================================
// Elektron sequencer data in lessons (Lesson API v3): pattern settings that a
// listen step can A/B, a match step can test and a solution can set (SWING,
// LENGTH), and trig edits for solutions. The Analog Rytm and the Analog Four
// keep their patterns as device data (docs/ELEKTRON_SEQUENCER.md), not knobs,
// so these work on the data. Pure: the store, the lesson runtime, the coach and
// the validator all use them.
// ============================================================================

import type { LessonPatternPatch, LessonSequenceEdit, LessonTrig } from '@/types';
import { MAX_STEPS, SWING_MAX, SWING_MIN, type PatternId, type Project, type Step } from '@/lib/sequencer/elektron/types';
import { getPattern, getStep, isPatternId, isProject, trackTrigDefaults } from '@/lib/sequencer/elektron/project';
import { clearTrack, setStep, updatePatternSettings, type PatternSettings } from '@/lib/sequencer/elektron/edit';

/** Is this instrument data an Elektron sequencer project? */
export const isElektronData = (data: unknown): data is Project => isProject(data);

/** SWING of the active pattern (or of `pattern`), 50..80; undefined without a project */
export function patternSwing(data: unknown, pattern?: string): number | undefined {
  if (!isProject(data)) return undefined;
  const id = (pattern && isPatternId(pattern) ? pattern : data.active) as PatternId;
  return getPattern(data, id).swing;
}

/** SWING's knob travel, for match tolerances */
export const SWING_RANGE = SWING_MAX - SWING_MIN;

function settingsOf(patch: LessonPatternPatch): PatternSettings {
  const out: PatternSettings = {};
  if (typeof patch.swing === 'number') out.swing = patch.swing;
  if (typeof patch.length === 'number') out.length = patch.length;
  return out;
}

/**
 * The data with pattern settings applied: to the active pattern (what the SWING and SCALE
 * menus edit), or with `all` to every stored pattern and the active one (a listen side:
 * whichever pattern the song plays swings the same). A longer LENGTH copies the existing
 * pages into the new ones, as the hardware's SCALE menu does.
 */
export function withPatternPatch(data: unknown, patch: LessonPatternPatch, opts: { all?: boolean } = {}): unknown {
  if (!isProject(data)) return data;
  const settings = settingsOf(patch);
  if (!Object.keys(settings).length) return data;
  if (!opts.all) return updatePatternSettings(data, data.active, settings, { copyPages: true });
  let p: Project = data;
  new Set([...Object.keys(data.patterns), data.active]).forEach(id => {
    if (isPatternId(id)) p = updatePatternSettings(p, id, settings, { copyPages: true });
  });
  return p;
}

/** A lesson trig as the sequencer's Step (flags only when set) */
function toStep(t: LessonTrig): Step {
  const s: Step = {};
  if (t.note !== undefined) s.note = t.note;
  if (t.vel !== undefined) s.vel = t.vel;
  if (t.len !== undefined) s.len = t.len;
  if (t.micro) s.micro = t.micro;
  if (t.cond) s.cond = t.cond;
  if (t.retrig) s.retrig = { ...t.retrig };
  if (t.trigless) s.trigless = true;
  if (t.accent) s.accent = true;
  if (t.slide) s.slide = true;
  if (t.pslide) s.pslide = true;
  if (t.locks && Object.keys(t.locks).length) s.locks = { ...t.locks };
  return s;
}

/**
 * The data with one sequence edit applied. `stamp`: new note trigs take the track's NOTE,
 * VEL and LEN, the way the Analog Four stamps its NOTE menu into each trig it places (A4
 * MKII manual p.45). The Rytm's TRIG page is a live default, so its trigs stay plain.
 */
export function withSequenceEdit(data: unknown, e: LessonSequenceEdit, opts: { stamp?: boolean } = {}): unknown {
  if (!isProject(data)) return data;
  const id = (e.pattern && isPatternId(e.pattern) ? e.pattern : data.active) as PatternId;
  if (!(e.track >= 0 && e.track < data.tracks)) return data;
  let p: Project = e.clear ? clearTrack(data, id, e.track) : data;
  for (const [k, t] of Object.entries(e.trigs)) {
    const i = Number(k) - 1;
    if (!(Number.isInteger(i) && i >= 0 && i < MAX_STEPS)) continue;
    if (t === null) { p = setStep(p, id, e.track, i, null); continue; }
    const cur = getStep(p, id, e.track, i);
    const add = toStep(t);
    let next: Step = { ...(cur ?? {}), ...add };
    const locks = { ...(cur?.locks ?? {}), ...(add.locks ?? {}) };
    if (Object.keys(locks).length) next.locks = locks; else delete next.locks;
    if (opts.stamp && !next.trigless && (!cur || cur.trigless)) {
      const d = trackTrigDefaults(p, id, e.track);
      next = { note: d.note, vel: d.vel, len: d.len, ...next };
    }
    p = setStep(p, id, e.track, i, next);
  }
  return p;
}

/** Devices whose sequencer stamps the NOTE menu into each new trig */
export const STAMPS_TRIGS = new Set(['analog-four']);

/** Validator: what is wrong with a pattern patch, or null ('listen' allows SWING only) */
export function patternPatchProblem(patch: LessonPatternPatch, where: 'listen' | 'match' | 'solution'): string | null {
  const keys = Object.keys(patch);
  if (!keys.length) return 'is empty';
  for (const k of keys) {
    if (k !== 'swing' && k !== 'length') return `has an unknown setting "${k}"`;
    if (where !== 'solution' && k !== 'swing') return `"${k}" cannot be A/B'd or matched (only swing)`;
  }
  if (patch.swing !== undefined && !(patch.swing >= SWING_MIN && patch.swing <= SWING_MAX)) return `swing ${patch.swing} is outside ${SWING_MIN}..${SWING_MAX}`;
  if (patch.length !== undefined && !(Number.isInteger(patch.length) && patch.length >= 1 && patch.length <= MAX_STEPS)) return `length ${patch.length} is outside 1..${MAX_STEPS}`;
  return null;
}
