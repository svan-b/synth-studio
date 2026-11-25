/**
 * The guitar as numbers: pitches, the six strings, frets, and time.
 *
 * Strings are numbered the way guitarists number them: 1 is the thinnest,
 * highest string and 6 is the thickest, lowest one. A place on the neck is a
 * string and a fret, where fret 0 is the open string.
 */

export type StringNo = 1 | 2 | 3 | 4 | 5 | 6;
export type TimeSig = [number, number];

export const STRINGS: StringNo[] = [6, 5, 4, 3, 2, 1];

/** Standard tuning, E A D G B E, as MIDI note numbers for strings 6 down to 1. */
export const OPEN_MIDI: Record<StringNo, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };

/** What each string is called, the way a teacher would say it. */
export const STRING_NAME: Record<StringNo, string> = {
  6: 'low E',
  5: 'A',
  4: 'D',
  3: 'G',
  2: 'B',
  1: 'high E',
};

/** The letter printed beside each line of tab, low to high: E A D G B e. */
export const STRING_LETTER: Record<StringNo, string> = { 6: 'E', 5: 'A', 4: 'D', 3: 'G', 2: 'B', 1: 'e' };

/** Frets a learner meets in this course. Beyond this the neck is not drawn. */
export const MAX_FRET = 15;

export interface Place {
  string: StringNo;
  fret: number;
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/** Cents from `b` to `a`. Positive when `a` is higher. */
export function cents(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}

/** Parse a note name such as "E2", "F#3" or "Bb4" into a MIDI number. */
export function parseNote(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Not a note: "${name}"`);
  let pc = LETTER_PC[m[1]];
  if (m[2] === '#') pc += 1;
  if (m[2] === 'b') pc -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + pc;
}

/** Parse a pitch class such as "F#" or "Bb". */
export function parsePitchClass(name: string): number {
  const m = /^([A-G])(#|b)?$/.exec(name.trim());
  if (!m) throw new Error(`Not a note name: "${name}"`);
  let pc = LETTER_PC[m[1]];
  if (m[2] === '#') pc += 1;
  if (m[2] === 'b') pc -= 1;
  return pitchClass(pc);
}

/** A note's letter name, with flats when asked for. */
export function noteLetter(midi: number, flats = false): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[pitchClass(midi)];
}

/** A note's name with its octave, such as "E2". */
export function noteName(midi: number, flats = false): string {
  return `${noteLetter(midi, flats)}${Math.floor(midi / 12) - 1}`;
}

/** Spoken form of a letter name: "F sharp", "B flat". */
export function sayLetter(letter: string): string {
  return letter.replace('#', ' sharp').replace(/^([A-G])b$/, '$1 flat');
}

export function placeMidi(p: Place): number {
  return OPEN_MIDI[p.string] + p.fret;
}

/**
 * Where a beginner plays a note: in the first position, on the open strings
 * and the first four frets, choosing the lowest fret that reaches it. That is
 * the one place a note sits for someone who has not yet moved up the neck.
 */
export function firstPosition(midi: number): Place | null {
  let best: Place | null = null;
  for (const s of STRINGS) {
    const fret = midi - OPEN_MIDI[s];
    if (fret < 0 || fret > 4) continue;
    if (!best || fret < best.fret) best = { string: s, fret };
  }
  return best;
}

/** The place for a note on a given string, or null if the string cannot reach it. */
export function onString(midi: number, s: StringNo): Place | null {
  const fret = midi - OPEN_MIDI[s];
  return fret >= 0 && fret <= MAX_FRET + 5 ? { string: s, fret } : null;
}

/** The string whose open note is nearest a frequency, as a tuner would pick it. */
export function nearestString(freq: number): StringNo {
  const m = freqToMidi(freq);
  let best: StringNo = 6;
  let bestD = Infinity;
  for (const s of STRINGS) {
    const d = Math.abs(m - OPEN_MIDI[s]);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// ------------------------------------------------------------------- time

/** Beats in a measure. One beat is always a quarter note, as in the piano app. */
export function measureBeats(time: TimeSig): number {
  return (time[0] * 4) / time[1];
}

/** Compound times, felt in dotted quarter beats. */
export function isCompound(time: TimeSig): boolean {
  return time[1] === 8 && time[0] % 3 === 0 && time[0] > 3;
}

/** Length of one counted beat in quarter notes: a dotted quarter in 6/8, otherwise the bottom number's note. */
export function pulseBeats(time: TimeSig): number {
  return isCompound(time) ? 1.5 : 4 / time[1];
}

/** Counted beats in a measure: 4 in 4/4, 3 in 3/4, 2 in 6/8. */
export function pulsesPerMeasure(time: TimeSig): number {
  return Math.round(measureBeats(time) / pulseBeats(time));
}

export type DurSym = 'w' | 'h' | 'q' | 'e' | 's';

export const DUR_BEATS: Record<DurSym, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
