/**
 * Fresh material on demand: rhythms to tap, patterns to echo by ear and
 * short melodies to read at sight. Each is built from a seed, so a given
 * exercise can be shown again exactly.
 */

import type { MusicInline } from '../content/types';
import { chordPitches, diatonicTriads, parsePitch, pitchName, pitchToMidi, scaleFingering, scaleRun } from '../music/theory';
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

// ----------------------------------------------------------------- chords

export interface ChordExercise {
  music: MusicInline;
  /** Whole chords, or each chord one note at a time from the note it is named after. */
  style: 'block' | 'broken';
  /** The chart shows scale steps, such as I, V, vi, IV, in place of letter names. */
  byNumber: boolean;
  key: string;
}

/** Progressions on the three main chords of a key, as scale steps. */
const PLAIN: number[][] = [
  [1, 4, 5, 1],
  [1, 5, 4, 1],
  [1, 4, 1, 5],
  [1, 1, 4, 5],
  [4, 5, 1, 1],
  [1, 5, 1, 4],
];

/** Progressions that bring in the minor chords of the key. */
const WITH_MINOR: number[][] = [
  [1, 5, 6, 4],
  [1, 6, 4, 5],
  [6, 4, 1, 5],
  [1, 4, 6, 5],
  [2, 5, 1, 1],
  [1, 6, 2, 5],
  [4, 1, 5, 6],
  [1, 4, 2, 5],
];

interface ChordSpec {
  keys: string[];
  pool: number[][];
  style: 'block' | 'broken';
  byNumber: boolean;
}

/**
 * The ladder: whole chords, then the same chords broken into single notes,
 * in C, then with minor chords, then in other keys, and last from numbers alone.
 */
const CHORD_LADDER: ChordSpec[] = [
  { keys: ['C'], pool: PLAIN, style: 'block', byNumber: false },
  { keys: ['C'], pool: PLAIN, style: 'broken', byNumber: false },
  { keys: ['C'], pool: WITH_MINOR, style: 'block', byNumber: false },
  { keys: ['C'], pool: WITH_MINOR, style: 'broken', byNumber: false },
  { keys: ['G', 'F'], pool: [...PLAIN, ...WITH_MINOR], style: 'block', byNumber: false },
  { keys: ['G', 'F', 'D'], pool: [...PLAIN, ...WITH_MINOR], style: 'broken', byNumber: false },
  { keys: ['C', 'G', 'F', 'D'], pool: WITH_MINOR, style: 'block', byNumber: true },
  { keys: ['C', 'G', 'F', 'D'], pool: WITH_MINOR, style: 'broken', byNumber: true },
];

export const CHORD_LEVELS = CHORD_LADDER.length;

/** How far up the ladder the lessons taken so far reach. */
export function chordLevelCap(done: (lessonId: string) => boolean): number {
  if (done('progressions')) return 8;
  if (done('keys')) return 6;
  if (done('minor-chords')) return 4;
  return 2;
}

/** Four chords of a key, to be played from their symbols. */
export function chordExercise(level: number, seed: number): ChordExercise {
  const spec = CHORD_LADDER[Math.max(0, Math.min(CHORD_LADDER.length - 1, level - 1))];
  const rnd = mulberry32(seed * 49979687 + level * 53);
  const key = pick(spec.keys, rnd);
  const degrees = pick(spec.pool, rnd);
  const triads = diatonicTriads(key, 4);
  const measures: string[] = [];
  const symbols: string[] = [];
  for (const degree of degrees) {
    const triad = triads[degree - 1];
    // Written near the middle of the keyboard. The learner may play it anywhere.
    const root = pitchToMidi(triad.root) > 71 ? { ...triad.root, octave: triad.root.octave - 1 } : triad.root;
    const names = chordPitches(root, triad.quality).map(pitchName);
    measures.push(spec.style === 'block' ? `${names.join('+')}w` : `${names[0]}q ${names[1]}q ${names[2]}q ${names[1]}q`);
    symbols.push(spec.byNumber ? triad.roman : triad.symbol);
  }
  return {
    music: { rh: measures.join(' | '), key, tempo: 72, chords: symbols.join(' | ') },
    style: spec.style,
    byNumber: spec.byNumber,
    key,
  };
}

// ----------------------------------------------------- scales and arpeggios

export interface TechniqueExercise {
  music: MusicInline;
  /** What it is, for the line above the stand: "The scale of G major, left hand". */
  name: string;
}

type TechKind = 'scale' | 'quick-scale' | 'arpeggio' | 'sweep';

interface TechSpec {
  kind: TechKind;
  /** Keys for scales, chords for arpeggios. */
  on: string[];
  hands: Array<'R' | 'L'>;
}

/**
 * The ladder: the scale of C, then G and F, then one octave arpeggios on the
 * white key chords, then an arpeggio passed between the hands, then scales
 * twice as fast.
 */
const TECH_LADDER: TechSpec[] = [
  { kind: 'scale', on: ['C'], hands: ['R'] },
  { kind: 'scale', on: ['C'], hands: ['L'] },
  { kind: 'scale', on: ['G'], hands: ['R', 'L'] },
  { kind: 'scale', on: ['F'], hands: ['R', 'L'] },
  { kind: 'arpeggio', on: ['C', 'F', 'G'], hands: ['R', 'L'] },
  { kind: 'arpeggio', on: ['Am', 'Dm', 'Em'], hands: ['R', 'L'] },
  { kind: 'sweep', on: ['C', 'F', 'G'], hands: ['R'] },
  { kind: 'quick-scale', on: ['C', 'G', 'F'], hands: ['R', 'L'] },
];

export const TECH_LEVELS = TECH_LADDER.length;

/** How far up the ladder the lessons taken so far reach. */
export function techniqueLevelCap(done: (lessonId: string) => boolean): number {
  if (done('arpeggios')) return 8;
  if (done('keys')) return 4;
  return 2;
}

/** Where each one octave scale or arpeggio starts, so that it sits in a comfortable part of the keyboard. */
const START: Record<string, { R: string; L: string }> = {
  C: { R: 'C4', L: 'C3' },
  G: { R: 'G4', L: 'G2' },
  F: { R: 'F4', L: 'F2' },
  Am: { R: 'A3', L: 'A2' },
  Dm: { R: 'D4', L: 'D3' },
  Em: { R: 'E4', L: 'E3' },
};

const handName = (hand: 'R' | 'L') => (hand === 'R' ? 'right hand' : 'left hand');
const chordName = (symbol: string) => (symbol.endsWith('m') ? `${symbol[0]} minor` : `${symbol} major`);

/** A scale up and down, as text notation with a finger on every note. */
function scaleText(key: string, hand: 'R' | 'L', quick: boolean): string {
  const up = scaleRun(parsePitch(START[key][hand]), 'major').map(pitchName);
  // Standard fingering for the way up. On the way down the same fingers come back in turn.
  const fingers = scaleFingering(key, 'major', hand) ?? [1, 2, 3, 1, 2, 3, 4, 5];
  if (quick) {
    // Eight notes up, seven back, the last one long, with no repeat at the top.
    const names = [...up, ...up.slice(0, -1).reverse()];
    const digits = [...fingers, ...fingers.slice(0, -1).reverse()];
    const toks = names.map((n, i) => `${n}${i === names.length - 1 ? 'q' : 'e'}:${digits[i]}`);
    return `${toks.slice(0, 8).join(' ')} | ${toks.slice(8).join(' ')}`;
  }
  const names = [...up, ...up.slice().reverse()];
  const digits = [...fingers, ...fingers.slice().reverse()];
  const toks = names.map((n, i) => `${n}q:${digits[i]}`);
  return [0, 4, 8, 12].map((i) => toks.slice(i, i + 4).join(' ')).join(' | ');
}

/** The four notes of a one octave arpeggio from the bottom up: root, third, fifth, root. */
function arpeggioNotes(symbol: string, start: string): string[] {
  const root = parsePitch(start);
  const [a, b, c] = chordPitches(root, symbol.endsWith('m') ? 'min' : 'maj').map(pitchName);
  return [a, b, c, pitchName({ ...root, octave: root.octave + 1 })];
}

/** An arpeggio up and down, played twice. */
function arpeggioText(symbol: string, hand: 'R' | 'L'): string {
  const [a, b, c, top] = arpeggioNotes(symbol, START[symbol][hand]);
  // The fingering every exam board gives for chords on white keys.
  const f = hand === 'R' ? [1, 2, 3, 5] : [5, 4, 2, 1];
  const once = `${a}q:${f[0]} ${b}q:${f[1]} ${c}q:${f[2]} ${top}q:${f[3]} | ${c}q:${f[2]} ${b}q:${f[1]} ${a}h:${f[0]}`;
  return `${once} | ${once}`;
}

/** An arpeggio handed from the left hand to the right and back, as in the lesson on arpeggios. */
function sweepMusic(symbol: string): { rh: string; lh: string } {
  // The left hand sits an octave below the right, low enough to read comfortably in the bass clef.
  const high = symbol === 'C' ? 'C4' : symbol === 'F' ? 'F4' : 'G4';
  const low = symbol === 'C' ? 'C3' : symbol === 'F' ? 'F3' : 'G3';
  const [l1, l2, l3] = arpeggioNotes(symbol, low);
  const [r1, r2, r3, r4] = arpeggioNotes(symbol, high);
  return {
    rh: `rq. ${r1}e:1 ${r2}e:2 ${r3}e:3 ${r4}q:5 | ${r3}e:3 ${r2}e:2 ${r1}e:1 re rh`,
    lh: `${l1}e:5 ${l2}e:3 ${l3}e:1 re rh | rq. ${l3}e:1 ${l2}e:3 ${l1}q.:5`,
  };
}

/** A scale or an arpeggio to play with the beat. */
export function techniqueExercise(level: number, seed: number): TechniqueExercise {
  const spec = TECH_LADDER[Math.max(0, Math.min(TECH_LADDER.length - 1, level - 1))];
  const rnd = mulberry32(seed * 86028121 + level * 71);
  const on = pick(spec.on, rnd);
  const hand = pick(spec.hands, rnd);
  if (spec.kind === 'sweep') {
    return { music: { ...sweepMusic(on), tempo: 66 }, name: `The arpeggio of ${chordName(on)}, passed from the left hand to the right and back` };
  }
  if (spec.kind === 'arpeggio') {
    const text = arpeggioText(on, hand);
    return { music: { ...(hand === 'R' ? { rh: text } : { lh: text }), tempo: 80 }, name: `The arpeggio of ${chordName(on)}, ${handName(hand)}` };
  }
  const quick = spec.kind === 'quick-scale';
  const text = scaleText(on, hand, quick);
  return {
    music: { ...(hand === 'R' ? { rh: text } : { lh: text }), key: on, tempo: quick ? 66 : 84 },
    name: `The scale of ${on} major, ${handName(hand)}${quick ? ', twice as fast' : ''}`,
  };
}

/** How even a run was: the spread of its notes around the beat, in milliseconds. Null when too few notes were timed. */
export function evenness(errorsMs: number[]): number | null {
  if (errorsMs.length < 4) return null;
  const mean = errorsMs.reduce((a, e) => a + e, 0) / errorsMs.length;
  return Math.sqrt(errorsMs.reduce((a, e) => a + (e - mean) ** 2, 0) / errorsMs.length);
}

/** A different seed each day and each round, stable within a round. */
export function daySeed(extra = 0): number {
  const d = new Date();
  return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() + extra * 977;
}
