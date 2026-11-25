/**
 * Chords: what a chord symbol means, and how each chord is held on the neck.
 *
 * A shape is written the way chord books write it, from the low E string to
 * the high one: "x32010" is C, with the low E string not played, the A string
 * at the third fret, and so on. Fingers use the same order: 1 is the index
 * finger and 4 the little finger, 0 an open string.
 */

import { OPEN_MIDI, STRINGS, parsePitchClass, pitchClass, type StringNo } from './theory';

export type Quality = '' | 'm' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | 'add9' | '5' | '6' | 'dim';

/** Intervals above the root, in semitones, for each kind of chord. */
const INTERVALS: Record<Quality, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  dim: [0, 3, 6],
};

/** What each kind of chord is called aloud. */
const QUALITY_WORDS: Record<Quality, string> = {
  '': 'major',
  m: 'minor',
  '7': 'seven',
  m7: 'minor seven',
  maj7: 'major seven',
  sus2: 'sus two',
  sus4: 'sus four',
  add9: 'add nine',
  '5': 'five',
  '6': 'six',
  dim: 'diminished',
};

export interface ChordSymbol {
  symbol: string;
  root: number;
  quality: Quality;
  /** The bass note of a slash chord such as G/B, or null. */
  bass: number | null;
}

const SYMBOL_RE = /^([A-G](?:#|b)?)(m7|maj7|m|7|sus2|sus4|add9|5|6|dim)?(?:\/([A-G](?:#|b)?))?$/;

export function parseChord(symbol: string): ChordSymbol {
  const m = SYMBOL_RE.exec(symbol.trim());
  if (!m) throw new Error(`Not a chord symbol: "${symbol}"`);
  return { symbol, root: parsePitchClass(m[1]), quality: (m[2] ?? '') as Quality, bass: m[3] ? parsePitchClass(m[3]) : null };
}

export function isChordSymbol(s: string): boolean {
  return SYMBOL_RE.test(s.trim());
}

/** The pitch classes a chord is made of. */
export function chordPitchClasses(symbol: string): number[] {
  const c = parseChord(symbol);
  const pcs = INTERVALS[c.quality].map((i) => pitchClass(c.root + i));
  if (c.bass !== null && !pcs.includes(c.bass)) pcs.push(c.bass);
  return pcs;
}

/** How to say a chord's name: "E minor", "A seven", "D". */
export function sayChord(symbol: string): string {
  const c = parseChord(symbol);
  const root = symbol.match(/^[A-G](#|b)?/)![0].replace('#', ' sharp').replace(/^([A-G])b$/, '$1 flat');
  const q = c.quality === '' ? '' : ` ${QUALITY_WORDS[c.quality]}`;
  const bass = c.bass !== null ? ` over ${symbol.split('/')[1]}` : '';
  return `${root}${q}${bass}`;
}

/** Whether a chord sounds major, minor or neither, for ear training. */
export function chordColour(symbol: string): 'major' | 'minor' | 'other' {
  const q = parseChord(symbol).quality;
  if (q === '' || q === '7' || q === 'maj7' || q === '6' || q === 'add9') return 'major';
  if (q === 'm' || q === 'm7') return 'minor';
  return 'other';
}

// ------------------------------------------------------------------ shapes

export interface Barre {
  fret: number;
  /** Strings covered, from the lower string number to the higher one: 1 to 6 for a full barre. */
  from: StringNo;
  to: StringNo;
  finger: number;
}

export interface Shape {
  /** The chord symbol this shape plays. */
  chord: string;
  /** A name for this way of holding it, where there is more than one: "easy", "full". */
  variant?: string;
  /** Low E string first. null is a string that is not played. */
  frets: Array<number | null>;
  /** Fingers in the same order. 0 for an open string, null for one not played. */
  fingers: Array<number | null>;
  barre?: Barre;
  /** One line on how to hold it, for the chord's first lesson and the chord sheet. */
  tip?: string;
}

/** Parse "x32010" into frets, low E first. Two digit frets are written in brackets: "x(10)(12)". */
export function parseFrets(text: string): Array<number | null> {
  const out: Array<number | null> = [];
  const re = /x|\d|\((\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === 'x') out.push(null);
    else out.push(m[1] ? parseInt(m[1], 10) : parseInt(m[0], 10));
  }
  if (out.length !== 6) throw new Error(`A shape needs six strings: "${text}"`);
  return out;
}

function shape(chord: string, frets: string, fingers: string, extra: Partial<Shape> = {}): Shape {
  const f = parseFrets(frets);
  const g = parseFrets(fingers);
  return { chord, frets: f, fingers: g, ...extra };
}

/**
 * Every chord shape the course uses. The first shape listed for a chord is
 * the one taught. The others are named variants, such as an easier form.
 */
export const SHAPES: Shape[] = [
  shape('Em', '022000', '023000', { tip: 'Two fingers on the second fret, side by side. Every string rings.' }),
  shape('E', '022100', '023100', { tip: 'E minor with the first finger added on the G string, first fret.' }),
  shape('E7', '020100', '020100', { tip: 'Like E, with the third finger lifted off the D string.' }),
  shape('Am', 'x02210', 'x02310', { tip: 'The same shape as E, moved over one string. Leave the low E string out.' }),
  shape('A', 'x02220', 'x01230', { tip: 'Three fingers in a row on the second fret, tucked close behind it. Leave the low E string out.' }),
  shape('A7', 'x02020', 'x01030', { tip: 'Like A, with the middle finger lifted so the G string rings open.' }),
  shape('D', 'xx0232', 'xx0132', { tip: 'A small triangle on the top three strings. Strum from the D string down.' }),
  shape('D7', 'xx0212', 'xx0213', { tip: 'A triangle the other way up. Strum from the D string down.' }),
  shape('Dm', 'xx0231', 'xx0231', { tip: 'Like D, with the finger on the high E string moved to the first fret.' }),
  shape('G', '320003', '210003', { tip: 'Fingers on the two thick strings and the thinnest one. All six strings ring.' }),
  shape('G7', '320001', '320001', { tip: 'Like G, with the little finger moved to the first fret of the high E string.' }),
  shape('C', 'x32010', 'x32010', { tip: 'Three fingers stepping down from the A string. Leave the low E string out.' }),
  shape('C7', 'x32310', 'x32410', { tip: 'C with the little finger added on the G string, third fret.' }),
  shape('Fmaj7', 'xx3210', 'xx3210', { tip: 'A friendly stand in for F. Fingers step down across the middle strings, and the high E rings open.' }),
  shape('F', 'xx3211', 'xx3211', {
    variant: 'small',
    barre: { fret: 1, from: 1, to: 2, finger: 1 },
    tip: 'The first finger lies across the two thinnest strings at the first fret. Strum the top four strings.',
  }),
  shape('F', '133211', '134211', {
    variant: 'full',
    barre: { fret: 1, from: 1, to: 6, finger: 1 },
    tip: 'The first finger lies flat across all six strings at the first fret, with the E shape above it.',
  }),
  shape('B7', 'x21202', 'x21304', { tip: 'Four fingers, and the G string open. Take your time with this one.' }),
  shape('Bm', 'xx4432', 'xx3421', { variant: 'small', tip: 'Four strings only. The first finger on the high E string, second fret.' }),
  shape('Bm', 'x24432', 'x13421', {
    variant: 'full',
    barre: { fret: 2, from: 1, to: 5, finger: 1 },
    tip: 'The A minor shape with a first finger barre at the second fret.',
  }),
  shape('Asus2', 'x02200', 'x01200', { tip: 'Two fingers, and the B string open. Bright and easy.' }),
  shape('Asus4', 'x02230', 'x01240', { tip: 'A with the little finger added on the third fret of the B string.' }),
  shape('Dsus2', 'xx0230', 'xx0130', { tip: 'D with the finger on the high E string lifted.' }),
  shape('Dsus4', 'xx0233', 'xx0134', { tip: 'D with the little finger on the third fret of the high E string.' }),
  shape('Em7', '022030', '023040', { tip: 'E minor with the little finger on the B string, third fret.' }),
  shape('Cadd9', 'x32033', 'x21034', { tip: 'Two fingers low and two high, with the third and fourth fingers on the top two strings at the third fret. It pairs well with G.' }),
  shape('G/B', 'x20003', 'x10003', { tip: 'G with its B in the bass. A quick step between C and Am.' }),
  shape('E5', '022xxx', '012xxx', { tip: 'A power chord: three low strings only, the rest kept quiet.' }),
  shape('A5', 'x022xx', 'x012xx', { tip: 'The same power chord moved over one string.' }),
  shape('D5', 'xx023x', 'xx013x', { tip: 'The same shape again, a string higher, with the third fret note.' }),
];

/** The shape a chord is taught with, or a named variant of it. */
export function shapeFor(chord: string, variant?: string): Shape {
  const list = SHAPES.filter((s) => s.chord === chord);
  if (list.length === 0) throw new Error(`No shape for chord "${chord}"`);
  if (variant) {
    const v = list.find((s) => s.variant === variant);
    if (v) return v;
  }
  return list[0];
}

export function hasShape(chord: string): boolean {
  return SHAPES.some((s) => s.chord === chord);
}

/** The strings a shape plays, from the lowest string up. */
export function playedStrings(s: Shape): StringNo[] {
  return STRINGS.filter((_, i) => s.frets[i] !== null);
}

/** The notes a shape sounds, lowest first. */
export function shapeMidis(s: Shape): number[] {
  const out: number[] = [];
  STRINGS.forEach((str, i) => {
    const f = s.frets[i];
    if (f !== null) out.push(OPEN_MIDI[str] + f);
  });
  return out;
}

/** The note a shape sounds on one string, or null when that string is not played. */
export function shapeNoteOn(s: Shape, str: StringNo): number | null {
  const i = STRINGS.indexOf(str);
  const f = s.frets[i];
  return f === null ? null : OPEN_MIDI[str] + f;
}

/** Fingers the shape needs, for the lesson that teaches it. */
export function fingerCount(s: Shape): number {
  return new Set(s.fingers.filter((f): f is number => f !== null && f > 0)).size;
}

/** The lowest and highest fret a shape uses, for drawing a diagram. */
export function fretSpan(s: Shape): { low: number; high: number } {
  const fretted = s.frets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length === 0) return { low: 1, high: 1 };
  return { low: Math.min(...fretted), high: Math.max(...fretted) };
}

/**
 * Fingers that can stay where they are between two shapes: same finger, same
 * string, same fret. The tip a teacher gives for a change.
 */
export function anchorFingers(a: Shape, b: Shape): Array<{ string: StringNo; fret: number; finger: number }> {
  const out: Array<{ string: StringNo; fret: number; finger: number }> = [];
  STRINGS.forEach((str, i) => {
    const fa = a.frets[i];
    const fb = b.frets[i];
    const ga = a.fingers[i];
    const gb = b.fingers[i];
    if (fa !== null && fa > 0 && fa === fb && ga !== null && ga === gb) out.push({ string: str, fret: fa, finger: ga });
  });
  return out;
}
