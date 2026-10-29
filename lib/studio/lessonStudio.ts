// ============================================================================
// Whole-studio lesson start states (Lesson API v3 – studio state).
//
// A studio lesson can start from a complete studio - rack, every instrument's
// settings, routes, sync, cables, the mix, the song and the tempo - the way the
// Producer path's checkpoints do. This module turns a LessonStudioStart into the
// store's documents, and keeps the learner's own studio as a backup so a lesson
// can never cost them their track. Pure data: the store applies the result.
// ============================================================================

import type { ControlValue, LessonStudioStart } from '@/types';
import type { InstanceState, StudioDoc, ArrangementSection } from '@/store/studio';
import type { MixerDoc } from './mixerDoc';

/** Section colours (the arranger's palette) */
const SECTION_COLORS = ['#38bdf8', '#a78bfa', '#f97316', '#22c55e', '#f43f5e', '#eab308', '#14b8a6', '#ec4899'];
const CABLE_COLORS = ['#38bdf8', '#f97316', '#22c55e', '#a855f7', '#eab308'];

/** The song of a start state as arranger sections (ids generated, colours filled in) */
export function sectionsFromStart(sections: NonNullable<LessonStudioStart['arrangement']>['sections']): ArrangementSection[] {
  return sections.map((x, i) => ({
    id: `s${i + 1}-${x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: x.name,
    bars: Math.max(1, Math.round(x.bars)),
    color: x.color ?? SECTION_COLORS[i % SECTION_COLORS.length],
    parts: Object.fromEntries(Object.entries(x.parts ?? {}).map(([inst, p]) => [inst, {
      ...(p.pattern ? { pattern: p.pattern } : {}),
      ...(p.snapshot ? { snapshot: { ...p.snapshot } } : {}),
      ...(p.muted ? { muted: true } : {}),
    }])),
  }));
}

/**
 * The studio and instrument documents a start state describes. Instruments in the start
 * rack get exactly its settings (their defaults plus `values`); `keep` keeps what an
 * instrument already had. Everything else of the studio is replaced, except working
 * preferences (metronome). Instruments that leave the rack keep their saved settings in
 * `devices`, as removing an instrument from the rack always does.
 */
export function buildLessonStudio(
  start: LessonStudioStart,
  prev: { devices: Record<string, InstanceState>; studio: StudioDoc },
): { devices: Record<string, InstanceState>; studio: StudioDoc; currentDevice: string } {
  const devices: Record<string, InstanceState> = { ...prev.devices };
  start.rack.forEach(r => {
    const had = prev.devices[r.id];
    if (r.keep && had) {
      devices[r.id] = r.values ? { ...had, controlValues: { ...had.controlValues, ...r.values } } : had;
      return;
    }
    devices[r.id] = {
      controlValues: { ...(r.values ?? {}) } as Record<string, ControlValue>,
      patchConnections: (r.patches ?? []).map(p => ({ ...p })),
      ...(r.data !== undefined ? { data: structuredClone(r.data) } : {}),
    };
  });
  const mixer: MixerDoc = {
    channels: Object.fromEntries(Object.entries(start.mixer?.channels ?? {}).map(([k, v]) => [k, { ...v }])),
    ...(start.mixer?.delay ? { delay: { ...start.mixer.delay } as MixerDoc['delay'] } : {}),
    ...(start.mixer?.reverb ? { reverb: { ...start.mixer.reverb } } : {}),
    ...(start.mixer?.master ? { master: structuredClone(start.mixer.master) } : {}),
  };
  const studio: StudioDoc = {
    ...prev.studio,
    rack: start.rack.map(r => ({ id: r.id, device: r.device, ...(r.label ? { label: r.label } : {}) })),
    routes: { ...(start.routes ?? {}) },
    sync: { ...(start.sync ?? {}) },
    cables: (start.cables ?? []).map((c, i) => ({ from: { ...c.from }, to: { ...c.to }, color: c.color ?? CABLE_COLORS[i % CABLE_COLORS.length] })),
    bpm: start.bpm ?? prev.studio.bpm,
    swing: start.swing ?? 0,
    arrangement: start.arrangement
      ? { enabled: start.arrangement.enabled ?? false, loop: start.arrangement.loop ?? true, sections: sectionsFromStart(start.arrangement.sections) }
      : { enabled: false, loop: true, sections: [] },
    off: {},
    mixer,
  };
  const focus = start.focus && start.rack.some(r => r.id === start.focus) ? start.focus : start.rack[0]?.id ?? prev.studio.rack[0]?.id ?? 'dfam';
  return { devices, studio, currentDevice: focus };
}

// ----------------------------------------------------------------------------
// Backups of the learner's studio
// ----------------------------------------------------------------------------

export interface LessonBackup {
  id: string;
  at: number;
  /** What it is, for the list ("Before “Frequency slots”") */
  label: string;
  /** The first backup taken while no other was pinned: the learner's own studio. Never dropped automatically. */
  pinned?: boolean;
  devices: Record<string, InstanceState>;
  studio: StudioDoc;
  currentDevice: string;
}

/** At most this many backups; the oldest unpinned ones go first */
export const MAX_BACKUPS = 4;
/** Keep the backups under about this many characters of JSON (localStorage holds about 5 MB in all) */
const MAX_BACKUP_CHARS = 2_500_000;

const sizeOf = (b: LessonBackup) => {
  try { return JSON.stringify(b).length; } catch { return 0; }
};

/** The same studio (instruments and studio) as a backup already holds */
export function sameStudio(b: Pick<LessonBackup, 'devices' | 'studio'>, devices: Record<string, InstanceState>, studio: StudioDoc): boolean {
  if (b.studio === studio && b.devices === devices) return true;
  try {
    return JSON.stringify(b.studio) === JSON.stringify(studio) && JSON.stringify(b.devices) === JSON.stringify(devices);
  } catch {
    return false;
  }
}

/** Add a backup (newest first), drop duplicates and the oldest unpinned ones beyond the limits */
export function pushBackup(list: LessonBackup[], b: LessonBackup): LessonBackup[] {
  const next = [b, ...list.filter(x => x.id !== b.id)];
  let total = next.reduce((n, x) => n + sizeOf(x), 0);
  while (next.length > MAX_BACKUPS || (total > MAX_BACKUP_CHARS && next.length > 1)) {
    let i = -1;
    for (let k = next.length - 1; k > 0; k--) if (!next[k].pinned) { i = k; break; }
    if (i < 0) break;
    total -= sizeOf(next[i]);
    next.splice(i, 1);
  }
  return next;
}

export function newBackupId(): string {
  return `b${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
