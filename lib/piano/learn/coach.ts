/**
 * The practice coach. Given a piece and what has happened so far, it picks
 * the next thing to practise, the way a good teacher would at the piano.
 *
 * The plan follows what studies of effective piano practice found:
 *   Practise what cannot yet be played. A first play through shows what is
 *   already known, and those parts are not drilled again.
 *   Hear a model first, then play.
 *   New notes are learned with no time pressure, the music waits.
 *   Hands come together early, after one pass each alone.
 *   Tempo rises after two good passes in a row, or one clean one, and drops after two poor ones.
 *   A trouble spot is taken out, fixed on its own, and put back.
 *   Phrases are joined as soon as each one is secure.
 */

import type { FlowResult, NoteOutcome } from '../engine/flow';
import { troubleSpots } from '../engine/flow';
import type { Hand } from '../music/theory';
import { dayKey } from '../util/emitter';

export interface SectionState {
  /** Position on the ladder, see RUNGS. */
  rung: number;
  streak: number;
  fails: number;
}

export interface PieceState {
  startedOn: string;
  lastOn: string;
  sections: SectionState[];
  /** Sections 0..joined are linked into one stretch. */
  joined: number;
  /** Position on the whole piece ladder: 0 not started, then 70, 85 and 100 percent. */
  wholeRung: number;
  wholeStreak: number;
  wholeFails: number;
  learned: boolean;
  learnedOn?: string;
  /** A trouble spot being worked on, as measures, with good passes still needed. */
  focus: { from: number; to: number; left: number; hands: Hand[] } | null;
  /** Tasks finished today, to pace the session. */
  tasksToday: number;
  bestAccuracy: number;
  /**
   * The first play through, which shows what the learner already knows.
   * Missing on pieces begun before it existed: those count as done once any progress has been made.
   */
  trial?: 'pending' | 'done';
}

export interface PieceInfo {
  id: string;
  title: string;
  hands: Hand[];
  /** Sections as 0 based measure ranges, inclusive. */
  sections: Array<[number, number]>;
  measures: number;
  /** The hands that have notes in each section. Given where some section has a hand that only rests. */
  sectionHands?: Hand[][];
}

export type TaskScope =
  | { type: 'trial' }
  | { type: 'section'; index: number }
  | { type: 'join'; upTo: number }
  | { type: 'whole' }
  | { type: 'focus' };

export interface Task {
  mode: 'listen' | 'wait' | 'tempo';
  from: number;
  to: number;
  hands: Hand[];
  /** Percent of the performance tempo. */
  tempoPct: number;
  scope: TaskScope;
  title: string;
  prompt: string;
  /** Good passes in a row needed to move on. */
  need: number;
  have: number;
  /** End the run early once the learner is plainly stuck, see FlowOptions. */
  stopAfter?: { hints: number; wrong: number };
}

interface Rung {
  mode: 'listen' | 'wait' | 'tempo';
  hands: 'R' | 'L' | 'both';
  tempoPct: number;
  need: number;
}

/** The ladder for one phrase of a two hand piece. */
const RUNGS_TWO: Rung[] = [
  { mode: 'listen', hands: 'both', tempoPct: 85, need: 1 },
  { mode: 'wait', hands: 'R', tempoPct: 0, need: 1 },
  { mode: 'wait', hands: 'L', tempoPct: 0, need: 1 },
  { mode: 'wait', hands: 'both', tempoPct: 0, need: 2 },
  { mode: 'tempo', hands: 'both', tempoPct: 60, need: 2 },
  { mode: 'tempo', hands: 'both', tempoPct: 80, need: 2 },
];

const RUNGS_ONE: Rung[] = [
  { mode: 'listen', hands: 'both', tempoPct: 85, need: 1 },
  { mode: 'wait', hands: 'both', tempoPct: 0, need: 2 },
  { mode: 'tempo', hands: 'both', tempoPct: 60, need: 2 },
  { mode: 'tempo', hands: 'both', tempoPct: 80, need: 2 },
];

const WHOLE_TEMPI = [70, 85, 100];

function rungsFor(info: PieceInfo): Rung[] {
  return info.hands.length === 2 ? RUNGS_TWO : RUNGS_ONE;
}

export function newPieceState(info: PieceInfo, today: string = dayKey()): PieceState {
  return {
    startedOn: today,
    lastOn: today,
    sections: info.sections.map(() => ({ rung: 0, streak: 0, fails: 0 })),
    joined: 0,
    wholeRung: 0,
    wholeStreak: 0,
    wholeFails: 0,
    learned: false,
    focus: null,
    tasksToday: 0,
    bestAccuracy: 0,
    trial: 'pending',
  };
}

/** Has the learner still to show what they know of this piece? */
export function trialPending(state: PieceState): boolean {
  if (state.learned) return false;
  if (state.trial !== undefined) return state.trial === 'pending';
  return state.joined === 0 && state.wholeRung === 0 && !state.focus && state.sections.every((s) => s.rung === 0);
}

/** Go without the first play through, and learn the piece from its beginning. */
export function skipTrial(state: PieceState): PieceState {
  return { ...state, trial: 'done' };
}

function handsLabel(hands: Hand[]): string {
  if (hands.length === 2) return 'hands together';
  return hands[0] === 'R' ? 'right hand' : 'left hand';
}

function phraseLabel(info: PieceInfo, index: number): string {
  return info.sections.length === 1 ? 'The whole piece' : `Phrase ${index + 1}`;
}

/** Is this phrase secure enough to build on? */
function secure(info: PieceInfo, s: SectionState): boolean {
  return s.rung >= rungsFor(info).length;
}

/** The hands that have notes in a phrase. */
function playing(info: PieceInfo, index: number): Hand[] {
  const h = info.sectionHands?.[index];
  return h && h.length > 0 ? h : info.hands;
}

/** A step for one hand alone has no place in a phrase where only one hand plays: there is nothing to put together. */
function applies(info: PieceInfo, index: number, rung: Rung): boolean {
  return rung.hands === 'both' || playing(info, index).length > 1;
}

/** The step a phrase is on: the first at or after `rung` that applies to it. */
function settle(info: PieceInfo, index: number, rung: number): number {
  const rungs = rungsFor(info);
  let r = rung;
  while (r < rungs.length && !applies(info, index, rungs[r])) r += 1;
  return r;
}

/** A piece that is learned and in good order, as against one that was learned and has gone rusty. */
export function isKept(state: PieceState): boolean {
  return state.learned && state.wholeRung >= WHOLE_TEMPI.length;
}

/** The next thing to practise. */
export function nextTask(info: PieceInfo, state: PieceState): Task | null {
  if (isKept(state)) {
    // Keeping a learned piece alive: one play through at full tempo.
    return {
      mode: 'tempo',
      from: 0,
      to: info.measures - 1,
      hands: info.hands,
      tempoPct: 100,
      scope: { type: 'whole' },
      title: 'Play it through',
      prompt: 'Play the whole piece, as you would for someone listening.',
      need: 1,
      have: 0,
    };
  }

  if (trialPending(state)) {
    return {
      mode: 'wait',
      from: 0,
      to: info.measures - 1,
      hands: info.hands,
      tempoPct: 0,
      scope: { type: 'trial' },
      title: 'First, play it through',
      prompt: 'Play what you know of it, in your own time. You will only be asked to practise the parts that need it.',
      need: 1,
      have: 0,
      stopAfter: { hints: 2, wrong: 4 },
    };
  }

  if (state.focus) {
    const f = state.focus;
    return {
      mode: 'wait',
      from: f.from,
      to: f.to,
      hands: f.hands,
      tempoPct: 0,
      scope: { type: 'focus' },
      title: f.from === f.to ? `Measure ${f.from + 1} on its own` : `Measures ${f.from + 1} to ${f.to + 1} on their own`,
      prompt: 'This is the spot that tripped you. Play just this, slowly, until it comes out right twice.',
      need: 2,
      have: 2 - f.left,
    };
  }

  const rungs = rungsFor(info);
  for (let i = 0; i < info.sections.length; i++) {
    const s = state.sections[i];
    if (!secure(info, s)) {
      const rung = rungs[settle(info, i, s.rung)];
      const [from, to] = info.sections[i];
      const hands: Hand[] = rung.hands === 'both' ? playing(info, i) : [rung.hands];
      const label = phraseLabel(info, i);
      let prompt: string;
      if (rung.mode === 'listen') {
        prompt = 'Listen first and follow the notes with your eyes. Hum along if you like.';
      } else if (rung.mode === 'wait') {
        prompt =
          hands.length === 2
            ? 'Now both hands. Take all the time you need, the music waits for you.'
            : info.hands.length === 1
              ? 'In your own time. The music waits for you.'
              : `Just the ${handsLabel(hands)}. No hurry, the music waits for you.`;
      } else {
        prompt = `With the beat now, at an easy pace. Keep going even if a note slips.`;
      }
      return {
        mode: rung.mode,
        from,
        to,
        hands,
        tempoPct: rung.tempoPct,
        scope: { type: 'section', index: i },
        title: rung.mode === 'listen' ? `${label}: listen` : `${label}, ${handsLabel(hands)}`,
        prompt,
        need: rung.need,
        have: s.streak,
      };
    }
    // A newly secure phrase is joined to what came before it.
    if (i >= 1 && state.joined < i) {
      const [from] = info.sections[i - 1];
      const [, to] = info.sections[i];
      return {
        mode: 'tempo',
        from,
        to,
        hands: info.hands,
        tempoPct: 70,
        scope: { type: 'join', upTo: i },
        title: `Join phrases ${i} and ${i + 1}`,
        prompt: 'Now link the two phrases, so the seam between them disappears.',
        need: 1,
        have: 0,
      };
    }
  }

  // Every phrase is secure and joined. Climb with the whole piece.
  const rung = Math.min(state.wholeRung, WHOLE_TEMPI.length - 1);
  const pct = WHOLE_TEMPI[rung];
  return {
    mode: 'tempo',
    from: 0,
    to: info.measures - 1,
    hands: info.hands,
    tempoPct: pct,
    scope: { type: 'whole' },
    title: pct === 100 ? 'The whole piece, full tempo' : `The whole piece at ${pct} percent`,
    prompt: state.learned && pct === 100 ? 'Once more from the top. It will come back.' : pct === 100 ? 'Full tempo. Play it like a performance.' : 'Start to finish, steady and unhurried.',
    // A learned piece that went rusty has been here before. One good pass at each step brings it back.
    need: state.learned ? 1 : 2,
    have: state.learned ? 0 : state.wholeStreak,
  };
}

export interface Verdict {
  passed: boolean;
  /** What the coach says about the attempt. */
  message: string;
  /** True when this attempt finished learning the piece. */
  learned: boolean;
  /** Neither a pass nor a miss, as after the first play through of a piece that is new. */
  plain?: boolean;
  /** One more thing worth a word after an attempt that counted, such as long notes let go early. */
  aside?: string;
}

/**
 * How far off the beat the notes were, in milliseconds, when they were right
 * and all off by much the same amount. Null when the timing was good or uneven.
 */
export function steadyLag(result: FlowResult): number | null {
  if (result.mode !== 'tempo' || result.accuracy < 0.87 || result.onTime >= 0.6) return null;
  const size = Math.abs(result.biasMs);
  if (size < 90 || result.meanAbsMs - size > 40) return null;
  return result.biasMs;
}

/** Was this attempt good enough to count? */
export function passes(task: Task, result: FlowResult): boolean {
  // A microphone mishears the odd note, so playing judged by ear gets a little more room.
  const room = result.byEar ? 0.05 : 0;
  if (task.mode === 'wait') {
    // Stopping to think is part of finding the notes, so a few pauses are no failure.
    // Needing a good share of the keys shown is not yet knowing them.
    const pauses = Math.max(1, Math.round(result.totalSteps * 0.15));
    return result.accuracy >= 0.9 - room && result.pausedSteps <= pauses;
  }
  // The passes that make a piece count as learned ask for more: hardly a slip, not just most of the notes.
  const last = task.scope.type === 'whole' && task.tempoPct >= 100 && task.need > 1;
  return result.accuracy >= (last ? 0.92 : 0.87) - room && result.onTime >= 0.6;
}

/**
 * Was this attempt so good that a second one would teach nothing? Then the
 * coach moves on at once. The last tempo of a piece always takes two.
 */
export function cleanPass(task: Task, result: FlowResult): boolean {
  if (result.cutShort) return false;
  if (task.mode === 'wait') return result.clean && result.fluency >= 0.9;
  // Long notes let go early leave something to put right, so the pass is worth repeating.
  return result.clean && result.onTime >= 0.8 && (result.held === null || result.held >= 0.5);
}

// ------------------------------------------------------------- what went wrong

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, x) => a + x, 0) / xs.length);

/** Notes of one hand in order, each with a note of the onset before it. Notes struck together share it. */
function withPrevious(detail: NoteOutcome[]): Array<{ note: NoteOutcome; prev: NoteOutcome | null }> {
  const out: Array<{ note: NoteOutcome; prev: NoteOutcome | null }> = [];
  for (const hand of ['R', 'L'] as Hand[]) {
    const line = detail.filter((d) => d.hand === hand).sort((a, b) => a.start - b.start);
    let prev: NoteOutcome | null = null;
    let current: NoteOutcome | null = null;
    for (const note of line) {
      if (current && note.start > current.start + 1e-6) prev = current;
      if (!current || note.start > current.start + 1e-6) current = note;
      out.push({ note, prev });
    }
  }
  return out;
}

interface Where {
  /** The measure most of them were in, counted from zero, or null when they were spread about. */
  measure: number | null;
  /** The hand at fault, or null when both were, or only one is playing. */
  hand: 'left' | 'right' | null;
  text: string;
}

/**
 * Where the trouble was: a measure, a hand, or both, when it gathers in one place.
 * `noun` is what to call it: slips for wrong and missed notes, pauses for notes that had to be shown.
 */
function locate(result: FlowResult, noun: 'slips' | 'pauses' = 'slips'): Where | null {
  const slips = result.detail.filter((d) => d.state !== 'ok');
  // Wrong keys count toward the place they were pressed in.
  const byMeasure = new Map<number, number>();
  for (const d of slips) byMeasure.set(d.measure, (byMeasure.get(d.measure) ?? 0) + 1);
  for (const w of result.wrong) byMeasure.set(w.measure, (byMeasure.get(w.measure) ?? 0) + 1);
  const total = Array.from(byMeasure.values()).reduce((a, n) => a + n, 0);
  if (total < 2) return null;

  let measure: number | null = null;
  if (new Set(result.detail.map((d) => d.measure)).size >= 2) {
    const [worst, count] = Array.from(byMeasure.entries()).sort((a, b) => b[1] - a[1])[0];
    // More than half of them, so that "most" is true.
    if (count >= 2 && count / total > 0.5) measure = worst;
  }
  // One hand, when it slipped at several times the rate of the other. Rates, not counts:
  // the hand with the tune has most of the notes, and so most of the slips, whoever is at fault.
  let hand: 'left' | 'right' | null = null;
  // A hand that played next to nothing did not slip. It was left out.
  let absent = false;
  if (result.hands.length === 2 && noun === 'slips' && result.mode === 'wait') {
    // Without a beat, one wrong key marks every note of its step, in both hands.
    // The wrong keys themselves say which hand slipped.
    const left = result.wrong.filter((w) => w.hand === 'L').length;
    const right = result.wrong.filter((w) => w.hand === 'R').length;
    if (left >= 3 && left >= 3 * right) hand = 'left';
    else if (right >= 3 && right >= 3 * left) hand = 'right';
  } else if (result.hands.length === 2 && noun === 'slips') {
    const of = (h: Hand) => {
      const notes = result.detail.filter((d) => d.hand === h);
      const missed = notes.filter((d) => d.state !== 'ok').length;
      return { notes: notes.length, missed, rate: notes.length > 0 ? missed / notes.length : 0 };
    };
    const left = of('L');
    const right = of('R');
    if (left.notes >= 3 && right.notes >= 3) {
      if (left.missed >= 3 && left.rate >= 0.3 && left.rate >= 3 * right.rate) hand = 'left';
      else if (right.missed >= 3 && right.rate >= 0.3 && right.rate >= 3 * left.rate) hand = 'right';
      absent = (hand === 'left' ? left.rate : hand === 'right' ? right.rate : 0) >= 0.8;
    }
  }
  if (hand && absent) return { measure: null, hand, text: `The ${hand} hand hardly played.` };
  if (measure !== null && hand) return { measure, hand, text: `Most of the ${noun} were in the ${hand} hand, in measure ${measure + 1}.` };
  if (measure !== null) return { measure, hand, text: `Most of the ${noun} were in measure ${measure + 1}.` };
  if (hand) return { measure, hand, text: `It was the ${hand} hand that slipped.` };
  return null;
}

/**
 * Why the timing was off, when the notes show a clear pattern. For a run that
 * passed, `strict` asks for a plainer pattern before anything is said.
 */
function whyOffTheBeat(result: FlowResult, strict = false): string | null {
  const timed = withPrevious(result.detail).filter((x) => x.note.errMs !== undefined);
  if (timed.length < 4) return null;
  const k = strict ? 1.4 : 1;

  // Coming in early after a long note, while the other notes sit on the beat:
  // the long note was not counted out.
  const follows = (x: (typeof timed)[number]) => x.prev !== null && x.prev.dur >= 2 - 1e-6 && x.note.start - x.prev.start >= 2 - 1e-6;
  const afterLong = timed.filter(follows).map((x) => x.note.errMs as number);
  const others = timed.filter((x) => !follows(x)).map((x) => x.note.errMs as number);
  if (afterLong.length >= 2 && others.length >= 2) {
    const early = afterLong.filter((e) => e <= -50).length;
    if (early / afterLong.length >= 0.6 && mean(afterLong) <= -60 * k && mean(others) - mean(afterLong) >= 45 * k) {
      return 'You came in early after the long notes. Count each one out in full.';
    }
  }

  // Quick notes running ahead, or dragging, while the rest sit on the beat.
  const isQuick = (x: (typeof timed)[number]) => x.prev !== null && x.note.start - x.prev.start <= 0.5 + 1e-6;
  const quick = timed.filter(isQuick).map((x) => x.note.errMs as number);
  const rest = timed.filter((x) => !isQuick(x)).map((x) => x.note.errMs as number);
  if (quick.length >= 4 && rest.length >= 2) {
    if (mean(quick) <= -45 * k && mean(rest) - mean(quick) >= 30 * k) return 'The quick notes ran ahead of the beat. Count "one and two and" under your breath to keep them even.';
    if (mean(quick) >= 55 * k && mean(quick) - mean(rest) >= 30 * k) return 'The quick notes fell behind the beat. Keep them light, with the fingers close to the keys.';
  }

  // Speeding up or slowing down from start to finish.
  if (timed.length >= 8) {
    const xs = timed.map((x) => x.note.start);
    const ys = timed.map((x) => x.note.errMs as number);
    const mx = mean(xs);
    const my = mean(ys);
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const syy = ys.reduce((a, y) => a + (y - my) ** 2, 0);
    const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    if (sxx > 0 && syy > 0) {
      const change = (sxy / sxx) * (Math.max(...xs) - Math.min(...xs));
      const fit = (sxy * sxy) / (sxx * syy);
      if (fit >= 0.45 && change <= -110 * k) return 'You sped up as it went on. Let the click hold you back.';
      if (fit >= 0.45 && change >= 110 * k) return 'You fell further behind as it went on. Keep your eyes a note ahead of your hands.';
    }
  }
  return null;
}

/** Long notes that were let go early. Worth a word even after a pass. */
export function heldTooShort(result: FlowResult): string | null {
  return result.held !== null && result.held < 0.5 ? 'The long notes were let go early. Keep each one down for all of its beats.' : null;
}

/**
 * The most useful single thing to say about an attempt that fell short:
 * what went wrong, or where. Null when the playing shows no clear pattern.
 */
export function diagnose(result: FlowResult): string | null {
  if (result.mode === 'wait') return locate(result)?.text ?? null;
  // Right notes in the wrong place are a matter of timing. Missing or wrong notes are a matter of where.
  if (result.accuracy >= 0.87) return whyOffTheBeat(result) ?? heldTooShort(result);
  return locate(result)?.text ?? whyOffTheBeat(result);
}

/**
 * The measure to take out and fix after a run with the beat: the first of two
 * neighbouring measures that hold most of the missed and wrong notes. Null
 * when the slips were spread about, and there is no one spot to fix.
 */
function gathered(result: FlowResult): number | null {
  const by = new Map<number, number>();
  for (const d of result.detail) if (d.state === 'missed') by.set(d.measure, (by.get(d.measure) ?? 0) + 1);
  for (const w of result.wrong) by.set(w.measure, (by.get(w.measure) ?? 0) + 1);
  const total = Array.from(by.values()).reduce((a, n) => a + n, 0);
  if (total < 2) return null;
  let best: number | null = null;
  let most = 0;
  for (const m of Array.from(by.keys()).sort((a, b) => a - b)) {
    for (const start of [m - 1, m]) {
      const n = (by.get(start) ?? 0) + (by.get(start + 1) ?? 0);
      if (n > most) {
        most = n;
        best = by.has(start) ? start : m;
      }
    }
  }
  return most / total > 0.5 ? best : null;
}

/** A run without a beat in a few words, counted the way the learner would count it. */
export function waitSummary(result: FlowResult): string {
  if (result.clean) return 'Every note right the first time';
  const parts = [result.wrongNotes === 0 ? 'No wrong keys' : result.wrongNotes === 1 ? 'One wrong key' : `${result.wrongNotes} wrong keys`];
  if (result.hintedSteps > 0) parts.push(result.hintedSteps === 1 ? 'one key shown' : `${result.hintedSteps} keys shown`);
  return parts.join(', ');
}

/**
 * On a piece for two hands, did the learner play one hand's part and leave the
 * other out? That is someone who knows the tune, not someone lost. Returns the
 * hand that played.
 */
function oneHandPlayed(info: PieceInfo, result: FlowResult): Hand | null {
  if (result.hands.length !== 2 || !result.take || result.take.notes.length < 3) return null;
  const keys = result.take.notes.map((n) => n[0] - result.octaveShift);
  const [from, to] = info.sections[0];
  const opening = result.detail.filter((d) => d.measure >= from && d.measure <= to);
  for (const hand of ['R', 'L'] as Hand[]) {
    const other = opening.filter((d) => d.hand !== hand);
    if (other.length === 0 || other.some((d) => d.state !== 'missed')) continue;
    // Every key pressed lies on this hand's side of the other hand's notes.
    const edge = hand === 'R' ? Math.max(...other.map((d) => d.midi)) : Math.min(...other.map((d) => d.midi));
    if (keys.every((key) => (hand === 'R' ? key > edge : key < edge))) return hand;
  }
  return null;
}

/** Which phrase a measure belongs to. */
function phraseOf(info: PieceInfo, measure: number): number {
  const i = info.sections.findIndex(([from, to]) => measure >= from && measure <= to);
  return i < 0 ? 0 : i;
}

// ------------------------------------------------------------ the first play through

/**
 * Place each phrase on its ladder by how it went in the first play through.
 * A phrase played right is not learned again from its notes. One with a slip
 * or two skips the single hand steps. Anything else starts from the beginning.
 */
function placeFromTrial(info: PieceInfo, state: PieceState, result: FlowResult): { state: PieceState; verdict: Verdict } {
  const rungs = rungsFor(info);
  const together = rungs.reduce((last, r, i) => (r.mode === 'wait' ? i : last), 0);
  const firstTempo = together + 1;
  // Slow and right is known notes, but not yet a piece that will hold together with a beat.
  const fluent = result.pace === null || result.pace >= 0.45;
  const next: PieceState = { ...state, trial: 'done', sections: state.sections.map((s) => ({ ...s })) };

  const levels = info.sections.map(([from, to]) => {
    const stats = result.perMeasure.filter((m) => m.measure >= from && m.measure <= to);
    const reached = stats.length > 0 && stats.every((m) => (m.played ?? 0) >= m.notes);
    const errors = stats.reduce((a, m) => a + m.errors, 0);
    const hints = stats.reduce((a, m) => a + (m.hints ?? 0), 0);
    const pauses = stats.reduce((a, m) => a + m.hesitations, 0);
    if (!reached) return 'new' as const;
    if (errors === 0 && hints === 0 && pauses <= 1) return 'known' as const;
    // A slip or two, or one key that had to be shown, as when the hand started a key out of place.
    return errors <= 2 && hints <= 1 && pauses <= 2 ? ('nearly' as const) : ('new' as const);
  });

  levels.forEach((level, i) => {
    const s = next.sections[i];
    s.streak = 0;
    s.fails = 0;
    if (level === 'known') s.rung = fluent ? rungs.length : firstTempo;
    else if (level === 'nearly') s.rung = together;
  });
  // Phrases played straight through need no joining.
  let joined = 0;
  while (joined + 1 < info.sections.length && secure(info, next.sections[joined]) && secure(info, next.sections[joined + 1])) joined++;
  next.joined = secure(info, next.sections[0]) ? joined : 0;

  const known = levels.map((l, i) => (l === 'known' ? i + 1 : 0)).filter((n) => n > 0);
  const many = info.sections.length > 1;
  let message: string;
  let passed = true;
  let plain = false;
  if (known.length === levels.length) {
    message = fluent
      ? 'You know the notes already. Next, the whole piece with a slow beat.'
      : many
        ? 'The notes are right. Next comes a slow beat, a phrase at a time.'
        : 'The notes are right. Next comes a slow beat.';
  } else if (known.length > 0) {
    const list = known.length === 1 ? `Phrase ${known[0]} is` : `Phrases ${known.slice(0, -1).join(', ')} and ${known[known.length - 1]} are`;
    message = `${list} in your fingers already. We will work on the rest.`;
  } else if (levels.some((l) => l === 'nearly')) {
    message = 'Nearly there already. A little work on the notes, then the beat.';
  } else {
    passed = false;
    plain = true;
    const one = oneHandPlayed(info, result);
    message = one
      ? `That is the ${one === 'R' ? 'right' : 'left'} hand's part. The ${one === 'R' ? 'left' : 'right'} hand has notes too, so we will build it a phrase at a time, one hand and then both.`
      : many
        ? 'That is all that was needed. This one is new to you, so we will build it a phrase at a time.'
        : 'That is all that was needed. This one is new to you, so we will build it step by step.';
  }
  // Played in another octave, it is known all the same. Better said now than found out when the beat is added.
  let aside: string | undefined;
  if (result.octaveShift !== 0 && passed) {
    const octaves = Math.abs(result.octaveShift) / 12;
    const far = octaves === 1 ? 'an octave' : octaves === 2 ? 'two octaves' : 'some octaves';
    aside = `You played it ${far} ${result.octaveShift > 0 ? 'higher' : 'lower'} than it is written. The keys on the screen show where it sits.`;
  }
  return { state: next, verdict: { passed, message, learned: false, plain, aside } };
}

/** Record an attempt and return the new state with the coach's reply. */
export function applyResult(
  info: PieceInfo,
  state: PieceState,
  task: Task,
  result: FlowResult | null,
  today: string = dayKey(),
): { state: PieceState; verdict: Verdict } {
  const next: PieceState = {
    ...state,
    sections: state.sections.map((s) => ({ ...s })),
    focus: state.focus ? { ...state.focus } : null,
    lastOn: today,
    tasksToday: state.lastOn === today ? state.tasksToday + 1 : 1,
  };
  const rungs = rungsFor(info);

  if (task.mode === 'listen' || !result) {
    if (task.scope.type === 'section') {
      const s = next.sections[task.scope.index];
      s.rung = Math.max(s.rung, 1);
      s.streak = 0;
    }
    return { state: next, verdict: { passed: true, message: 'Now your turn.', learned: false } };
  }

  if (task.scope.type === 'trial') return placeFromTrial(info, next, result);

  const ok = passes(task, result);
  // Something worth a word even when the attempt counted: long notes let go, a
  // plain pattern in the timing, or the one place the misses were.
  const aside = (ok && task.mode === 'tempo' ? (heldTooShort(result) ?? whyOffTheBeat(result, true) ?? locate(result)?.text ?? null) : null) ?? undefined;
  // A clean pass is not asked for twice. A pass that leaves something to say is not clean.
  const clean = ok && !aside && cleanPass(task, result);
  next.bestAccuracy = Math.max(next.bestAccuracy, result.accuracy);
  let message = '';
  let learned = false;

  // What to say about an attempt that fell short: the pattern in the playing if there is one.
  const found = ok ? null : diagnose(result);

  // Right notes that all land off the beat by the same amount are not a sign
  // that the tempo is too quick. Slowing down would not help, so nothing is
  // stepped back. The cause is a delay, in the connection or in the habit of
  // waiting for the click. A pattern found in the playing is the better
  // explanation where there is one.
  const lag = steadyLag(result);
  if (!ok && task.mode === 'tempo' && lag !== null && !found) {
    message =
      lag > 0
        ? 'The notes were right, and each one landed late by about the same amount. If it sounded on the beat to you, run the timing check in Settings. If not, aim to land with the click, not after it.'
        : 'The notes were right, and each one landed early by about the same amount. If it sounded on the beat to you, run the timing check in Settings. If not, let the click lead.';
    return { state: next, verdict: { passed: false, message, learned } };
  }

  if (task.scope.type === 'focus' && next.focus) {
    if (ok) {
      next.focus.left -= 1;
      if (next.focus.left <= 0) {
        next.focus = null;
        // The spot was taken out of a phrase, or out of the whole piece. Say which it goes back into.
        const back = nextTask(info, next)?.scope.type;
        message = back === 'whole' ? 'That spot is fixed. Back to the whole piece.' : back === 'join' ? 'That spot is fixed. Back to joining the phrases.' : 'That spot is fixed. Back to the phrase.';
      } else {
        message = 'Good. Once more the same way, to make it stick.';
      }
    } else {
      next.focus.left = 2;
      message = 'Slower still. Look at the next note before you play it.';
    }
    return { state: next, verdict: { passed: ok, message, learned } };
  }

  if (task.scope.type === 'section') {
    const index = task.scope.index;
    const s = next.sections[index];
    s.rung = settle(info, index, s.rung);
    const rung = rungs[s.rung];
    if (ok) {
      // A clean first pass stands for both.
      const once = clean && s.streak === 0 && rung.need > 1;
      const stumbled = s.fails > 0;
      s.streak = clean ? rung.need : s.streak + 1;
      s.fails = 0;
      if (s.streak >= rung.need) {
        s.rung = settle(info, index, s.rung + 1);
        s.streak = 0;
        // The same words at every step would wear thin, so two take turns. Neither claims a first try that was not one.
        const lead = once ? (stumbled ? 'Clean this time, so once is enough.' : s.rung % 2 === 0 ? 'Right first time, so no need to repeat it.' : 'Clean, so once is enough.') : null;
        if (s.rung >= rungs.length) {
          message = lead ? `${lead} This phrase is secure.` : 'This phrase is secure. Well done.';
        } else {
          const after = rungs[s.rung];
          if (after.mode === 'tempo' && rung.mode === 'wait') message = `${lead ?? 'You know the notes.'} Next, with a steady beat.`;
          else if (after.mode === 'tempo') message = `${lead ?? 'Steady.'} A little faster next.`;
          else if (after.hands === 'both' && rung.hands !== 'both') message = `${lead ?? 'Good.'} Now put the hands together.`;
          else message = `${lead ?? 'Good.'} On to the next step.`;
        }
      } else {
        message = task.mode === 'wait' ? 'Right. Once more, just as calmly.' : 'Good. One more like that and we move on.';
      }
    } else {
      s.streak = 0;
      s.fails += 1;
      if (task.mode === 'wait') {
        const spots = troubleSpots(result, 1);
        if (s.fails >= 2 && spots.length > 0 && task.to > task.from) {
          // Take the trouble spot out and fix it alone.
          const m = spots[0].measure;
          next.focus = { from: m, to: m, left: 2, hands: task.hands };
          s.fails = 0;
          message =
            result.wrongNotes === 0
              ? `Measure ${m + 1} makes you stop each time. Let us take it on its own.`
              : `Measure ${m + 1} keeps tripping you. Let us fix it on its own.`;
        } else {
          if (result.wrongNotes === 0) {
            // No wrong keys at all: the learner stopped to think and the keys were shown. That is not a slip.
            const paused = locate(result, 'pauses');
            message = paused
              ? `${paused.text} Once more, and see if those notes come sooner.`
              : 'The keys had to be shown several times. Once more, and see if the notes come sooner.';
          } else {
            message = found
              ? `${found} Take that part slowly, and look at each note before you play it.`
              : 'Slow down, and pause before any note you are unsure of. Stopping to get it right is good practice.';
          }
        }
      } else if (s.fails >= 2 && s.rung > 0 && rungs[s.rung - 1].mode !== 'listen') {
        s.rung -= 1;
        s.fails = 0;
        message = 'That tempo is too quick for today. One step back, then up again.';
      } else if (found) {
        message = result.accuracy >= 0.87 ? `The notes were right. ${found}` : `${found} Try again, and keep the pulse going through any slip.`;
      } else {
        message =
          result.onTime < 0.6 && result.accuracy >= 0.87
            ? result.biasMs > 40
              ? 'The notes were right but a little behind the beat. Listen to the click and play into it.'
              : result.biasMs < -40
                ? 'The notes were right but ahead of the beat. Let the click lead.'
                : 'The notes were right, but some came early and some late. Feel each click and fit the notes to it.'
            : 'Close. Try again, and keep the pulse going through any slip.';
      }
    }
    return { state: next, verdict: { passed: ok, message, learned, aside } };
  }

  if (task.scope.type === 'join') {
    if (ok) {
      next.joined = Math.max(next.joined, task.scope.upTo);
      message = 'Joined. The seam is gone.';
    } else {
      message = 'The join is where it wobbles. Once more, and think ahead to the first note of the second phrase.';
    }
    return { state: next, verdict: { passed: ok, message, learned, aside } };
  }

  // Whole piece.
  if (isKept(state)) {
    message = ok ? 'Still in your fingers.' : 'A little rusty. It will come back quickly.';
    if (!ok) {
      next.wholeRung = WHOLE_TEMPI.length - 1;
      next.wholeStreak = 0;
    }
    return { state: next, verdict: { passed: ok, message, learned } };
  }
  if (ok) {
    // Below full tempo a clean pass moves straight on. Full tempo always takes two, so the piece is known to be stable.
    const last = next.wholeRung >= WHOLE_TEMPI.length - 1;
    // A piece learned before that went rusty needs only one good pass at each step to come back.
    const once = state.learned || (clean && !last && next.wholeStreak === 0);
    next.wholeStreak = once ? 2 : next.wholeStreak + 1;
    next.wholeFails = 0;
    if (next.wholeStreak >= 2) {
      next.wholeRung += 1;
      next.wholeStreak = 0;
      if (next.wholeRung >= WHOLE_TEMPI.length) {
        next.learned = true;
        // A piece that went rusty and came back keeps the day it was first learned, and is not announced a second time.
        next.learnedOn = state.learnedOn ?? today;
        learned = !state.learned;
        message = state.learned
          ? 'Back in your fingers.'
          : 'You have learned this piece. It will come back for a play through now and then, so it stays with you.';
      } else if (state.learned) {
        message = 'That holds together. A little faster next.';
      } else {
        message = once ? 'Clean, so once is enough. A little faster next.' : 'That holds together. A little faster next.';
      }
    } else {
      message = last ? 'Good. Once more at full tempo, to show it was no accident.' : 'Good. Once more at this tempo.';
    }
  } else {
    next.wholeStreak = 0;
    next.wholeFails += 1;
    const spots = troubleSpots(result, 1);
    const where = locate(result);
    // One place to take out, when most of the slips are there. Slips spread about have no such place.
    const spot = gathered(result);
    // The notes were there and the beat was not: nothing to take out and fix slowly.
    const timing = result.accuracy >= 0.87 && result.onTime < 0.6;
    const firstTempo = rungs.findIndex((r) => r.mode === 'tempo');
    if (next.wholeFails >= 2 && next.wholeRung > 0) {
      // A second miss at this tempo, after the trouble spot has had its turn. Slower is the way.
      next.wholeRung -= 1;
      next.wholeFails = 0;
      message = timing && found ? `${found} One step slower, then back up.` : 'One step slower, then back up.';
    } else if (next.wholeFails >= 2 && spots.length > 0 && firstTempo >= 0) {
      // Already at the slowest tempo for the whole piece. The phrase that gives the trouble goes back to its own slow beat.
      const i = phraseOf(info, spots[0].measure);
      next.sections[i] = { rung: firstTempo, streak: 0, fails: 0 };
      next.wholeFails = 0;
      message =
        info.sections.length > 1
          ? `Phrase ${i + 1} needs its slow beat again before the whole piece will hold. Back to that.`
          : 'This needs its slow beat again before it will hold at this pace. Back to that.';
    } else if (timing) {
      message = found
        ? `The notes were right. ${found}`
        : result.biasMs > 40
          ? 'The notes were right but a little behind the beat. Listen to the click and play into it.'
          : result.biasMs < -40
            ? 'The notes were right but ahead of the beat. Let the click lead.'
            : 'The notes were right, but some came early and some late. Feel each click and fit the notes to it.';
    } else if (where && where.hand && where.measure === null) {
      // One hand dropped out all the way through. No single measure is the trouble.
      message = `${where.text} Again, and keep that hand going from start to finish.`;
    } else if (spot !== null && info.measures > 2) {
      const to = Math.min(info.measures - 1, spot + 1);
      next.focus = { from: spot, to, left: 2, hands: info.hands };
      message = `Most of the slips were around measure ${spot + 1}. Let us take that out and fix it.`;
    } else if (found) {
      message = `${found} Again, and keep the pulse steady above all.`;
    } else if (result.missedNotes + result.wrongNotes >= 3) {
      message = 'The slips were spread through the piece, with no one spot to fix. Again, and keep the pulse steady above all.';
    } else {
      message = 'Nearly. Again, and keep the pulse steady above all.';
    }
  }
  // A piece just learned is a moment to enjoy. The word about long notes can wait for its next play through.
  return { state: next, verdict: { passed: ok, message, learned, aside: learned ? undefined : aside } };
}

// ------------------------------------------------------------------ the plan

export interface PlanStep {
  label: string;
  state: 'done' | 'now' | 'todo';
}

export interface PlanRow {
  title: string;
  /** Which measures, where the row covers part of the piece. */
  detail?: string;
  steps: PlanStep[];
}

function rungLabel(rung: Rung, twoHands: boolean): string {
  if (rung.mode === 'listen') return 'Listen';
  if (rung.mode === 'wait') return rung.hands === 'R' ? 'Right hand' : rung.hands === 'L' ? 'Left hand' : twoHands ? 'Together' : 'The notes';
  return rung.tempoPct <= 60 ? 'Slow beat' : 'Faster';
}

/** The whole route to a learned piece, with where the learner stands on it. */
export function planOutline(info: PieceInfo, state: PieceState): PlanRow[] {
  const rungs = rungsFor(info);
  const twoHands = info.hands.length === 2;
  const task = nextTask(info, state);
  const scope = task?.scope;
  const rows: PlanRow[] = [];
  const many = info.sections.length > 1;

  if (scope?.type === 'trial') rows.push({ title: 'To begin', steps: [{ label: 'Play it through', state: 'now' }] });
  if (scope?.type === 'focus' && task) {
    rows.push({
      title: 'A spot to fix',
      steps: [{ label: task.from === task.to ? `Measure ${task.from + 1}` : `Measures ${task.from + 1} to ${task.to + 1}`, state: 'now' }],
    });
  }

  info.sections.forEach(([from, to], i) => {
    const s = state.sections[i];
    const here = scope?.type === 'section' && scope.index === i;
    const at = settle(info, i, s.rung);
    rows.push({
      title: many ? `Phrase ${i + 1}` : 'The notes and the beat',
      detail: many ? (from === to ? `Measure ${from + 1}` : `Measures ${from + 1} to ${to + 1}`) : undefined,
      steps: rungs
        .map((rung, r) => ({ rung, r }))
        // Steps for one hand alone are left out of a phrase where only one hand plays.
        .filter(({ rung }) => applies(info, i, rung))
        .map(({ rung, r }): PlanStep => ({
          label: rungLabel(rung, twoHands && playing(info, i).length > 1),
          state: state.learned || r < at ? 'done' : here && r === at ? 'now' : 'todo',
        })),
    });
  });

  if (many) {
    rows.push({
      title: 'Join the phrases',
      steps: info.sections.slice(1).map((_, k) => {
        const i = k + 1;
        const here = scope?.type === 'join' && scope.upTo === i;
        return { label: `${i} and ${i + 1}`, state: state.learned || state.joined >= i ? 'done' : here ? 'now' : 'todo' };
      }),
    });
  }

  // A learned piece that went rusty shows the step it is being won back at.
  const kept = isKept(state);
  const whole = scope?.type === 'whole' && !kept;
  rows.push({
    title: 'The whole piece',
    steps: WHOLE_TEMPI.map((pct, r) => ({
      label: pct === 100 ? 'Full tempo' : `${pct} percent`,
      state: kept || r < state.wholeRung ? 'done' : whole && r === Math.min(state.wholeRung, WHOLE_TEMPI.length - 1) ? 'now' : 'todo',
    })),
  });
  return rows;
}

/** How far along a piece is, 0 to 1, for progress bars. */
export function pieceProgress(info: PieceInfo, state: PieceState | undefined): number {
  if (!state) return 0;
  if (state.learned) return 1;
  const rungs = rungsFor(info).length;
  const sectionPart = state.sections.reduce((a, s) => a + Math.min(s.rung, rungs) / rungs, 0) / Math.max(1, state.sections.length);
  const wholePart = state.wholeRung / WHOLE_TEMPI.length;
  return Math.min(0.98, sectionPart * 0.7 + wholePart * 0.3);
}

/** Default phrases: groups of four measures, with a short tail merged in. */
export function defaultSections(measures: number, pickup: boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const start = pickup ? 1 : 0;
  let from = 0;
  let next = start + 4;
  while (from < measures) {
    let to = Math.min(measures - 1, next - 1);
    if (measures - 1 - to <= 1) to = measures - 1;
    out.push([from, to]);
    from = to + 1;
    next = from + 4;
  }
  return out;
}
