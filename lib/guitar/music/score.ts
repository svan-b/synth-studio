/**
 * Guitar music and the compact text it is written in.
 *
 * There are two ways to write music for the course.
 *
 * A line, for single notes, tab and anything picked note by note. Measures
 * are separated by "|" and tokens by spaces:
 *
 *   E4q          the E above middle C, a quarter note, in the first position
 *   F#4e@1       on string 1, wherever that puts it on the neck
 *   G3q@3:2      on string 3, with the second finger
 *   E2+B2+E3h    three notes at once, each in the first position
 *   E2+B2h@6+5   with a string for each note, low to high
 *   [Em]q        a down strum of E minor
 *   [G]eu        an up strum of G, an eighth note
 *   rq           a quarter rest
 *   C4q~         tied into the next note
 *
 * Durations: w whole, h half, q quarter, e eighth, s sixteenth, with up to
 * two dots, and t for a triplet. One beat is always a quarter note.
 *
 * A chart, for strummed and picked songs. Chords are written per counted
 * beat, with "." to keep the chord going, or one chord for the whole measure:
 *
 *   G . . . | C . G . | D | G
 *
 * and a pattern says what the strumming hand does in each measure, one
 * character for each eighth note:
 *
 *   D.DU.UDU     down, down up, up down up
 *   B.D.D.       a bass note, then two strums: a waltz
 *
 * D is a down strum, U an up strum, B the chord's bass note, A the
 * alternate bass note, and "." a moment where nothing is struck. A picking
 * pattern is written with spaces, one token per eighth note: p for the bass
 * string, digits for strings, and + to play two at once:
 *
 *   p 3 2 1 2 3  or  p+1 . 3 . 2 .
 */

import { anchorFingers, hasShape, playedStrings, shapeFor, shapeNoteOn, type Shape } from './chords';
import {
  DUR_BEATS,
  OPEN_MIDI,
  STRINGS,
  firstPosition,
  measureBeats,
  onString,
  parseNote,
  pitchClass,
  pulseBeats,
  pulsesPerMeasure,
  type DurSym,
  type Place,
  type StringNo,
  type TimeSig,
} from './theory';

export type Direction = 'down' | 'up';

interface EventBase {
  id: string;
  /** Onset in beats from the start of the score. */
  start: number;
  /** Written length in beats. */
  dur: number;
  /** Measure index in this score. */
  measure: number;
}

export interface NoteEvent extends EventBase {
  kind: 'note';
  midi: number;
  place: Place;
  finger?: number;
  /** Continues a tie and is not played again. */
  tied: boolean;
  /** Part of a chord pattern: the chord it belongs to. */
  chord?: string;
}

export interface StrumEvent extends EventBase {
  kind: 'strum';
  chord: string;
  shape: Shape;
  dir: Direction;
  /** Strings the strum is expected to sound, in the order the pick meets them. */
  strings: StringNo[];
  /** Notes those strings sound, lowest first. */
  midis: number[];
}

export type GEvent = NoteEvent | StrumEvent;

/** One moment the learner plays: some notes struck together, or one strum. */
export interface Step {
  index: number;
  start: number;
  measure: number;
  notes: NoteEvent[];
  strum: StrumEvent | null;
}

export interface ChordMark {
  measure: number;
  /** Beat position in the score. */
  start: number;
  /** Beats it lasts. */
  beats: number;
  symbol: string;
}

export interface ScoreSource {
  time?: TimeSig;
  /** Quarter notes per minute. */
  tempo?: number;
  /** Length of an opening pickup measure in beats, for lines. */
  pickup?: number;
  /** Single notes, tab and strums written note by note. */
  line?: string;
  /** Chords per beat, for strummed and picked songs. */
  chart?: string;
  /** What the strumming hand does in each measure, one character per eighth note. */
  strum?: string;
  /** What the picking hand does in each measure, one token per eighth note. */
  pick?: string;
  /** Chord shapes to use in place of the usual ones, such as { F: 'small' }. */
  variants?: Record<string, string>;
  /** A capo at this fret: the shapes and frets stay the same, and every note sounds this many semitones higher. */
  capo?: number;
}

export interface Score {
  time: TimeSig;
  tempo: number;
  pickup: number;
  measureCount: number;
  measureStarts: number[];
  measureLengths: number[];
  totalBeats: number;
  events: GEvent[];
  steps: Step[];
  chords: ChordMark[];
  /** What kind of playing this is, for what to show and how to judge it. */
  kind: 'notes' | 'strum' | 'pick';
  /** Capo fret, 0 for none. */
  capo: number;
  /** Offset of this score's first measure in the score it was sliced from. */
  measureOffset: number;
}

const EPS = 1e-6;

// -------------------------------------------------------------------- lines

const NOTE_RE = /^(r|\[([^\]]+)\]|[A-G](?:#|b)?-?\d(?:\+[A-G](?:#|b)?-?\d)*)([whqes])(\.{0,2})(t?)(d|u)?(?:@([1-6](?:\+[1-6])*))?(?::([0-4]+))?(~?)$/;

interface RawToken {
  kind: 'rest' | 'note' | 'strum';
  midis: number[];
  chord?: string;
  dir: Direction;
  beats: number;
  strings?: StringNo[];
  fingers?: number[];
  tie: boolean;
}

function durBeats(sym: DurSym, dots: number, triplet: boolean): number {
  let beats = DUR_BEATS[sym];
  if (dots === 1) beats *= 1.5;
  if (dots === 2) beats *= 1.75;
  if (triplet) beats *= 2 / 3;
  return beats;
}

function parseToken(tok: string, where: string): RawToken {
  const m = NOTE_RE.exec(tok);
  if (!m) throw new Error(`Bad token "${tok}" ${where}`);
  const beats = durBeats(m[3] as DurSym, m[4].length, m[5] === 't');
  const dir: Direction = m[6] === 'u' ? 'up' : 'down';
  if (m[1] === 'r') return { kind: 'rest', midis: [], dir, beats, tie: false };
  if (m[2] !== undefined) {
    if (!hasShape(m[2])) throw new Error(`No shape for chord "${m[2]}" ${where}`);
    return { kind: 'strum', midis: [], chord: m[2], dir, beats, tie: false };
  }
  const midis = m[1].split('+').map(parseNote);
  const strings = m[7] ? (m[7].split('+').map((d) => parseInt(d, 10)) as StringNo[]) : undefined;
  if (strings && strings.length !== 1 && strings.length !== midis.length) {
    throw new Error(`Give one string for each note in "${tok}" ${where}`);
  }
  const fingers = m[8] ? m[8].split('').map((d) => parseInt(d, 10)) : undefined;
  if (fingers && fingers.length !== midis.length) throw new Error(`Give one finger for each note in "${tok}" ${where}`);
  return { kind: 'note', midis, dir, beats, strings, fingers, tie: m[9] === '~' };
}

function placeFor(midi: number, s: StringNo | undefined, where: string): Place {
  const p = s ? onString(midi, s) : (firstPosition(midi) ?? anywhere(midi));
  if (!p) throw new Error(`Note ${midi} cannot be played ${s ? `on string ${s}` : 'on the guitar'} ${where}`);
  return p;
}

/** Above the first position: the string that reaches the note at the lowest fret. */
function anywhere(midi: number): Place | null {
  let best: Place | null = null;
  for (const st of STRINGS) {
    const fret = midi - OPEN_MIDI[st];
    if (fret < 0 || fret > 20) continue;
    if (!best || fret < best.fret) best = { string: st, fret };
  }
  return best;
}

/** The strings a strum sounds. An up strum catches the thinner strings only. */
export function strumStrings(shape: Shape, dir: Direction): StringNo[] {
  const played = playedStrings(shape);
  if (dir === 'down') return played;
  // Up strums are short: the top four strings of the chord at most, thinnest first.
  return played.slice(-Math.min(4, played.length)).reverse();
}

function makeStrum(id: string, chord: string, dir: Direction, start: number, dur: number, measure: number, variants?: Record<string, string>, capo = 0): StrumEvent {
  const shape = shapeFor(chord, variants?.[chord]);
  const strings = strumStrings(shape, dir);
  const midis = strings.map((s) => (shapeNoteOn(shape, s) as number) + capo).sort((a, b) => a - b);
  return { kind: 'strum', id, chord, shape, dir, start, dur, measure, strings, midis };
}

interface Layout {
  measureStarts: number[];
  measureLengths: number[];
  totalBeats: number;
}

function parseLine(src: string, time: TimeSig, pickup: number, variants?: Record<string, string>, capo = 0): { events: GEvent[]; layout: Layout } {
  const measures = src
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const full = measureBeats(time);
  const events: GEvent[] = [];
  const measureStarts: number[] = [];
  const measureLengths: number[] = [];
  let cursor = 0;
  let n = 0;
  // Ties carry into the next note of the same pitch.
  const tieOpen = new Map<number, NoteEvent>();
  measures.forEach((text, mi) => {
    const where = `(measure ${mi + 1})`;
    measureStarts.push(cursor);
    let total = 0;
    for (const tok of text.split(/\s+/)) {
      const raw = parseToken(tok, where);
      const start = cursor + total;
      if (raw.kind === 'strum') {
        events.push(makeStrum(`s${n++}`, raw.chord!, raw.dir, start, raw.beats, mi, variants, capo));
      } else if (raw.kind === 'note') {
        raw.midis.forEach((midi, i) => {
          const s = raw.strings ? (raw.strings.length === 1 ? raw.strings[0] : raw.strings[i]) : undefined;
          // With a capo, a note is written as it sounds, and found on the neck above the capo.
          const at = placeFor(midi - capo, s, where);
          const place = { string: at.string, fret: at.fret };
          const open = tieOpen.get(midi);
          const note: NoteEvent = {
            kind: 'note',
            id: `n${n++}`,
            start,
            dur: raw.beats,
            measure: mi,
            midi,
            place,
            finger: raw.fingers?.[i],
            tied: open !== undefined,
          };
          if (open) {
            open.dur += raw.beats;
            tieOpen.delete(midi);
          }
          events.push(note);
          if (raw.tie) tieOpen.set(midi, open ?? note);
        });
      }
      total += raw.beats;
    }
    const expected = mi === 0 && pickup > 0 ? pickup : full;
    const last = mi === measures.length - 1;
    if (Math.abs(total - expected) > EPS && !(last && total < expected)) {
      throw new Error(`Measure ${mi + 1} has ${total} beats, expected ${expected}`);
    }
    measureLengths.push(total);
    cursor += total;
  });
  return { events, layout: { measureStarts, measureLengths, totalBeats: cursor } };
}

// ------------------------------------------------------------------- charts

/** Chords per measure from a chart, as [symbol, beats] pairs. */
export function parseChart(chart: string, time: TimeSig): Array<Array<{ symbol: string; beats: number }>> {
  const pulses = pulsesPerMeasure(time);
  const pulse = pulseBeats(time);
  const full = measureBeats(time);
  const measures = chart
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let last: string | null = null;
  return measures.map((text, mi) => {
    const tokens = text.split(/\s+/);
    const where = `(chart measure ${mi + 1})`;
    let slots: string[];
    if (tokens.length === 1) slots = [tokens[0]];
    else if (tokens.length === pulses) slots = tokens;
    else if (tokens.length === 2 && pulses % 2 === 0) slots = [tokens[0], ...Array(pulses / 2 - 1).fill('.'), tokens[1], ...Array(pulses / 2 - 1).fill('.')];
    else throw new Error(`Measure has ${tokens.length} chords, expected 1 or ${pulses} ${where}`);
    const out: Array<{ symbol: string; beats: number }> = [];
    const each = slots.length === 1 ? full : pulse;
    for (const t of slots) {
      if (t === '.' || t === '%') {
        if (last === null) throw new Error(`A chart cannot start with "${t}" ${where}`);
        if (out.length > 0) out[out.length - 1].beats += each;
        else out.push({ symbol: last, beats: each });
        continue;
      }
      if (!hasShape(t)) throw new Error(`No shape for chord "${t}" ${where}`);
      out.push({ symbol: t, beats: each });
      last = t;
    }
    return out;
  });
}

/** The chord sounding at a beat within a measure. */
function chordAt(measure: Array<{ symbol: string; beats: number }>, beat: number): string {
  let at = 0;
  for (const c of measure) {
    if (beat < at + c.beats - EPS) return c.symbol;
    at += c.beats;
  }
  return measure[measure.length - 1].symbol;
}

/**
 * The bass strings of a shape: the lowest string sounding the root, and an
 * alternate bass a string or two above it, the chord's fifth where it can be.
 */
export function bassStrings(shape: Shape, chord: string): { root: StringNo; alt: StringNo } {
  const played = playedStrings(shape);
  const rootPc = parseRoot(chord);
  const root = played.find((s) => pitchClass(shapeNoteOn(shape, s) as number) === rootPc) ?? played[0];
  const near = [root - 1, root - 2].filter((s) => s >= 1 && played.includes(s as StringNo)) as StringNo[];
  const pcOf = (s: StringNo) => pitchClass(shapeNoteOn(shape, s) as number);
  const fifth = near.find((s) => pcOf(s) === pitchClass(rootPc + 7));
  const other = near.find((s) => pcOf(s) !== rootPc);
  return { root, alt: fifth ?? other ?? near[0] ?? root };
}

function parseRoot(chord: string): number {
  const letter = chord.match(/^[A-G](#|b)?/)![0];
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = base[letter[0]];
  if (letter[1] === '#') pc += 1;
  if (letter[1] === 'b') pc -= 1;
  return pitchClass(pc);
}

function parsePattern(pattern: string, time: TimeSig, kind: 'strum' | 'pick'): string[] {
  const slots = kind === 'pick' ? pattern.trim().split(/\s+/) : pattern.replace(/\s+/g, '').split('');
  const want = Math.round(measureBeats(time) * 2);
  if (slots.length !== want) throw new Error(`A ${kind} pattern in ${time[0]}/${time[1]} needs ${want} eighth notes, found ${slots.length}: "${pattern}"`);
  for (const s of slots) {
    if (kind === 'strum' && !/^[DUBA.x]$/.test(s)) throw new Error(`Bad strum pattern symbol "${s}" in "${pattern}"`);
    if (kind === 'pick' && !/^(\.|[pP1-6](\+[pP1-6])*)$/.test(s)) throw new Error(`Bad picking pattern token "${s}" in "${pattern}"`);
  }
  return slots;
}

function fromChart(src: ScoreSource, time: TimeSig): { events: GEvent[]; layout: Layout; chords: ChordMark[]; kind: 'strum' | 'pick' } {
  const capo = src.capo ?? 0;
  const bars = parseChart(src.chart!, time);
  const kind: 'strum' | 'pick' = src.pick ? 'pick' : 'strum';
  const slots = parsePattern(src.pick ?? src.strum ?? 'D.D.D.D.'.slice(0, Math.round(measureBeats(time) * 2)), time, kind);
  const full = measureBeats(time);
  const events: GEvent[] = [];
  const chords: ChordMark[] = [];
  const measureStarts: number[] = [];
  const measureLengths: number[] = [];
  let n = 0;
  bars.forEach((bar, mi) => {
    const m0 = mi * full;
    measureStarts.push(m0);
    measureLengths.push(full);
    let at = 0;
    for (const c of bar) {
      // A chord held over a bar line is one mark per measure, so each measure shows what it holds.
      chords.push({ measure: mi, start: m0 + at, beats: c.beats, symbol: c.symbol });
      at += c.beats;
    }
    // Slots that strike something, so each event can last until the next.
    const struck: Array<{ slot: number; token: string }> = [];
    slots.forEach((token, slot) => {
      if (token !== '.') struck.push({ slot, token });
    });
    struck.forEach(({ slot, token }, k) => {
      const beat = slot * 0.5;
      const next = k + 1 < struck.length ? struck[k + 1].slot * 0.5 : full;
      const dur = next - beat;
      const chord = chordAt(bar, beat);
      const start = m0 + beat;
      const shape = shapeFor(chord, src.variants?.[chord]);
      if (kind === 'strum') {
        if (token === 'D' || token === 'U') {
          events.push(makeStrum(`s${n++}`, chord, token === 'D' ? 'down' : 'up', start, dur, mi, src.variants, capo));
        } else if (token === 'B' || token === 'A') {
          const bass = bassStrings(shape, chord);
          const s = token === 'B' ? bass.root : bass.alt;
          const midi = shapeNoteOn(shape, s) as number;
          events.push({ kind: 'note', id: `n${n++}`, start, dur, measure: mi, midi: midi + capo, place: { string: s, fret: midi - OPEN_MIDI[s] }, tied: false, chord });
        }
        // "x" is a muted chuck: heard as a knock, never as notes, so it asks nothing of the follower.
      } else {
        for (const part of token.split('+')) {
          const bass = bassStrings(shape, chord);
          const s: StringNo = part === 'p' ? bass.root : part === 'P' ? bass.alt : (parseInt(part, 10) as StringNo);
          const midi = shapeNoteOn(shape, s);
          if (midi === null) throw new Error(`String ${s} is not part of ${chord} in measure ${mi + 1}`);
          events.push({ kind: 'note', id: `n${n++}`, start, dur, measure: mi, midi: midi + capo, place: { string: s, fret: midi - OPEN_MIDI[s] }, tied: false, chord });
        }
      }
    });
  });
  return { events, layout: { measureStarts, measureLengths, totalBeats: bars.length * full }, chords, kind };
}

// ------------------------------------------------------------------- scores

function buildSteps(events: GEvent[]): Step[] {
  const playable = events.filter((e) => e.kind === 'strum' || !e.tied).sort((a, b) => a.start - b.start);
  const steps: Step[] = [];
  for (const e of playable) {
    const last = steps[steps.length - 1];
    if (last && Math.abs(last.start - e.start) < EPS && e.kind === 'note' && !last.strum) {
      last.notes.push(e);
      continue;
    }
    steps.push({ index: steps.length, start: e.start, measure: e.measure, notes: e.kind === 'note' ? [e] : [], strum: e.kind === 'strum' ? e : null });
  }
  return steps;
}

function chordsOfLine(events: GEvent[], layout: Layout): ChordMark[] {
  const out: ChordMark[] = [];
  for (const e of events) {
    if (e.kind !== 'strum') continue;
    const last = out[out.length - 1];
    if (last && last.symbol === e.chord && last.measure === e.measure) {
      last.beats = e.start + e.dur - last.start;
      continue;
    }
    out.push({ measure: e.measure, start: e.start, beats: e.dur, symbol: e.chord });
  }
  void layout;
  return out;
}

export function parseScore(src: ScoreSource): Score {
  const time = src.time ?? [4, 4];
  const tempo = src.tempo ?? 80;
  if (src.chart) {
    const { events, layout, chords, kind } = fromChart(src, time);
    return {
      time,
      tempo,
      pickup: 0,
      measureCount: layout.measureStarts.length,
      ...layout,
      events,
      steps: buildSteps(events),
      chords,
      kind,
      capo: src.capo ?? 0,
      measureOffset: 0,
    };
  }
  if (!src.line) throw new Error('A score needs a line or a chart');
  const pickup = src.pickup ?? 0;
  const { events, layout } = parseLine(src.line, time, pickup, src.variants, src.capo ?? 0);
  const kind = events.some((e) => e.kind === 'strum') ? 'strum' : 'notes';
  return {
    time,
    tempo,
    pickup,
    measureCount: layout.measureStarts.length,
    ...layout,
    events,
    steps: buildSteps(events),
    chords: chordsOfLine(events, layout),
    kind,
    capo: src.capo ?? 0,
    measureOffset: 0,
  };
}

/** Measures `from` to `to` (0 based, inclusive) as a score of their own, starting at beat 0. */
export function sliceScore(score: Score, from: number, to: number): Score {
  const a = Math.max(0, from);
  const b = Math.min(score.measureCount - 1, to);
  if (a === 0 && b === score.measureCount - 1) return score;
  const start = score.measureStarts[a];
  const end = score.measureStarts[b] + score.measureLengths[b];
  const shift = <T extends { start: number; measure: number }>(e: T): T => ({ ...e, start: e.start - start, measure: e.measure - a });
  const events = score.events.filter((e) => e.start >= start - EPS && e.start < end - EPS).map(shift);
  // A note tied in from before the slice is struck afresh.
  for (const e of events) if (e.kind === 'note' && e.tied && e.start < EPS) e.tied = false;
  return {
    ...score,
    pickup: a === 0 ? score.pickup : 0,
    measureCount: b - a + 1,
    measureStarts: score.measureStarts.slice(a, b + 1).map((s) => s - start),
    measureLengths: score.measureLengths.slice(a, b + 1),
    totalBeats: end - start,
    events,
    steps: buildSteps(events),
    chords: score.chords.filter((c) => c.measure >= a && c.measure <= b).map(shift),
    measureOffset: score.measureOffset + a,
  };
}

/**
 * The chord changes of a strummed score as steps: the first strum of each
 * new chord. Learning a song's chords without a beat means playing each
 * change once, in your own time.
 */
export function changeSteps(score: Score): Step[] {
  const out: Step[] = [];
  let last: string | null = null;
  for (const s of score.steps) {
    if (!s.strum) continue;
    if (s.strum.chord === last) continue;
    last = s.strum.chord;
    // Strummed down, so every string of the chord is asked for.
    const shape = s.strum.shape;
    const strings = strumStrings(shape, 'down');
    const midis = strings.map((st) => shapeNoteOn(shape, st) as number).sort((a, b) => a - b);
    out.push({ index: out.length, start: s.start, measure: s.measure, notes: [], strum: { ...s.strum, dir: 'down', strings, midis } });
  }
  return out;
}

/** The chords a score uses, in the order they first appear. */
export function chordsUsed(score: Score): string[] {
  const out: string[] = [];
  for (const c of score.chords) if (!out.includes(c.symbol)) out.push(c.symbol);
  for (const e of score.events) if (e.kind === 'note' && e.chord && !out.includes(e.chord)) out.push(e.chord);
  return out;
}

/** Chord changes in a score as ordered pairs, with how often each comes. */
export function changesIn(score: Score): Array<{ from: string; to: string; count: number }> {
  const out: Array<{ from: string; to: string; count: number }> = [];
  const seq = score.chords.map((c) => c.symbol).filter((s, i, a) => i === 0 || s !== a[i - 1]);
  for (let i = 1; i < seq.length; i++) {
    const from = seq[i - 1];
    const to = seq[i];
    const had = out.find((c) => c.from === from && c.to === to);
    if (had) had.count++;
    else out.push({ from, to, count: 1 });
  }
  return out;
}

/** Fingers that can stay down through a change, said plainly, or null. */
export function changeTip(from: string, to: string): string | null {
  const keep = anchorFingers(shapeFor(from), shapeFor(to)).sort((a, b) => a.finger - b.finger);
  if (keep.length === 0) return null;
  const names = ['', 'first', 'second', 'third', 'little'];
  if (keep.length === 1) return `Your ${names[keep[0].finger]} finger stays where it is from ${from} to ${to}. Let it guide the others.`;
  return `Your ${keep.map((k) => names[k.finger]).join(' and ')} fingers stay where they are from ${from} to ${to}.`;
}

/** Every string a strum touches, for drawing which strings to hit. */
export function stringsOfShape(shape: Shape): StringNo[] {
  return STRINGS.filter((_, i) => shape.frets[i] !== null);
}
