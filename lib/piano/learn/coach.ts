/**
 * The practice coach. Given a piece and what has happened so far, it picks
 * the next thing to practise, the way a good teacher would at the piano.
 *
 * The plan follows what studies of effective piano practice found:
 *   Hear a model first, then play.
 *   New notes are learned with no time pressure, the music waits.
 *   Hands come together early, after one pass each alone.
 *   Tempo rises only after two good passes in a row, and drops after two poor ones.
 *   A trouble spot is taken out, fixed on its own, and put back.
 *   Phrases are joined as soon as each one is secure.
 */

import type { FlowResult } from '../engine/flow';
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
}

export interface PieceInfo {
  id: string;
  title: string;
  hands: Hand[];
  /** Sections as 0 based measure ranges, inclusive. */
  sections: Array<[number, number]>;
  measures: number;
}

export type TaskScope = { type: 'section'; index: number } | { type: 'join'; upTo: number } | { type: 'whole' } | { type: 'focus' };

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
  };
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

/** The next thing to practise. */
export function nextTask(info: PieceInfo, state: PieceState): Task | null {
  if (state.learned && state.wholeRung >= WHOLE_TEMPI.length) {
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
      const rung = rungs[s.rung];
      const [from, to] = info.sections[i];
      const hands: Hand[] = rung.hands === 'both' ? info.hands : [rung.hands];
      const label = phraseLabel(info, i);
      let prompt: string;
      if (rung.mode === 'listen') {
        prompt = 'Listen first and follow the notes with your eyes. Hum along if you like.';
      } else if (rung.mode === 'wait') {
        prompt =
          hands.length === 2
            ? 'Now both hands. Take all the time you need, the music waits for you.'
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
    prompt: pct === 100 ? 'Full tempo. Play it like a performance.' : 'Start to finish, steady and unhurried.',
    need: 2,
    have: state.wholeStreak,
  };
}

export interface Verdict {
  passed: boolean;
  /** What the coach says about the attempt. */
  message: string;
  /** True when this attempt finished learning the piece. */
  learned: boolean;
}

/** Was this attempt good enough to count? */
export function passes(task: Task, result: FlowResult): boolean {
  if (task.mode === 'wait') return result.accuracy >= 0.9 && result.hintedSteps <= 1;
  return result.accuracy >= 0.87 && result.onTime >= 0.6;
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

  const ok = passes(task, result);
  next.bestAccuracy = Math.max(next.bestAccuracy, result.accuracy);
  let message = '';
  let learned = false;

  if (task.scope.type === 'focus' && next.focus) {
    if (ok) {
      next.focus.left -= 1;
      if (next.focus.left <= 0) {
        next.focus = null;
        message = 'That spot is fixed. Back to the phrase.';
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
    const s = next.sections[task.scope.index];
    const rung = rungs[s.rung];
    if (ok) {
      s.streak += 1;
      s.fails = 0;
      if (s.streak >= rung.need) {
        s.rung += 1;
        s.streak = 0;
        if (s.rung >= rungs.length) {
          message = 'This phrase is secure. Well done.';
        } else {
          const after = rungs[s.rung];
          if (after.mode === 'tempo' && rung.mode === 'wait') message = 'You know the notes. Next, with a steady beat.';
          else if (after.mode === 'tempo') message = 'Steady. A little faster next.';
          else if (after.hands === 'both' && rung.hands !== 'both') message = 'Good. Now put the hands together.';
          else message = 'Good. On to the next step.';
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
          message = `Measure ${m + 1} keeps tripping you. Let us fix it on its own.`;
        } else {
          message = 'Slow down, and pause before any note you are unsure of. Stopping to get it right is good practice.';
        }
      } else if (s.fails >= 2 && s.rung > 0 && rungs[s.rung - 1].mode !== 'listen') {
        s.rung -= 1;
        s.fails = 0;
        message = 'That tempo is too quick for today. One step back, then up again.';
      } else {
        message =
          result.onTime < 0.6 && result.accuracy >= 0.87
            ? result.biasMs > 0
              ? 'The notes were right but a little behind the beat. Listen to the click and play into it.'
              : 'The notes were right but ahead of the beat. Let the click lead.'
            : 'Close. Try again, and keep the pulse going through any slip.';
      }
    }
    return { state: next, verdict: { passed: ok, message, learned } };
  }

  if (task.scope.type === 'join') {
    if (ok) {
      next.joined = Math.max(next.joined, task.scope.upTo);
      message = 'Joined. The seam is gone.';
    } else {
      message = 'The join is where it wobbles. Once more, and think ahead to the first note of the second phrase.';
    }
    return { state: next, verdict: { passed: ok, message, learned } };
  }

  // Whole piece.
  if (state.learned && state.wholeRung >= WHOLE_TEMPI.length) {
    message = ok ? 'Still in your fingers.' : 'A little rusty. It will come back quickly.';
    if (!ok) {
      next.wholeRung = WHOLE_TEMPI.length - 1;
      next.wholeStreak = 0;
    }
    return { state: next, verdict: { passed: ok, message, learned } };
  }
  if (ok) {
    next.wholeStreak += 1;
    next.wholeFails = 0;
    if (next.wholeStreak >= 2) {
      next.wholeRung += 1;
      next.wholeStreak = 0;
      if (next.wholeRung >= WHOLE_TEMPI.length) {
        next.learned = true;
        next.learnedOn = today;
        learned = true;
        message = 'You have learned this piece. It will come back for a play through now and then, so it stays with you.';
      } else {
        message = 'That holds together. A little faster next.';
      }
    } else {
      message = 'Good. Once more at this tempo.';
    }
  } else {
    next.wholeStreak = 0;
    next.wholeFails += 1;
    const spots = troubleSpots(result, 1);
    if (spots.length > 0 && info.measures > 2) {
      const m = spots[0].measure;
      const to = Math.min(info.measures - 1, m + 1);
      next.focus = { from: m, to, left: 2, hands: info.hands };
      message = `Most of the slips were around measure ${m + 1}. Let us take that out and fix it.`;
    } else if (next.wholeFails >= 2 && next.wholeRung > 0) {
      next.wholeRung -= 1;
      next.wholeFails = 0;
      message = 'One step slower, then back up.';
    } else {
      message = 'Nearly. Again, and keep the pulse steady above all.';
    }
  }
  return { state: next, verdict: { passed: ok, message, learned } };
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
