// ============================================================================
// The project's Sound pool and sound locks (Rytm MKII manual pp.24, 26, 32-33, 35, 48)
//
// - A project has a Sound pool of up to 128 Sounds (p.24). A Sound is the
//   settings of a drum track's PARAMETER pages (p.26): its machine and SRC
//   parameters, and the SMPL, FLTR, AMP and LFO pages. Track level, retrig
//   and the TRIG page belong to the kit and the pattern, not to the Sound.
// - Sounds in the pool can be sound locked: a note trig plays a pool Sound in
//   place of the track's own (p.48). The first entry, TRACK SOUND, is the
//   track's Sound of the active kit. A Sound only fits the tracks that can run
//   its machine (p.21 lists them); others are shown with (!).
// - The twin keeps the pool in the project data (`RytmProject.pool`) and a
//   sound lock as the trig's `sound` lock (the pool slot, 1-128). It counts as
//   one locked parameter of the track, like any other lock.
// ============================================================================

import type { ControlValue } from '@/types';
import { LOCK_LIMIT_RYTM, getPattern, setLock, type PatternId, type Project } from '@/lib/sequencer/elektron';
import { AMP_PAGE, FLTR_PAGE, IX, LFO_PAGE, MACHINES, SMPL_PAGE, TRACKS, machineOf, soundDefaults } from './model';
import { SOUND_LOCK } from './live';

export const POOL_SIZE = 128;

export interface RytmSound {
  name: string;
  /** Hardware machine number (model.ts M) */
  machine: number;
  /** Parameter keys without the track prefix: the machine's SRC parameters and the SMPL, FLTR, AMP, LFO pages */
  values: Record<string, number>;
}

export type SoundPool = (RytmSound | null)[];

/** The page parameters a Sound holds (besides its machine's SRC parameters) */
export const SOUND_PAGE_PARAMS = [...SMPL_PAGE, ...FLTR_PAGE, ...AMP_PAGE, ...LFO_PAGE];

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'boolean' ? (v ? 1 : 0) : d);

/** The Sound on `track` now (control values), as the pool stores it */
export function captureSound(values: Record<string, unknown>, track: number, name?: string): RytmSound {
  const t = TRACKS[track];
  const machine = machineOf(values, track);
  const out: Record<string, number> = {};
  const defs = soundDefaults(track, machine);
  for (const k of MACHINES[machine].slots) if (k) out[k] = num(values[`${t.id}_${k}`], defs[k] ?? 0);
  for (const p of SOUND_PAGE_PARAMS) out[p.key] = num(values[`${t.id}_${p.key}`], p.def);
  return { name: (name ?? `${t.name} ${MACHINES[machine].name}`).toUpperCase().slice(0, 15), machine, values: out };
}

/** Can `track` play the Sound (its machine is in the track's MACHINE menu)? */
export const soundFits = (snd: RytmSound | null | undefined, track: number): snd is RytmSound =>
  !!snd && track >= 0 && track < TRACKS.length && TRACKS[track].machines.includes(snd.machine);

/** Control values that load the Sound into `track` (SOUND MANAGER > LOAD TO TRACK) */
export function soundControls(snd: RytmSound, track: number): Record<string, ControlValue> {
  const t = TRACKS[track];
  const out: Record<string, ControlValue> = { [`${t.id}_machine`]: Math.max(0, t.machines.indexOf(snd.machine)) };
  const defs = soundDefaults(track, snd.machine);
  for (const k of MACHINES[snd.machine].slots) if (k) out[`${t.id}_${k}`] = snd.values[k] ?? defs[k] ?? 0;
  for (const p of SOUND_PAGE_PARAMS) out[`${t.id}_${p.key}`] = snd.values[p.key] ?? p.def;
  return out;
}

/** Worklet parameter index of a lock key for a voice running `machine` (as the engine's target()) */
export function lockIndex(machine: number, key: string): number {
  const p = SOUND_PAGE_PARAMS.find(x => x.key === key);
  if (p?.idx !== undefined) return p.idx;
  return MACHINES[machine]?.slots.indexOf(key) ?? -1;
}

const lockMaps = new WeakMap<RytmSound, Record<number, number>>();

/** Every parameter of the Sound as worklet locks (index -> value): a sound-locked trig plays it whole */
export function soundLockMap(snd: RytmSound): Record<number, number> {
  let m = lockMaps.get(snd);
  if (m) return m;
  m = {};
  const defs = MACHINES[snd.machine];
  defs.slots.forEach((k, i) => { if (k) m![IX.SYN + i] = snd.values[k] ?? 0; });
  for (const p of SOUND_PAGE_PARAMS) if (p.idx !== undefined) m[p.idx] = snd.values[p.key] ?? p.def;
  lockMaps.set(snd, m);
  return m;
}

/** A saved pool, repaired: up to 128 slots of valid Sounds or null */
export function cleanPool(x: unknown): SoundPool | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: SoundPool = [];
  for (let i = 0; i < Math.min(POOL_SIZE, x.length); i++) {
    const s = x[i] as Partial<RytmSound> | null;
    if (!s || typeof s !== 'object' || typeof s.machine !== 'number' || !MACHINES[s.machine] || !s.values || typeof s.values !== 'object') { out.push(null); continue; }
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.values)) if (typeof v === 'number' && Number.isFinite(v)) values[k] = v;
    out.push({ name: typeof s.name === 'string' ? s.name.slice(0, 15) : `SOUND ${i + 1}`, machine: s.machine, values });
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** First empty pool slot (0-based), or -1 when all 128 are used */
export function freeSlot(pool: SoundPool | undefined): number {
  const list = pool ?? [];
  for (let i = 0; i < POOL_SIZE; i++) if (!list[i]) return i;
  return -1;
}

/** The pool with `snd` in `slot` (null empties it) */
export function withSound(pool: SoundPool | undefined, slot: number, snd: RytmSound | null): SoundPool {
  const out = (pool ?? []).slice();
  while (out.length <= slot) out.push(null);
  out[slot] = snd;
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** Label of a pool slot: "03 BIG SNARE" */
export const slotLabel = (slot: number, snd: RytmSound | null | undefined) => `${String(slot + 1).padStart(2, '0')} ${snd?.name ?? 'EMPTY'}`;

/**
 * Sound lock the note trigs among `steps` to pool slot `slot` (1-based; 0 = TRACK SOUND,
 * which removes the lock). Lock trigs and empty steps are left alone (manual p.48: a
 * note trig is held), and so is a Sound the track cannot run.
 */
export function setSoundLock(p: Project, pattern: PatternId, track: number, steps: readonly number[], slot: number, pool: SoundPool | undefined): Project {
  if (slot > 0 && !soundFits(pool?.[slot - 1], track)) return p;
  const t = getPattern(p, pattern).tracks[track];
  const notes = steps.filter(s => t?.steps[s] && !t.steps[s].trigless);
  if (!notes.length) return p;
  return setLock(p, pattern, track, notes, SOUND_LOCK, slot > 0 ? slot : null, { create: false, limit: LOCK_LIMIT_RYTM });
}

/** The choices of the sound lock list on `track`: 0 (TRACK SOUND), then every stored slot (1-based) with whether it fits */
export function soundChoices(pool: SoundPool | undefined, track: number): { slot: number; fits: boolean }[] {
  const out = [{ slot: 0, fits: true }];
  (pool ?? []).forEach((s, i) => { if (s) out.push({ slot: i + 1, fits: soundFits(s, track) }); });
  return out;
}
