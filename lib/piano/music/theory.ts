/**
 * Music theory primitives for the piano app.
 *
 * Pitches are kept "spelled" (letter + accidental + octave) wherever notation
 * matters, because F sharp and G flat are the same key but different notes on
 * the staff. MIDI numbers are used wherever only the key matters.
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export interface Pitch {
  /** 0 = C ... 6 = B */
  letter: number;
  /** -2 double flat ... +2 double sharp */
  acc: number;
  /** Scientific octave, middle C = C4 */
  octave: number;
}

export type Hand = 'R' | 'L';

const PITCH_RE = /^([A-G])(##|#|bb|b|n)?(-?\d)$/;

export function parsePitch(s: string): Pitch {
  const m = PITCH_RE.exec(s.trim());
  if (!m) throw new Error(`Bad pitch: "${s}"`);
  const letter = LETTERS.indexOf(m[1] as (typeof LETTERS)[number]);
  const accStr = m[2] ?? '';
  const acc = accStr === '#' ? 1 : accStr === '##' ? 2 : accStr === 'b' ? -1 : accStr === 'bb' ? -2 : 0;
  return { letter, acc, octave: parseInt(m[3], 10) };
}

export function pitchToMidi(p: Pitch): number {
  return 12 * (p.octave + 1) + LETTER_SEMITONES[p.letter] + p.acc;
}

export function midi(s: string): number {
  return pitchToMidi(parsePitch(s));
}

function accText(acc: number, pretty: boolean): string {
  if (acc === 0) return '';
  if (pretty) return acc === 1 ? '♯' : acc === -1 ? '♭' : acc === 2 ? '𝄪' : '𝄫';
  return acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc);
}

/** "C#4" style, ASCII, round trips through parsePitch. */
export function pitchName(p: Pitch): string {
  return `${LETTERS[p.letter]}${accText(p.acc, false)}${p.octave}`;
}

/** Display name without octave, with real sharp and flat signs: "C♯". */
export function pitchLabel(p: Pitch, withOctave = false): string {
  return `${LETTERS[p.letter]}${accText(p.acc, true)}${withOctave ? p.octave : ''}`;
}

const SHARP_SPELLING: Array<[number, number]> = [
  [0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0],
];
const FLAT_SPELLING: Array<[number, number]> = [
  [0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0],
];

export function midiToPitch(m: number, preferFlats = false): Pitch {
  const pc = ((m % 12) + 12) % 12;
  const [letter, acc] = (preferFlats ? FLAT_SPELLING : SHARP_SPELLING)[pc];
  return { letter, acc, octave: Math.floor(m / 12) - 1 };
}

export function midiName(m: number, preferFlats = false): string {
  return pitchName(midiToPitch(m, preferFlats));
}

export function midiLabel(m: number, preferFlats = false, withOctave = false): string {
  return pitchLabel(midiToPitch(m, preferFlats), withOctave);
}

export function pitchClass(m: number): number {
  return ((m % 12) + 12) % 12;
}

export function isBlackKey(m: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitchClass(m));
}

/** Equal temperament frequency for a MIDI note. */
export function midiToFreq(m: number, a4 = 440): number {
  return a4 * Math.pow(2, (m - 69) / 12);
}

export function freqToMidi(f: number, a4 = 440): number {
  return 69 + 12 * Math.log2(f / a4);
}

/** Diatonic index used for staff placement and letter arithmetic. */
export function diatonicIndex(p: Pitch): number {
  return p.octave * 7 + p.letter;
}

/**
 * Move a pitch by a number of letter steps and semitones, keeping the correct
 * spelling. A major third up is (2 steps, 4 semitones).
 */
export function transposePitch(p: Pitch, steps: number, semitones: number): Pitch {
  const di = diatonicIndex(p) + steps;
  const letter = ((di % 7) + 7) % 7;
  const octave = Math.floor(di / 7);
  const target = pitchToMidi(p) + semitones;
  const natural = 12 * (octave + 1) + LETTER_SEMITONES[letter];
  return { letter, octave, acc: target - natural };
}

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

export interface IntervalInfo {
  semitones: number;
  short: string;
  name: string;
  steps: number;
}

export const INTERVALS: IntervalInfo[] = [
  { semitones: 0, short: 'P1', name: 'Unison', steps: 0 },
  { semitones: 1, short: 'm2', name: 'Minor 2nd', steps: 1 },
  { semitones: 2, short: 'M2', name: 'Major 2nd', steps: 1 },
  { semitones: 3, short: 'm3', name: 'Minor 3rd', steps: 2 },
  { semitones: 4, short: 'M3', name: 'Major 3rd', steps: 2 },
  { semitones: 5, short: 'P4', name: 'Perfect 4th', steps: 3 },
  { semitones: 6, short: 'TT', name: 'Tritone', steps: 3 },
  { semitones: 7, short: 'P5', name: 'Perfect 5th', steps: 4 },
  { semitones: 8, short: 'm6', name: 'Minor 6th', steps: 5 },
  { semitones: 9, short: 'M6', name: 'Major 6th', steps: 5 },
  { semitones: 10, short: 'm7', name: 'Minor 7th', steps: 6 },
  { semitones: 11, short: 'M7', name: 'Major 7th', steps: 6 },
  { semitones: 12, short: 'P8', name: 'Octave', steps: 7 },
];

// ---------------------------------------------------------------------------
// Keys and scales
// ---------------------------------------------------------------------------

export type Mode = 'major' | 'minor';

export interface KeyInfo {
  /** Key name as used by notation, i.e. "G", "Bb", "Am", "F#m". */
  id: string;
  tonic: Pitch;
  mode: Mode;
  /** Positive = sharps, negative = flats. */
  signature: number;
  label: string;
}

const MAJOR_BY_SIG: Record<number, string> = {
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
  [-1]: 'F', [-2]: 'Bb', [-3]: 'Eb', [-4]: 'Ab', [-5]: 'Db', [-6]: 'Gb', [-7]: 'Cb',
};
const MINOR_BY_SIG: Record<number, string> = {
  0: 'A', 1: 'E', 2: 'B', 3: 'F#', 4: 'C#', 5: 'G#', 6: 'D#', 7: 'A#',
  [-1]: 'D', [-2]: 'G', [-3]: 'C', [-4]: 'F', [-5]: 'Bb', [-6]: 'Eb', [-7]: 'Ab',
};

function buildKeys(): Record<string, KeyInfo> {
  const out: Record<string, KeyInfo> = {};
  for (let sig = -7; sig <= 7; sig++) {
    const maj = MAJOR_BY_SIG[sig];
    const min = MINOR_BY_SIG[sig];
    const mt = parsePitch(maj + '4');
    const nt = parsePitch(min + '4');
    out[maj] = { id: maj, tonic: mt, mode: 'major', signature: sig, label: `${pitchLabel(mt)} major` };
    out[min + 'm'] = { id: min + 'm', tonic: nt, mode: 'minor', signature: sig, label: `${pitchLabel(nt)} minor` };
  }
  return out;
}

export const KEYS: Record<string, KeyInfo> = buildKeys();

export function keyInfo(id: string): KeyInfo {
  const k = KEYS[id];
  if (!k) throw new Error(`Unknown key: ${id}`);
  return k;
}

export function keyPrefersFlats(id: string): boolean {
  return keyInfo(id).signature < 0;
}

/** The order sharps and flats appear in key signatures, as letter indexes. */
export const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
export const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

/** Accidental applied to each letter by a key signature. */
export function signatureAccidentals(id: string): number[] {
  const sig = keyInfo(id).signature;
  const acc = [0, 0, 0, 0, 0, 0, 0];
  if (sig > 0) for (let i = 0; i < sig; i++) acc[SHARP_ORDER[i]] = 1;
  if (sig < 0) for (let i = 0; i < -sig; i++) acc[FLAT_ORDER[i]] = -1;
  return acc;
}

export type ScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'chromatic'
  | 'dorian'
  | 'mixolydian';

/** Each degree as [letter steps, semitones] above the tonic. */
const SCALE_DEGREES: Record<ScaleType, Array<[number, number]>> = {
  major: [[0, 0], [1, 2], [2, 4], [3, 5], [4, 7], [5, 9], [6, 11]],
  naturalMinor: [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 8], [6, 10]],
  harmonicMinor: [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 8], [6, 11]],
  melodicMinor: [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]],
  majorPentatonic: [[0, 0], [1, 2], [2, 4], [4, 7], [5, 9]],
  minorPentatonic: [[0, 0], [2, 3], [3, 5], [4, 7], [6, 10]],
  blues: [[0, 0], [2, 3], [3, 5], [4, 6], [4, 7], [6, 10]],
  chromatic: [[0, 0], [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [3, 6], [4, 7], [4, 8], [5, 9], [5, 10], [6, 11]],
  dorian: [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 9], [6, 10]],
  mixolydian: [[0, 0], [1, 2], [2, 4], [3, 5], [4, 7], [5, 9], [6, 10]],
};

export const SCALE_LABELS: Record<ScaleType, string> = {
  major: 'major',
  naturalMinor: 'natural minor',
  harmonicMinor: 'harmonic minor',
  melodicMinor: 'melodic minor',
  majorPentatonic: 'major pentatonic',
  minorPentatonic: 'minor pentatonic',
  blues: 'blues',
  chromatic: 'chromatic',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
};

/** One octave of a scale starting on the given tonic, without the top tonic. */
export function scalePitches(tonic: Pitch, type: ScaleType): Pitch[] {
  return SCALE_DEGREES[type].map(([steps, semis]) => transposePitch(tonic, steps, semis));
}

/** Ascending scale across octaves, including the final tonic. */
export function scaleRun(tonic: Pitch, type: ScaleType, octaves = 1): Pitch[] {
  const out: Pitch[] = [];
  for (let o = 0; o < octaves; o++) {
    const base = { ...tonic, octave: tonic.octave + o };
    out.push(...scalePitches(base, type));
  }
  out.push({ ...tonic, octave: tonic.octave + octaves });
  return out;
}

/** Pitch classes of a scale, for highlighting and improvisation checks. */
export function scalePitchClasses(tonic: Pitch, type: ScaleType): number[] {
  return scalePitches(tonic, type).map((p) => pitchClass(pitchToMidi(p)));
}

// ---------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------

export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | 'sus4' | 'sus2' | 'maj7' | '7' | 'm7' | 'm7b5' | 'dim7' | '6' | 'm6';

const CHORD_TONES: Record<ChordQuality, Array<[number, number]>> = {
  maj: [[0, 0], [2, 4], [4, 7]],
  min: [[0, 0], [2, 3], [4, 7]],
  dim: [[0, 0], [2, 3], [4, 6]],
  aug: [[0, 0], [2, 4], [4, 8]],
  sus4: [[0, 0], [3, 5], [4, 7]],
  sus2: [[0, 0], [1, 2], [4, 7]],
  maj7: [[0, 0], [2, 4], [4, 7], [6, 11]],
  '7': [[0, 0], [2, 4], [4, 7], [6, 10]],
  m7: [[0, 0], [2, 3], [4, 7], [6, 10]],
  m7b5: [[0, 0], [2, 3], [4, 6], [6, 10]],
  dim7: [[0, 0], [2, 3], [4, 6], [6, 9]],
  '6': [[0, 0], [2, 4], [4, 7], [5, 9]],
  m6: [[0, 0], [2, 3], [4, 7], [5, 9]],
};

const CHORD_SUFFIX: Record<ChordQuality, string> = {
  maj: '', min: 'm', dim: '°', aug: '+', sus4: 'sus4', sus2: 'sus2',
  maj7: 'maj7', '7': '7', m7: 'm7', m7b5: 'm7♭5', dim7: '°7', '6': '6', m6: 'm6',
};

export const CHORD_LABELS: Record<ChordQuality, string> = {
  maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented', sus4: 'suspended 4th', sus2: 'suspended 2nd',
  maj7: 'major 7th', '7': 'dominant 7th', m7: 'minor 7th', m7b5: 'half diminished', dim7: 'diminished 7th',
  '6': 'major 6th', m6: 'minor 6th',
};

/** Chord tones from the bass up. Inversion 1 puts the third in the bass, and so on. */
export function chordPitches(root: Pitch, quality: ChordQuality, inversion = 0): Pitch[] {
  const tones = CHORD_TONES[quality].map(([steps, semis]) => transposePitch(root, steps, semis));
  const inv = ((inversion % tones.length) + tones.length) % tones.length;
  for (let i = 0; i < inv; i++) {
    const t = tones.shift()!;
    tones.push({ ...t, octave: t.octave + 1 });
  }
  return tones;
}

export function chordSymbol(root: Pitch, quality: ChordQuality): string {
  return `${pitchLabel(root)}${CHORD_SUFFIX[quality]}`;
}

const SYMBOL_RE = /^([A-G])(#|b)?(maj7|m7b5|dim7|sus4|sus2|m7|m6|dim|aug|m|7|6|\+|°)?(?:\/([A-G])(#|b)?)?$/;

export interface ParsedChord {
  root: Pitch;
  quality: ChordQuality;
  /** Optional slash bass note as a pitch class. */
  bass?: Pitch;
  label: string;
}

/** Parse plain chord symbols such as "C", "Am", "G7", "F/C", "Bdim". */
export function parseChordSymbol(sym: string, octave = 3): ParsedChord {
  const m = SYMBOL_RE.exec(sym.trim());
  if (!m) throw new Error(`Bad chord symbol: "${sym}"`);
  const root = parsePitch(`${m[1]}${m[2] ?? ''}${octave}`);
  const q = m[3] ?? '';
  const quality: ChordQuality =
    q === '' ? 'maj' : q === 'm' ? 'min' : q === 'dim' || q === '°' ? 'dim' : q === 'aug' || q === '+' ? 'aug' : (q as ChordQuality);
  const bass = m[4] ? parsePitch(`${m[4]}${m[5] ?? ''}${octave}`) : undefined;
  const label = chordSymbol(root, quality) + (bass ? `/${pitchLabel(bass)}` : '');
  return { root, quality, bass, label };
}

const MAJOR_TRIAD_QUALITIES: ChordQuality[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const MINOR_TRIAD_QUALITIES: ChordQuality[] = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface DiatonicChord {
  degree: number;
  root: Pitch;
  quality: ChordQuality;
  roman: string;
  symbol: string;
}

/** Triads built on each degree of a major or natural minor key. */
export function diatonicTriads(keyId: string, octave = 3): DiatonicChord[] {
  const k = keyInfo(keyId);
  const tonic = { ...k.tonic, octave };
  const scale = scalePitches(tonic, k.mode === 'major' ? 'major' : 'naturalMinor');
  const quals = k.mode === 'major' ? MAJOR_TRIAD_QUALITIES : MINOR_TRIAD_QUALITIES;
  return scale.map((root, i) => {
    const quality = quals[i];
    let roman = ROMAN[i];
    if (quality === 'min' || quality === 'dim') roman = roman.toLowerCase();
    if (quality === 'dim') roman += '°';
    return { degree: i + 1, root, quality, roman, symbol: chordSymbol(root, quality) };
  });
}

// ---------------------------------------------------------------------------
// Fingering
// ---------------------------------------------------------------------------

/**
 * Standard one octave scale fingerings, ascending, eight notes including the
 * top tonic. Left hand lists are also ascending. These follow the fingerings
 * taught by the major exam boards.
 */
const MAJOR_FINGERING: Record<string, { R: number[]; L: number[] }> = {
  C: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  G: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  D: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  A: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  E: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  B: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [4, 3, 2, 1, 4, 3, 2, 1] },
  'F#': { R: [2, 3, 4, 1, 2, 3, 1, 2], L: [4, 3, 2, 1, 3, 2, 1, 4] },
  Gb: { R: [2, 3, 4, 1, 2, 3, 1, 2], L: [4, 3, 2, 1, 3, 2, 1, 4] },
  Db: { R: [2, 3, 1, 2, 3, 4, 1, 2], L: [3, 2, 1, 4, 3, 2, 1, 3] },
  'C#': { R: [2, 3, 1, 2, 3, 4, 1, 2], L: [3, 2, 1, 4, 3, 2, 1, 3] },
  Ab: { R: [3, 4, 1, 2, 3, 1, 2, 3], L: [3, 2, 1, 4, 3, 2, 1, 3] },
  Eb: { R: [3, 1, 2, 3, 4, 1, 2, 3], L: [3, 2, 1, 4, 3, 2, 1, 3] },
  Bb: { R: [4, 1, 2, 3, 1, 2, 3, 4], L: [3, 2, 1, 4, 3, 2, 1, 3] },
  F: { R: [1, 2, 3, 4, 1, 2, 3, 4], L: [5, 4, 3, 2, 1, 3, 2, 1] },
};

/** Natural and harmonic minor share these fingerings for the keys listed. */
const MINOR_FINGERING: Record<string, { R: number[]; L: number[] }> = {
  A: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  E: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  D: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  G: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  C: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [5, 4, 3, 2, 1, 3, 2, 1] },
  B: { R: [1, 2, 3, 1, 2, 3, 4, 5], L: [4, 3, 2, 1, 4, 3, 2, 1] },
  F: { R: [1, 2, 3, 4, 1, 2, 3, 4], L: [5, 4, 3, 2, 1, 3, 2, 1] },
};

export function scaleFingering(tonicLetterName: string, mode: Mode, hand: Hand): number[] | undefined {
  const table = mode === 'major' ? MAJOR_FINGERING : MINOR_FINGERING;
  return table[tonicLetterName]?.[hand];
}

export function hasScaleFingering(tonicLetterName: string, mode: Mode): boolean {
  return (mode === 'major' ? MAJOR_FINGERING : MINOR_FINGERING)[tonicLetterName] !== undefined;
}

/** Fingering for a three note chord, low to high. */
export function triadFingering(hand: Hand, inversion: number): number[] {
  if (hand === 'R') return inversion === 1 ? [1, 2, 5] : [1, 3, 5];
  return inversion === 2 ? [5, 2, 1] : [5, 3, 1];
}

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------

export type DurSym = 'w' | 'h' | 'q' | 'e' | 's';

/** Length in quarter note beats. */
export const DUR_BEATS: Record<DurSym, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

export const DUR_NAMES: Record<DurSym, string> = {
  w: 'whole note', h: 'half note', q: 'quarter note', e: 'eighth note', s: 'sixteenth note',
};

export type TimeSig = [number, number];

/** Length of a full measure in quarter note beats. */
export function measureBeats(time: TimeSig): number {
  return (time[0] * 4) / time[1];
}

export function isCompound(time: TimeSig): boolean {
  return time[1] === 8 && time[0] % 3 === 0 && time[0] > 3;
}

/** Length of one felt pulse in quarter note beats. */
export function pulseBeats(time: TimeSig): number {
  return isCompound(time) ? 1.5 : 4 / time[1];
}

export function pulsesPerMeasure(time: TimeSig): number {
  return Math.round(measureBeats(time) / pulseBeats(time));
}
