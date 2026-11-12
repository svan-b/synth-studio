// ============================================================================
// Demo tracks - shared building blocks.
//
// The three demo tracks (docs/research/producer-path/demo-tracks.md) are built
// in code from the instruments' own data formats, so every pattern, kit, preset
// and snapshot is type-checked against them:
//   - Elektron patterns come from the shared sequencer (lib/sequencer/elektron)
//   - Rytm kits from the Rytm's own kit builder, A4 sounds from its parameter table
//   - Moog sequences from each Moog's sequence helpers
// The grids below read like the design document's tables, so they can be
// checked against it cell by cell.
// ============================================================================

import type { ControlValue } from '@/types';
import {
  NOTE_LENGTHS, createPattern, type Locks, type Pattern, type Speed, type Step,
} from '@/lib/sequencer/elektron';
import { MIN_DB, type ChannelDoc, type MixerDoc } from '@/lib/studio/mixerDoc';
import type { InstanceState, ArrangementSection, SectionPart } from '@/store/studio';

export type Values = Record<string, ControlValue>;

// ----------------------------------------------------------------------------
// Notes and lengths
// ----------------------------------------------------------------------------

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'A2' -> 45, 'C#3' -> 49, 'Bb1' -> 34 (C4 = MIDI 60, as in the design) */
export function nn(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`demo: bad note "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PITCH[m[1]] + acc;
}

/** Note length in steps -> NOTE_LENGTHS index (0.5 -> 6, 1 -> 14, 1.5 -> 22, 2 -> 30, 4 -> 46, 32 -> 94, 64 -> 110) */
export function lenIndex(steps: number): number {
  let best = 0;
  NOTE_LENGTHS.forEach((l, i) => { if (Math.abs(l - steps) < Math.abs(NOTE_LENGTHS[best] - steps)) best = i; });
  return best;
}

const isRest = (t: string) => t === '·' || t === '.' || t === '-';
const tokens = (row: string) => row.trim().split(/\s+/).filter(Boolean);

// ----------------------------------------------------------------------------
// Drum grids: one token per step, as in the design's tables.
//   ·          no trig
//   120        a trig at velocity 120
//   68[1:2]    velocity 68 with the trig condition 1:2 (also [1ST], [4:4] ...)
// Bars are concatenated: a 2-bar row is 32 tokens.
// ----------------------------------------------------------------------------

export function drumRow(row: string): Record<number, Step> {
  const out: Record<number, Step> = {};
  tokens(row).forEach((t, i) => {
    if (isRest(t)) return;
    const m = /^(\d+)(?:\[([^\]]+)\])?$/.exec(t);
    if (!m) throw new Error(`demo: bad drum cell "${t}"`);
    const step: Step = { vel: Number(m[1]) };
    if (m[2]) step.cond = m[2];
    out[i] = step;
  });
  return out;
}

/** Merge per-step extras (locks, micro timing, retrigs, notes) into a track's steps (1-based step numbers) */
export function withSteps(steps: Record<number, Step>, extra: Record<number, Partial<Step>>): Record<number, Step> {
  const out = { ...steps };
  for (const [k, s] of Object.entries(extra)) {
    const i = Number(k) - 1;
    const cur = out[i] ?? {};
    const locks: Locks = { ...(cur.locks ?? {}), ...(s.locks ?? {}) };
    out[i] = { ...cur, ...s, ...(Object.keys(locks).length ? { locks } : {}) };
  }
  return out;
}

/** The same extra on several steps (1-based) */
export function onSteps(stepNumbers: number[], extra: Partial<Step>): Record<number, Partial<Step>> {
  return Object.fromEntries(stepNumbers.map(n => [n, extra]));
}

// ----------------------------------------------------------------------------
// Melodic grids (Analog Four): one bar is three rows of 16 tokens - NOTE, VEL, LEN.
// ----------------------------------------------------------------------------

export interface MelodicBar { note: string; vel: string; len: string }

/** Steps of consecutive bars (bar 1 = steps 0..15) */
export function melodic(bars: (MelodicBar | null)[]): Record<number, Step> {
  const out: Record<number, Step> = {};
  bars.forEach((bar, b) => {
    if (!bar) return;
    const n = tokens(bar.note), v = tokens(bar.vel), l = tokens(bar.len);
    if (n.length !== 16 || v.length !== 16 || l.length !== 16) throw new Error(`demo: a melodic bar needs 16 cells per row (bar ${b + 1})`);
    n.forEach((t, i) => {
      if (isRest(t)) return;
      out[b * 16 + i] = { note: nn(t), vel: Number(v[i]), len: lenIndex(Number(l[i])) };
    });
  });
  return out;
}

/** Every trig of `steps` with a condition (OUTRO stabs at 1:2) */
export function withCondition(steps: Record<number, Step>, cond: string): Record<number, Step> {
  return Object.fromEntries(Object.entries(steps).map(([k, s]) => [k, { ...s, cond }]));
}

/** Locks on every trig of `steps` (a pad turned out of the stab tracks) */
export function withLocks(steps: Record<number, Step>, locks: Locks | ((step: number) => Locks)): Record<number, Step> {
  return Object.fromEntries(Object.entries(steps).map(([k, s]) => {
    const add = typeof locks === 'function' ? locks(Number(k)) : locks;
    return [k, Object.keys(add).length ? { ...s, locks: { ...(s.locks ?? {}), ...add } } : s];
  }));
}

/** A pattern from per-track steps (track index -> steps) */
export function elektronPattern(
  tracks: number,
  init: { name: string; length: number; swing?: number; speed?: Speed; kit?: string },
  steps: Record<number, Record<number, Step>>,
  defaults: Record<number, { note?: number; vel?: number; len?: number }> = {},
): Pattern {
  const p = createPattern(tracks, { name: init.name, length: init.length, swing: init.swing ?? 50, speed: init.speed ?? '1x', kit: init.kit ?? '' });
  for (const [t, d] of Object.entries(defaults)) Object.assign(p.tracks[Number(t)], d);
  for (const [t, s] of Object.entries(steps)) p.tracks[Number(t)].steps = s;
  return p;
}

// ----------------------------------------------------------------------------
// Xone:96 knob laws (devices/xone96/model.ts), as the design writes them in dB
// ----------------------------------------------------------------------------

/** HI / LO kill knobs (-1..1): +6 dB fully clockwise, a full kill anticlockwise */
export function xoneKill(db: number): number {
  if (db >= 0) return Math.min(1, db / 6);
  return Math.max(-1, Math.sqrt(Math.pow(10, db / 20)) - 1);
}

/** HI MID / LO MID (-1..1): +10 dB boost, -27 dB (channels 1-4) or -24 dB (A / B) cut */
export function xoneMid(db: number, aux = false): number {
  if (db >= 0) return Math.min(1, db / 10);
  return Math.max(-1, db / (aux ? 24 : 27));
}

/** Xone channel FILTER assign switch ['1', 'OFF', '2'] */
export const XFILTER = { one: 0, off: 1, two: 2 } as const;
/** Xone FILTER TYPE options */
export const XTYPE = { hpf: 0, bpf: 1, lpf: 2 } as const;
/** Xone deck source NONE: the built-in decks stay silent in the demos */
export const XDECK_NONE = 8;

// ----------------------------------------------------------------------------
// Studio documents
// ----------------------------------------------------------------------------

export const instance = (controlValues: Values, extra: Partial<InstanceState> = {}): InstanceState => ({
  controlValues, patchConnections: [], ...extra,
});

export const strip = (gain: number, pan = 0): Partial<ChannelDoc> => ({ gain, pan, sendA: MIN_DB, sendB: MIN_DB, mute: false, solo: false });

export function mixer(channels: Record<string, Partial<ChannelDoc>>, masterGain: number): MixerDoc {
  return {
    channels,
    master: { gain: masterGain, eq: { on: false }, glue: { on: false } },
  };
}

export const section = (id: string, name: string, bars: number, color: string, parts: Record<string, SectionPart>): ArrangementSection =>
  ({ id, name, bars, color, parts });
