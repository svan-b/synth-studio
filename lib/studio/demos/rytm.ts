// ============================================================================
// Analog Rytm MKII project for a demo: the demo's kit in kit slot 01, its
// patterns in bank A (all linked to that kit, so a pattern change never swaps
// sounds), the song rows mirroring the studio arrangement, and the factory
// kits and their demo patterns (banks B and C) kept for exploring afterwards.
// ============================================================================

import type { Pattern, SongRow, Step } from '@/lib/sequencer/elektron';
import { SEQ_TRACKS, TRACK_INDEX } from '@/devices/analog-rytm/model';
import { PROJECT_RV, defaultProject, type RytmProject } from '@/devices/analog-rytm/presets';
import { elektronPattern, type Values } from './common';

export const RYTM_KIT = '01';

export type RytmTrack = 'bd' | 'sd' | 'rs' | 'cp' | 'bt' | 'lt' | 'mt' | 'ht' | 'ch' | 'oh' | 'cy' | 'cb';

/** A Rytm pattern from per-track steps, linked to the demo kit */
export function rytmPattern(name: string, length: number, swing: number, tracks: Partial<Record<RytmTrack, Record<number, Step>>>): Pattern {
  const steps: Record<number, Record<number, Step>> = {};
  for (const [k, s] of Object.entries(tracks)) if (s) steps[TRACK_INDEX[k]] = s;
  return elektronPattern(SEQ_TRACKS, { name, length, swing, kit: RYTM_KIT }, steps);
}

export function rytmProject(opts: { kitName: string; kit: Values; patterns: Record<string, Pattern>; songName: string; song: SongRow[] }): RytmProject {
  const base = defaultProject();
  const patterns: Record<string, Pattern> = {};
  // keep the factory kits' demo patterns (banks B and C); bank A is the demo
  for (const [id, p] of Object.entries(base.patterns)) if (!id.startsWith('A')) patterns[id] = p;
  Object.assign(patterns, opts.patterns);
  const kits = { ...(base.kits ?? {}) };
  delete kits['02']; // the default song's drop kit
  const kitValues: Record<string, number> = {};
  for (const [id, v] of Object.entries(opts.kit)) if (typeof v === 'number') kitValues[id] = v;
  kits[RYTM_KIT] = { ...(kits[RYTM_KIT] ?? {}), name: opts.kitName, values: kitValues };
  return {
    ...base,
    patterns,
    active: 'A01',
    mode: 'pattern',
    changeMode: 'sequential',
    chain: [],
    mutes: [],
    song: { name: opts.songName, rows: opts.song, loop: false, loopRow: 0 },
    kit: RYTM_KIT,
    kits,
    rv: PROJECT_RV,
  };
}
