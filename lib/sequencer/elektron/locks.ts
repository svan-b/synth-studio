// ============================================================================
// Parameter locks - hold a trig key, turn an encoder: the value is locked on
// that step instead of changing the sound.
//
// Wire into a DeviceModule:
//
//   const LOCKS: LockOptions = {
//     lockKey: id => /^t\d+_(.+)$/.exec(id)?.[1] ?? null,     // control id -> param key
//     currentTrack: values => Number(values.track) || 0,
//     currentPattern: data => asProject(data, 4).active,
//   };
//   interceptChange: (id, v, api) => interceptForLocks(id, v, api, LOCKS),
//   displayValues: api => displayWithLocks(api, LOCKS),
//
// The trig keys (components/sequencer/TrigKeys) put the held steps in
// ui.heldSteps (and the track / pattern they show in ui.heldTrack /
// ui.heldPattern, which win over currentTrack / currentPattern).
//
// lockKey may return the step fields 'note' | 'vel' | 'len' | 'micro' for the
// TRIG page encoders: those write the trig's own NOTE / VEL / LEN / micro timing.
// With `trackDefaults: true`, turning them with nothing held edits the track's
// trig defaults in the pattern (the TRIG page), like the hardware.
// ============================================================================

import type { ControlValue } from '@/types';
import type { Values } from '@/types/panel';
import type { DeviceUiApi } from '@/devices/types';
import type { PatternId, Project, Step, TrackDefaults } from './types';
import { asProject, getPattern, isPatternId } from './project';
import { clearLocks, isStepField, setLock, setTrackDefault, type StepField } from './edit';

/** ui keys shared by the sequencer UI kit and these helpers */
export const UI_HELD_STEPS = 'heldSteps';
export const UI_HELD_TRACK = 'heldTrack';
export const UI_HELD_PATTERN = 'heldPattern';
/** Set to true by interceptForLocks when a lock was written during the current hold */
export const UI_HELD_EDITED = 'heldEdited';

export interface LockOptions {
  /** Control id -> lockable parameter key (or a step field), null = not lockable */
  lockKey: (controlId: string) => string | null;
  /** Selected track (from control values) */
  currentTrack: (values: Values) => number;
  /**
   * Track a control belongs to (e.g. 't3_cutoff' -> 2), null for global controls.
   * Recommended when per-track controls share parameter keys: only the held
   * track's controls are locked / overlaid.
   */
  trackOf?: (controlId: string) => number | null;
  /** Selected pattern (from device data) */
  currentPattern: (data: unknown) => PatternId;
  /** Nothing held + a step-field control: edit the track's trig default instead (TRIG page) */
  trackDefaults?: boolean;
  /** Control value -> stored lock value (default: numbers as-is, booleans 1/0, strings not lockable) */
  toLock?: (controlId: string, value: ControlValue) => number | null;
  /** Stored lock value -> displayed control value (default: the number; boolean controls get v !== 0) */
  fromLock?: (controlId: string, value: number, current: ControlValue) => ControlValue;
  /** Track count for asProject() when the data is missing */
  tracks?: number;
}

const NONE: readonly number[] = Object.freeze([]);
const FIELD_TO_DEFAULT: Partial<Record<StepField, keyof TrackDefaults>> = { note: 'note', vel: 'vel', len: 'len' };

/** The held step indices (absolute, 0..63) */
export function heldSteps(ui: Record<string, unknown> | undefined): readonly number[] {
  const h = ui?.[UI_HELD_STEPS];
  return Array.isArray(h) && h.length && h.every(x => typeof x === 'number') ? (h as number[]) : NONE;
}

/** Track / pattern the held steps belong to */
export function heldTarget(api: Pick<DeviceUiApi, 'values' | 'data' | 'ui'>, opts: LockOptions): { track: number; pattern: PatternId } {
  const ht = api.ui[UI_HELD_TRACK];
  const hp = api.ui[UI_HELD_PATTERN];
  return {
    track: typeof ht === 'number' ? ht : Math.max(0, Math.round(opts.currentTrack(api.values)) || 0),
    pattern: isPatternId(hp) ? hp : opts.currentPattern(api.data),
  };
}

const keyCache = new WeakMap<LockOptions, Map<string, string | null>>();

function lockKeyOf(opts: LockOptions, id: string): string | null {
  let m = keyCache.get(opts);
  if (!m) { m = new Map(); keyCache.set(opts, m); }
  let k = m.get(id);
  if (k === undefined) { k = opts.lockKey(id); m.set(id, k); }
  return k;
}

function sameTrack(opts: LockOptions, id: string, track: number): boolean {
  if (!opts.trackOf) return true;
  const t = opts.trackOf(id);
  return t === null || t === track;
}

function toLockValue(opts: LockOptions, id: string, v: ControlValue): number | null {
  if (opts.toLock) return opts.toLock(id, v);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

/**
 * DeviceModule.interceptChange for parameter locks. Returns true (handled) when
 * the change became a lock: steps are held and the control is lockable. An
 * empty held step gets a lock trig, as on the hardware.
 */
export function interceptForLocks(id: string, value: ControlValue, api: DeviceUiApi, opts: LockOptions): boolean {
  const key = lockKeyOf(opts, id);
  if (!key) return false;
  const held = heldSteps(api.ui);
  if (!held.length) {
    const field = isStepField(key) ? FIELD_TO_DEFAULT[key] : undefined;
    if (!opts.trackDefaults || !field) return false;
    const v = toLockValue(opts, id, value);
    if (v === null) return false;
    const { track, pattern } = heldTarget(api, opts);
    if (!sameTrack(opts, id, track)) return false;
    api.updateData(d => setTrackDefault(asProject(d, opts.tracks), pattern, track, field, v));
    return true;
  }
  const v = toLockValue(opts, id, value);
  if (v === null) return false;
  const { track, pattern } = heldTarget(api, opts);
  if (!sameTrack(opts, id, track)) return false;
  const steps = held.slice();
  api.updateData(d => setLock(asProject(d, opts.tracks), pattern, track, steps, key, v));
  if (api.ui[UI_HELD_EDITED] !== true) api.setUi({ [UI_HELD_EDITED]: true });
  return true;
}

function lockedValue(step: Step | undefined, key: string): number | undefined {
  if (!step) return undefined;
  if (isStepField(key)) return step[key];
  return step.locks?.[key];
}

const displayCache = new WeakMap<LockOptions, { values: Values; data: unknown; ui: Record<string, unknown>; out: Values }>();

/**
 * DeviceModule.displayValues: the stored values with the first held step's
 * locks overlaid (and the track's trig defaults for the step fields when
 * `trackDefaults`). Returns `api.values` itself when there is nothing to show.
 */
export function displayWithLocks(api: Pick<DeviceUiApi, 'values' | 'data' | 'ui'>, opts: LockOptions): Values {
  const held = heldSteps(api.ui);
  if (!held.length && !opts.trackDefaults) return api.values;
  const c = displayCache.get(opts);
  if (c && c.values === api.values && c.data === api.data && c.ui === api.ui) return c.out;
  const project = asProject(api.data, opts.tracks);
  const { track, pattern } = heldTarget(api, opts);
  const pat = getPattern(project, pattern);
  const t = pat.tracks[track];
  const step = held.length ? t?.steps[held[0]] : undefined;
  let out: Values | null = null;
  for (const id in api.values) {
    const key = lockKeyOf(opts, id);
    if (!key || !sameTrack(opts, id, track)) continue;
    let v = lockedValue(step, key);
    if (v === undefined && t && isStepField(key)) {
      const f = FIELD_TO_DEFAULT[key];
      if (f && (held.length || opts.trackDefaults)) v = t[f];
    }
    if (v === undefined) continue;
    const curV = api.values[id];
    const shown = opts.fromLock ? opts.fromLock(id, v, curV) : typeof curV === 'boolean' ? v !== 0 : v;
    if (shown === curV) continue;
    (out ??= { ...api.values })[id] = shown;
  }
  const result = out ?? api.values;
  displayCache.set(opts, { values: api.values, data: api.data, ui: api.ui, out: result });
  return result;
}

/** Is `controlId` locked on the first held step? (for orange encoder rings) */
export function isLocked(api: Pick<DeviceUiApi, 'values' | 'data' | 'ui'>, opts: LockOptions, controlId: string): boolean {
  const held = heldSteps(api.ui);
  if (!held.length) return false;
  const key = lockKeyOf(opts, controlId);
  if (!key) return false;
  const { track, pattern } = heldTarget(api, opts);
  if (!sameTrack(opts, controlId, track)) return false;
  const step = getPattern(asProject(api.data, opts.tracks), pattern).tracks[track]?.steps[held[0]];
  return lockedValue(step, key) !== undefined;
}

/** Remove one lock (by control id or parameter key) from the held steps (or the given ones) */
export function clearLock(
  api: Pick<DeviceUiApi, 'values' | 'data' | 'ui' | 'updateData'>, opts: LockOptions, idOrKey: string, steps?: readonly number[],
): void {
  const key = lockKeyOf(opts, idOrKey) ?? idOrKey;
  const list = (steps ?? heldSteps(api.ui)).slice();
  if (!list.length) return;
  const { track, pattern } = heldTarget(api, opts);
  api.updateData(d => setLock(asProject(d, opts.tracks), pattern, track, list, key, null, { create: false }));
}

/** Remove every parameter lock from the held steps (or the given ones) */
export function clearHeldLocks(
  api: Pick<DeviceUiApi, 'values' | 'data' | 'ui' | 'updateData'>, opts: LockOptions, steps?: readonly number[],
): void {
  const list = (steps ?? heldSteps(api.ui)).slice();
  if (!list.length) return;
  const { track, pattern } = heldTarget(api, opts);
  api.updateData(d => clearLocks(asProject(d, opts.tracks), pattern, track, list));
}

/** Plain project helper for engines/tests: the locks of one step */
export function stepLocks(project: Project, pattern: PatternId, track: number, step: number): Readonly<Record<string, number>> {
  return getPattern(project, pattern).tracks[track]?.steps[step]?.locks ?? {};
}
