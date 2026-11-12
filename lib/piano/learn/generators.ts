/**
 * Fresh material on demand: rhythms to tap, patterns to echo by ear and
 * short melodies to read at sight. Each is built from a seed, so a given
 * exercise can be shown again exactly.
 */

import type { MusicInline } from '../content/types';
import { mulberry32, pick } from '../util/emitter';

type Rnd = () => number;

// ---------------------------------------------------------------- rhythm

/** Rhythm cells by level. Each cell fills two beats. */
const CELLS: string[][] = [
  ['q q', 'h'],
  ['q q', 'h', 'q rq', 'rq q'],
  ['q q', 'h', 'e e q', 'q e e', 'e e e e'],
  ['q q', 'e e q', 'q e e', 'q. e', 'e e e e', 'h'],
  ['q. e', 'e q e', 'e e q', 'q e e', 're e q', 'e e e e', 'q q'],
  ['s s s s q', 'q s s s s', 'e s s q', 'q. e', 'e q e', 'e e e e', 's s e q'],
];

export const RHYTHM_LEVELS = CELLS.length;

function rhythmMeasure(level: number, rnd: Rnd, pitch: string, last: boolean): string {
  const cells = CELLS[Math.max(0, Math.min(CELLS.length - 1, level - 1))];
  if (last) {
    const first = pick(cells, rnd);
    return `${withPitch(first, pitch)} ${pitch}h`;
  }
  if (level <= 2 && rnd() < 0.15) return `${pitch}w`;
  return `${withPitch(pick(cells, rnd), pitch)} ${withPitch(pick(cells, rnd), pitch)}`;
}

function withPitch(cell: string, pitch: string): string {
  return cell
    .split(' ')
    .map((tok) => (tok.startsWith('r') ? tok : `${pitch}${tok}`))
    .join(' ');
}

/** A four measure rhythm on one note. */
export function rhythmExercise(level: number, seed: number): MusicInline {
  const rnd = mulberry32(seed * 7919 + level * 31);
  const pitch = 'B4';
  const measures: string[] = [];
  for (let m = 0; m < 4; m++) measures.push(rhythmMeasure(level, rnd, pitch, m === 3));
  const tempo = level <= 2 ? 80 : level <= 4 ? 76 : 66;
  return { rh: measures.join(' | '), tempo };
}

// ------------------------------------------------------------------- ear

const C_POSITION = ['C4', 'D4', 'E4', 'F4', 'G4'];
const C_POSITION_LEFT = ['C3', 'D3', 'E3', 'F3', 'G3'];

export const EAR_LEVELS = 5;

/** A short pattern to hear and play back. Always starts on C, the stated anchor. */
export function earExercise(level: number, seed: number, hand: 'R' | 'L' = 'R'): MusicInline {
  const rnd = mulberry32(seed * 104729 + level * 17);
  const scale = hand === 'R' ? C_POSITION : C_POSITION_LEFT;
  const count = level <= 1 ? 3 : level <= 3 ? 4 : 5;
  const maxLeap = level <= 2 ? 1 : level <= 3 ? 2 : 4;
  const idx: number[] = [0];
  for (let i = 1; i < count; i++) {
    const prev = idx[i - 1];
    const moves: number[] = [];
    for (let d = -maxLeap; d <= maxLeap; d++) {
      if (d === 0 && level < 4) continue;
      const n = prev + d;
      if (n >= 0 && n < scale.length) moves.push(n);
    }
    // Favour steps, as real melodies do.
    const steps = moves.filter((n) => Math.abs(n - prev) === 1);
    idx.push(steps.length > 0 && rnd() < 0.6 ? pick(steps, rnd) : pick(moves, rnd));
  }
  const tokens: string[] =
    count === 3
      ? [`${scale[idx[0]]}q`, `${scale[idx[1]]}q`, `${scale[idx[2]]}h`]
      : count === 4
        ? idx.map((i) => `${scale[i]}q`)
        : [`${scale[idx[0]]}q`, `${scale[idx[1]]}q`, `${scale[idx[2]]}e`, `${scale[idx[3]]}e`, `${scale[idx[4]]}q`];
  const text = tokens.join(' ');
  return hand === 'R' ? { rh: text, tempo: 88 } : { lh: text, tempo: 88 };
}

// ---------------------------------------------------------- sight reading

export const SIGHT_LEVELS = 6;

interface SightSpec {
  key: string;
  scale: string[];
  hand: 'R' | 'L';
  /** Largest move between neighbours, in scale steps. */
  leap: number;
  cells: string[];
  tempo: number;
  bass?: string[];
}

const SIGHT: SightSpec[] = [
  { key: 'C', scale: C_POSITION, hand: 'R', leap: 1, cells: ['q q', 'h'], tempo: 66 },
  { key: 'C', scale: C_POSITION, hand: 'R', leap: 2, cells: ['q q', 'h', 'q q'], tempo: 66 },
  { key: 'C', scale: C_POSITION_LEFT, hand: 'L', leap: 2, cells: ['q q', 'h'], tempo: 66 },
  { key: 'C', scale: C_POSITION, hand: 'R', leap: 2, cells: ['q q', 'e e q', 'h', 'q e e'], tempo: 63 },
  { key: 'G', scale: ['G4', 'A4', 'B4', 'C5', 'D5'], hand: 'R', leap: 2, cells: ['q q', 'e e q', 'h', 'q. e'], tempo: 63 },
  { key: 'C', scale: C_POSITION, hand: 'R', leap: 2, cells: ['q q', 'h', 'q q'], tempo: 60, bass: ['C3', 'G3', 'F3'] },
];

/** A four measure melody nobody has seen before, at the given level. */
export function sightExercise(level: number, seed: number): MusicInline {
  const spec = SIGHT[Math.max(0, Math.min(SIGHT.length - 1, level - 1))];
  const rnd = mulberry32(seed * 15485863 + level * 101);
  const n = spec.scale.length;
  let pos = pick([0, 2, 4], rnd);
  const first = pos;
  const measures: string[] = [];
  for (let m = 0; m < 4; m++) {
    const last = m === 3;
    const cells = last ? [pick(spec.cells, rnd), 'h'] : [pick(spec.cells, rnd), pick(spec.cells, rnd)];
    const toks: string[] = [];
    cells.forEach((cell, ci) => {
      for (const dur of cell.split(' ')) {
        const closing = last && ci === 1;
        if (closing) {
          pos = 0; // end at home
        } else if (!(m === 0 && toks.length === 0)) {
          const options: number[] = [];
          for (let d = -spec.leap; d <= spec.leap; d++) {
            const q = pos + d;
            if (q >= 0 && q < n && d !== 0) options.push(q);
          }
          const steps = options.filter((q) => Math.abs(q - pos) === 1);
          const r = rnd();
          pos = r < 0.1 ? pos : steps.length > 0 && r < 0.75 ? pick(steps, rnd) : pick(options, rnd);
        }
        toks.push(`${spec.scale[pos]}${dur}`);
      }
    });
    measures.push(toks.join(' '));
  }
  // Mark the starting finger, and nothing else. Reading should do the rest.
  const startFinger = spec.hand === 'R' ? first + 1 : 5 - first;
  const text = measures.join(' | ').replace(/^(\S+)/, `$1:${startFinger}`);
  const out: MusicInline = { key: spec.key, tempo: spec.tempo };
  if (spec.hand === 'R') out.rh = text;
  else out.lh = text;
  if (spec.bass) {
    const bass = [spec.bass[0], pick(spec.bass, rnd), pick(spec.bass.slice(1), rnd), spec.bass[0]];
    out.lh = bass.map((b, i) => `${b}w${i === 0 ? ':5' : ''}`).join(' | ');
  }
  return out;
}

/** A different seed each day and each round, stable within a round. */
export function daySeed(extra = 0): number {
  const d = new Date();
  return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() + extra * 977;
}
