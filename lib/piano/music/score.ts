/**
 * Score model and the compact text notation used to author all music.
 *
 * A hand is written as measures separated by "|" and tokens separated by
 * spaces. A token is a pitch, a chord or a rest, followed by a duration:
 *
 *   C4q          middle C, quarter note
 *   F#4e         F sharp, eighth note
 *   Bb3h.        B flat, dotted half note
 *   C4+E4+G4w    a chord, whole note
 *   rq           quarter rest
 *   E4q~         tied to the next note of the same pitch
 *   G4et         eighth note triplet member
 *   C4q:1        fingering (one digit per chord note, low to high)
 *   D5h.:5~      fingering and a tie, in either order
 *
 * Durations: w whole, h half, q quarter, e eighth, s sixteenth.
 * One beat is always one quarter note.
 */

import {
  DUR_BEATS,
  type DurSym,
  type Hand,
  type Pitch,
  type TimeSig,
  measureBeats,
  parsePitch,
  pitchName,
  pitchToMidi,
  transposePitch,
} from './theory';

export interface NoteEvent {
  id: string;
  hand: Hand;
  midi: number;
  pitch: Pitch;
  /** Onset in beats from the start of the score. */
  start: number;
  /** Sounding length in beats, including any tied continuation. */
  dur: number;
  finger?: number;
  measure: number;
  /** True when this note continues a tie and is not struck again. */
  tied: boolean;
}

export interface StaffEvent {
  hand: Hand;
  kind: 'note' | 'rest';
  pitches: Pitch[];
  noteIds: string[];
  sym: DurSym;
  dots: number;
  triplet: boolean;
  beats: number;
  start: number;
  measure: number;
  tieToNext: boolean;
  fingers?: number[];
}

export interface Step {
  index: number;
  start: number;
  measure: number;
  notes: NoteEvent[];
}

export type Clef = 'treble' | 'bass';

export interface ScoreSource {
  key?: string;
  time?: TimeSig;
  /** Target tempo in quarter notes per minute. */
  tempo?: number;
  /** Length of an opening pickup measure in beats. */
  pickup?: number;
  rh?: string;
  lh?: string;
  clefs?: Partial<Record<Hand, Clef>>;
  /** Chord symbols per measure: "C | F G | C". */
  chords?: string;
}

export interface ChordMark {
  measure: number;
  start: number;
  symbol: string;
}

export interface Score {
  key: string;
  time: TimeSig;
  tempo: number;
  pickup: number;
  measureCount: number;
  /** Beat position where each measure starts. */
  measureStarts: number[];
  /** Length of each measure in beats. */
  measureLengths: number[];
  totalBeats: number;
  hands: Hand[];
  clefs: Record<Hand, Clef>;
  staff: Record<Hand, StaffEvent[]>;
  notes: NoteEvent[];
  steps: Step[];
  chords: ChordMark[];
  /** Offset of this score's first measure in the score it was sliced from. */
  measureOffset: number;
}

const TOKEN_RE = /^(r|[A-G](?:##|#|bb|b|n)?-?\d(?:\+[A-G](?:##|#|bb|b|n)?-?\d)*)([whqes])(\.{0,2})(t?)(~?)(?::([1-5]+))?(~?)$/;

const EPS = 1e-6;

interface RawEvent {
  kind: 'note' | 'rest';
  pitches: Pitch[];
  sym: DurSym;
  dots: number;
  triplet: boolean;
  beats: number;
  tie: boolean;
  fingers?: number[];
}

function parseToken(tok: string, where: string): RawEvent {
  const m = TOKEN_RE.exec(tok);
  if (!m) throw new Error(`Bad token "${tok}" ${where}`);
  const sym = m[2] as DurSym;
  const dots = m[3].length;
  const triplet = m[4] === 't';
  let beats = DUR_BEATS[sym];
  if (dots === 1) beats *= 1.5;
  if (dots === 2) beats *= 1.75;
  if (triplet) beats *= 2 / 3;
  if (m[1] === 'r') {
    return { kind: 'rest', pitches: [], sym, dots, triplet, beats, tie: false };
  }
  const pitches = m[1].split('+').map(parsePitch);
  pitches.sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  let fingers: number[] | undefined;
  if (m[6]) {
    fingers = m[6].split('').map((d) => parseInt(d, 10));
    if (fingers.length !== pitches.length) {
      throw new Error(`Fingering count does not match notes in "${tok}" ${where}`);
    }
  }
  return { kind: 'note', pitches, sym, dots, triplet, beats, tie: m[5] === '~' || m[7] === '~', fingers };
}

function parseHand(
  src: string,
  hand: Hand,
  measureLen: number,
  pickup: number,
): { events: StaffEvent[]; notes: NoteEvent[]; measureLengths: number[] } {
  const measures = src
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const events: StaffEvent[] = [];
  const notes: NoteEvent[] = [];
  const measureLengths: number[] = [];
  let cursor = 0;
  let n = 0;
  measures.forEach((mText, mi) => {
    const where = `(${hand === 'R' ? 'right' : 'left'} hand, measure ${mi + 1})`;
    let total = 0;
    for (const tok of mText.split(/\s+/)) {
      const raw = parseToken(tok, where);
      const ev: StaffEvent = {
        hand,
        kind: raw.kind,
        pitches: raw.pitches,
        noteIds: [],
        sym: raw.sym,
        dots: raw.dots,
        triplet: raw.triplet,
        beats: raw.beats,
        start: cursor,
        measure: mi,
        tieToNext: raw.tie,
        fingers: raw.fingers,
      };
      raw.pitches.forEach((p, pi) => {
        const note: NoteEvent = {
          id: `${hand}${n++}`,
          hand,
          midi: pitchToMidi(p),
          pitch: p,
          start: cursor,
          dur: raw.beats,
          finger: raw.fingers?.[pi],
          measure: mi,
          tied: false,
        };
        ev.noteIds.push(note.id);
        notes.push(note);
      });
      events.push(ev);
      cursor += raw.beats;
      total += raw.beats;
    }
    const isFirst = mi === 0;
    const isLast = mi === measures.length - 1;
    const expected = isFirst && pickup > 0 ? pickup : measureLen;
    const lastOk = isLast && pickup > 0 && Math.abs(total - (measureLen - pickup)) < EPS;
    if (Math.abs(total - expected) > EPS && !lastOk) {
      throw new Error(`Measure adds up to ${total} beats, expected ${expected} ${where}`);
    }
    measureLengths.push(total);
  });
  resolveTies(events, notes);
  return { events, notes, measureLengths };
}

/**
 * Work out which notes continue a tie. A continuation is not struck again,
 * and its length is added to the note that started the tie.
 */
function resolveTies(events: StaffEvent[], notes: NoteEvent[]): void {
  const byId = new Map(notes.map((n) => [n.id, n]));
  let open = new Map<number, NoteEvent>();
  for (const ev of events) {
    const next = new Map<number, NoteEvent>();
    if (ev.kind === 'note') {
      for (const id of ev.noteIds) {
        const note = byId.get(id);
        if (!note) continue;
        const origin = open.get(note.midi);
        note.dur = ev.beats;
        note.tied = origin !== undefined;
        if (origin) origin.dur += ev.beats;
        if (ev.tieToNext) next.set(note.midi, origin ?? note);
      }
    }
    open = next;
  }
}

function parseChords(src: string | undefined, measureStarts: number[], measureLengths: number[]): ChordMark[] {
  if (!src) return [];
  const out: ChordMark[] = [];
  src
    .split('|')
    .map((s) => s.trim())
    .forEach((mText, mi) => {
      if (mi >= measureStarts.length || mText.length === 0) return;
      const toks = mText.split(/\s+/);
      toks.forEach((symbol, i) => {
        if (symbol === '.' || symbol === '') return;
        out.push({ measure: mi, start: measureStarts[mi] + (measureLengths[mi] * i) / toks.length, symbol });
      });
    });
  return out;
}

function buildSteps(notes: NoteEvent[]): Step[] {
  const struck = notes.filter((n) => !n.tied);
  const byStart = new Map<number, NoteEvent[]>();
  for (const n of struck) {
    const key = Math.round(n.start * 960);
    const list = byStart.get(key);
    if (list) list.push(n);
    else byStart.set(key, [n]);
  }
  return Array.from(byStart.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, list], index) => ({
      index,
      start: list[0].start,
      measure: list[0].measure,
      notes: list.slice().sort((a, b) => a.midi - b.midi),
    }));
}

export function parseScore(src: ScoreSource): Score {
  const time: TimeSig = src.time ?? [4, 4];
  const mLen = measureBeats(time);
  const pickup = src.pickup ?? 0;
  const hands: Hand[] = [];
  const staff: Record<Hand, StaffEvent[]> = { R: [], L: [] };
  let notes: NoteEvent[] = [];
  let measureLengths: number[] | null = null;

  for (const hand of ['R', 'L'] as Hand[]) {
    const text = hand === 'R' ? src.rh : src.lh;
    if (!text || text.trim().length === 0) continue;
    const parsed = parseHand(text, hand, mLen, pickup);
    hands.push(hand);
    staff[hand] = parsed.events;
    notes = notes.concat(parsed.notes);
    if (measureLengths && measureLengths.length !== parsed.measureLengths.length) {
      throw new Error(
        `Hands have different measure counts (${measureLengths.length} and ${parsed.measureLengths.length})`,
      );
    }
    measureLengths = parsed.measureLengths;
  }
  if (!measureLengths) throw new Error('Score has no notes');

  const measureStarts: number[] = [];
  let acc = 0;
  for (const len of measureLengths) {
    measureStarts.push(acc);
    acc += len;
  }
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);

  return {
    key: src.key ?? 'C',
    time,
    tempo: src.tempo ?? 80,
    pickup,
    measureCount: measureLengths.length,
    measureStarts,
    measureLengths,
    totalBeats: acc,
    hands,
    clefs: { R: src.clefs?.R ?? 'treble', L: src.clefs?.L ?? 'bass' },
    staff,
    notes,
    steps: buildSteps(notes),
    chords: parseChords(src.chords, measureStarts, measureLengths),
    measureOffset: 0,
  };
}

/** A copy of the score containing only measures [from, to] (0 based, inclusive). */
export function sliceScore(score: Score, from: number, to: number): Score {
  const a = Math.max(0, from);
  const b = Math.min(score.measureCount - 1, to);
  if (a === 0 && b === score.measureCount - 1) return score;
  const t0 = score.measureStarts[a];
  const t1 = score.measureStarts[b] + score.measureLengths[b];
  const inRange = (m: number) => m >= a && m <= b;
  const staff: Record<Hand, StaffEvent[]> = { R: [], L: [] };
  for (const hand of score.hands) {
    staff[hand] = score.staff[hand]
      .filter((e) => inRange(e.measure))
      .map((e, i, arr) => ({
        ...e,
        start: e.start - t0,
        measure: e.measure - a,
        tieToNext: e.tieToNext && i < arr.length - 1,
      }));
  }
  const notes = score.notes
    .filter((n) => inRange(n.measure))
    .map((n) => ({ ...n, start: n.start - t0, measure: n.measure - a, tied: false }));
  for (const hand of score.hands) {
    resolveTies(
      staff[hand],
      notes.filter((n) => n.hand === hand),
    );
  }
  return {
    ...score,
    pickup: a === 0 ? score.pickup : 0,
    measureCount: b - a + 1,
    measureStarts: score.measureStarts.slice(a, b + 1).map((s) => s - t0),
    measureLengths: score.measureLengths.slice(a, b + 1),
    totalBeats: t1 - t0,
    staff,
    notes,
    steps: buildSteps(notes),
    chords: score.chords.filter((c) => inRange(c.measure)).map((c) => ({ ...c, measure: c.measure - a, start: c.start - t0 })),
    measureOffset: score.measureOffset + a,
  };
}

/** Keep only one hand. */
export function handOnly(score: Score, hand: Hand): Score {
  if (!score.hands.includes(hand)) return score;
  const notes = score.notes.filter((n) => n.hand === hand);
  return {
    ...score,
    hands: [hand],
    staff: { R: hand === 'R' ? score.staff.R : [], L: hand === 'L' ? score.staff.L : [] },
    notes,
    steps: buildSteps(notes),
  };
}

export interface MidiRange {
  low: number;
  high: number;
}

export function scoreRange(score: Score, hand?: Hand): MidiRange {
  const ns = hand ? score.notes.filter((n) => n.hand === hand) : score.notes;
  if (ns.length === 0) return { low: 60, high: 72 };
  let low = Infinity;
  let high = -Infinity;
  for (const n of ns) {
    if (n.midi < low) low = n.midi;
    if (n.midi > high) high = n.midi;
  }
  return { low, high };
}

/** Steps restricted to the given hands, re-indexed. */
export function stepsFor(score: Score, hands: Hand[]): Step[] {
  if (hands.length === score.hands.length) return score.steps;
  return buildSteps(score.notes.filter((n) => hands.includes(n.hand)));
}

/** Transpose a score by a spelled interval and place it in a new key. */
export function transposeScore(score: Score, steps: number, semitones: number, newKey: string): Score {
  const move = (p: Pitch) => transposePitch(p, steps, semitones);
  const staff: Record<Hand, StaffEvent[]> = { R: [], L: [] };
  for (const hand of score.hands) {
    staff[hand] = score.staff[hand].map((e) => ({ ...e, pitches: e.pitches.map(move) }));
  }
  const notes = score.notes.map((n) => {
    const pitch = move(n.pitch);
    return { ...n, pitch, midi: pitchToMidi(pitch) };
  });
  return { ...score, key: newKey, staff, notes, steps: buildSteps(notes) };
}

// ---------------------------------------------------------------------------
// Builders for generated material
// ---------------------------------------------------------------------------

export interface SeqNote {
  pitches: Pitch[];
  sym: DurSym;
  dots?: number;
  fingers?: number[];
  rest?: boolean;
}

/** Turn a list of notes into the text notation, inserting barlines. */
export function seqToText(seq: SeqNote[], time: TimeSig = [4, 4]): string {
  const mLen = measureBeats(time);
  const parts: string[] = [];
  let acc = 0;
  for (const n of seq) {
    let beats = DUR_BEATS[n.sym];
    if (n.dots === 1) beats *= 1.5;
    if (acc > 0 && acc + beats > mLen + EPS) {
      throw new Error('Generated sequence crosses a barline');
    }
    const body = n.rest ? 'r' : n.pitches.map(pitchName).join('+');
    const fing = n.fingers && !n.rest ? `:${n.fingers.join('')}` : '';
    parts.push(`${body}${n.sym}${'.'.repeat(n.dots ?? 0)}${fing}`);
    acc += beats;
    if (Math.abs(acc - mLen) < EPS) {
      parts.push('|');
      acc = 0;
    }
  }
  if (parts[parts.length - 1] === '|') parts.pop();
  return parts.join(' ');
}

/** Fill the rest of the last measure with rests so the text parses. */
export function padToBar(seq: SeqNote[], time: TimeSig = [4, 4]): SeqNote[] {
  const mLen = measureBeats(time);
  let acc = 0;
  for (const n of seq) {
    let beats = DUR_BEATS[n.sym];
    if (n.dots === 1) beats *= 1.5;
    acc = (acc + beats) % mLen;
    if (Math.abs(acc - mLen) < EPS) acc = 0;
  }
  const out = seq.slice();
  let remaining = acc < EPS ? 0 : mLen - acc;
  const order: DurSym[] = ['w', 'h', 'q', 'e', 's'];
  while (remaining > EPS) {
    const sym = order.find((s) => DUR_BEATS[s] <= remaining + EPS)!;
    out.push({ pitches: [], sym, rest: true });
    remaining -= DUR_BEATS[sym];
  }
  return out;
}
