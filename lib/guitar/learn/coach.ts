/**
 * The practice coach. Given a song and what has happened so far, it picks
 * the next thing to practise, the way a good teacher would sitting beside you.
 *
 * It follows the same plan as the piano app's coach:
 *   Practise what cannot yet be played. A first play through shows what is
 *   already known, and those parts are not drilled again.
 *   Hear it first, then play.
 *   New chords and notes are learned with no time pressure: the music waits.
 *   Then a slow beat, then faster: up after two good passes or one clean one,
 *   back down after two that do not hold.
 *   A trouble spot is taken out, fixed on its own, and put back.
 *
 * And it adds what a guitar teacher knows: in a strummed song the trouble is
 * nearly always a chord change. When one change keeps coming late, it is
 * taken out and practised on its own, back and forth, until it is quick.
 */

import type { FollowResult } from '../engine/follow';
import { hardestChange, troubleSpots } from '../engine/follow';
import { changeTip } from '../music/score';
import { noteLetter } from '../music/theory';
import { dayKey } from '../util/emitter';

export interface SectionState {
  rung: number;
  streak: number;
  fails: number;
}

export type Focus =
  | { type: 'measures'; from: number; to: number; left: number }
  | { type: 'change'; from: string; to: string; left: number };

export interface SongState {
  startedOn: string;
  lastOn: string;
  sections: SectionState[];
  /** Phrases 0..joined are linked into one stretch. */
  joined: number;
  /** Place on the whole song ladder: 0 not started, then 70, 85 and 100 percent. */
  wholeRung: number;
  wholeStreak: number;
  wholeFails: number;
  learned: boolean;
  learnedOn?: string;
  focus: Focus | null;
  tasksToday: number;
  bestAccuracy: number;
  /** The first play through, which shows what is already known. */
  trial?: 'pending' | 'done';
}

export interface SongInfo {
  id: string;
  title: string;
  kind: 'strum' | 'melody' | 'pick';
  /** Phrases as 0 based measure ranges, inclusive. */
  sections: Array<[number, number]>;
  measures: number;
}

export type TaskScope = { type: 'trial' } | { type: 'section'; index: number } | { type: 'join'; upTo: number } | { type: 'whole' } | { type: 'focus' };

export interface Task {
  mode: 'listen' | 'wait' | 'tempo';
  from: number;
  to: number;
  /** Percent of the performance tempo. */
  tempoPct: number;
  /** Strummed songs: one strum on each beat, before the song's own pattern. */
  simple: boolean;
  scope: TaskScope;
  title: string;
  prompt: string;
  need: number;
  have: number;
  /** A chord change to practise on its own, back and forth. */
  change?: { from: string; to: string };
  stopAfter?: { hints: number; wrong: number };
}

interface Rung {
  mode: 'listen' | 'wait' | 'tempo';
  tempoPct: number;
  simple: boolean;
  need: number;
}

const RUNGS_STRUM: Rung[] = [
  { mode: 'listen', tempoPct: 90, simple: false, need: 1 },
  { mode: 'wait', tempoPct: 0, simple: false, need: 2 },
  { mode: 'tempo', tempoPct: 60, simple: true, need: 2 },
  { mode: 'tempo', tempoPct: 75, simple: false, need: 2 },
];

const RUNGS_NOTES: Rung[] = [
  { mode: 'listen', tempoPct: 90, simple: false, need: 1 },
  { mode: 'wait', tempoPct: 0, simple: false, need: 2 },
  { mode: 'tempo', tempoPct: 60, simple: false, need: 2 },
  { mode: 'tempo', tempoPct: 80, simple: false, need: 2 },
];

const WHOLE_TEMPI = [70, 85, 100];

function rungsFor(info: SongInfo): Rung[] {
  return info.kind === 'strum' ? RUNGS_STRUM : RUNGS_NOTES;
}

export function newSongState(info: SongInfo, today: string = dayKey()): SongState {
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

/** A state from an older version of a song, brought into line with its phrases now. */
export function fitState(info: SongInfo, state: SongState): SongState {
  if (state.sections.length === info.sections.length) return state;
  const sections = info.sections.map((_, i) => state.sections[i] ?? { rung: 0, streak: 0, fails: 0 });
  return { ...state, sections, joined: Math.min(state.joined, sections.length - 1) };
}

export function trialPending(state: SongState): boolean {
  if (state.learned) return false;
  if (state.trial !== undefined) return state.trial === 'pending';
  return state.joined === 0 && state.wholeRung === 0 && !state.focus && state.sections.every((s) => s.rung === 0);
}

export function skipTrial(state: SongState): SongState {
  return { ...state, trial: 'done' };
}

function phraseLabel(info: SongInfo, i: number): string {
  return info.sections.length === 1 ? 'The whole song' : `Line ${i + 1}`;
}

function secure(info: SongInfo, s: SectionState): boolean {
  return s.rung >= rungsFor(info).length;
}

/** A learned song in good order, as against one that was learned and has gone rusty. */
export function isKept(state: SongState): boolean {
  return state.learned && state.wholeRung >= WHOLE_TEMPI.length;
}

/** The next thing to practise. */
export function nextTask(info: SongInfo, state: SongState): Task | null {
  const all = { from: 0, to: info.measures - 1 };
  if (isKept(state)) {
    return { mode: 'tempo', ...all, tempoPct: 100, simple: false, scope: { type: 'whole' }, title: 'Play it through', prompt: 'The whole song, as you would play it for someone listening.', need: 1, have: 0 };
  }
  if (trialPending(state)) {
    return {
      mode: 'wait',
      ...all,
      tempoPct: 0,
      simple: false,
      scope: { type: 'trial' },
      title: 'First, play it through',
      prompt:
        info.kind === 'strum'
          ? 'Strum each new chord once, in your own time. Whatever you already have will not be drilled again.'
          : 'Play what you know of it, in your own time. Whatever you already have will not be drilled again.',
      need: 1,
      have: 0,
      stopAfter: { hints: 2, wrong: 4 },
    };
  }
  if (state.focus) {
    const f = state.focus;
    if (f.type === 'change') {
      return {
        mode: 'wait',
        ...all,
        tempoPct: 0,
        simple: false,
        scope: { type: 'focus' },
        title: `${f.from} to ${f.to}, on its own`,
        prompt: `Back and forth between ${f.from} and ${f.to}, one strum each. Look at the next shape before you move. ${changeTip(f.from, f.to) ?? ''}`.trim(),
        need: 2,
        have: 2 - f.left,
        change: { from: f.from, to: f.to },
      };
    }
    return {
      mode: 'wait',
      from: f.from,
      to: f.to,
      tempoPct: 0,
      simple: false,
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
      const rung = rungs[Math.min(s.rung, rungs.length - 1)];
      const [from, to] = info.sections[i];
      const label = phraseLabel(info, i);
      const strum = info.kind === 'strum';
      let prompt: string;
      let title: string;
      if (rung.mode === 'listen') {
        title = `${label}: listen`;
        prompt = strum ? 'Listen first, and follow the chords with your eyes. Sing along if you like.' : 'Listen first, and follow the notes with your eyes. Hum along if you like.';
      } else if (rung.mode === 'wait') {
        title = strum ? `${label}, the chord changes` : `${label}, the notes`;
        prompt = strum ? 'Strum each new chord once. Take all the time you need to find the shape. The music waits.' : 'In your own time. The music waits for you.';
      } else if (rung.simple) {
        title = `${label}, one strum a beat`;
        prompt = 'With a slow beat now, one down strum on each click. Keep strumming even if a chord is not quite there yet.';
      } else {
        title = `${label}, with the beat`;
        prompt = strum ? 'Now the song\'s own strum, at an easy pace. Keep your hand moving through the changes.' : 'With the beat now, at an easy pace. Keep going even if a note slips.';
      }
      return { mode: rung.mode, from, to, tempoPct: rung.tempoPct, simple: rung.simple, scope: { type: 'section', index: i }, title, prompt, need: rung.need, have: s.streak };
    }
    if (i >= 1 && state.joined < i) {
      const [from] = info.sections[i - 1];
      const [, to] = info.sections[i];
      return {
        mode: 'tempo',
        from,
        to,
        tempoPct: 70,
        simple: false,
        scope: { type: 'join', upTo: i },
        title: `Join lines ${i} and ${i + 1}`,
        prompt: 'Now link the two lines, so there is no gap where one ends and the next begins.',
        need: 1,
        have: 0,
      };
    }
  }
  const rung = Math.min(state.wholeRung, WHOLE_TEMPI.length - 1);
  const pct = WHOLE_TEMPI[rung];
  return {
    mode: 'tempo',
    ...all,
    tempoPct: pct,
    simple: false,
    scope: { type: 'whole' },
    title: pct === 100 ? 'The whole song, full speed' : `The whole song at ${pct} percent`,
    prompt: state.learned && pct === 100 ? 'Once more from the top. It will come back.' : pct === 100 ? 'Full speed. Play it like you mean it.' : 'Start to finish, steady and unhurried.',
    need: state.learned ? 1 : 2,
    have: state.learned ? 0 : state.wholeStreak,
  };
}

export interface Verdict {
  passed: boolean;
  message: string;
  learned: boolean;
  /** Neither a pass nor a miss, as after the first play through of a new song. */
  plain?: boolean;
  /** One more thing worth a word after a run that counted. */
  aside?: string;
}

/** Was this run good enough to count? A microphone mishears the odd strum, so there is a little room. */
export function passes(task: Task, result: FollowResult, kind: SongInfo['kind']): boolean {
  if (task.mode === 'wait') {
    // Chords are judged by ear, and a strum now and then is misheard, so a strummed song gets more room.
    const pauses = Math.max(1, Math.round(result.totalSteps * 0.2));
    return result.accuracy >= (kind === 'strum' ? 0.74 : 0.84) && result.pausedSteps <= pauses;
  }
  const last = task.scope.type === 'whole' && task.tempoPct >= 100 && task.need > 1;
  const chords = result.chordsRight === null || result.chordsRight >= 0.6;
  return result.accuracy >= (last ? 0.88 : 0.82) && result.onTime >= 0.6 && chords;
}

/** So good a second run would teach nothing. The last tempo always takes two. */
export function cleanPass(task: Task, result: FollowResult): boolean {
  if (result.cutShort) return false;
  if (task.mode === 'wait') return result.clean && result.fluency >= 0.9;
  return result.clean && result.onTime >= 0.8;
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, x) => a + x, 0) / xs.length);

/** Right strums all off the beat by much the same amount: a delay, not a habit. */
export function steadyLag(result: FollowResult): number | null {
  if (result.mode !== 'tempo' || result.accuracy < 0.85 || result.onTime >= 0.6) return null;
  const size = Math.abs(result.biasMs);
  if (size < 90 || result.meanAbsMs - size > 40) return null;
  return result.biasMs;
}

/** Why the timing was off, when the strums show a clear pattern. */
export function whyOffTheBeat(result: FollowResult, strict = false): string | null {
  const timed = result.detail.filter((d) => d.errMs !== undefined);
  if (timed.length < 6) return null;
  const k = strict ? 1.4 : 1;
  // Late on the first strum after each change, while the rest are on time: the fingers move too late.
  const changes = new Set<number>();
  for (let i = 1; i < result.detail.length; i++) if (result.detail[i].chord && result.detail[i].chord !== result.detail[i - 1].chord) changes.add(i);
  const after = timed.filter((d) => changes.has(d.index)).map((d) => d.errMs as number);
  const rest = timed.filter((d) => !changes.has(d.index)).map((d) => d.errMs as number);
  if (after.length >= 2 && rest.length >= 3 && mean(after) >= 70 * k && mean(after) - mean(rest) >= 50 * k) {
    return 'The first strum after each chord change came late. Start moving your fingers while the last strum of the old chord still rings.';
  }
  // Speeding up or slowing down across the run.
  if (timed.length >= 8) {
    const xs = timed.map((d) => d.start);
    const ys = timed.map((d) => d.errMs as number);
    const mx = mean(xs);
    const my = mean(ys);
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const syy = ys.reduce((a, y) => a + (y - my) ** 2, 0);
    const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    if (sxx > 0 && syy > 0) {
      const change = (sxy / sxx) * (Math.max(...xs) - Math.min(...xs));
      const fit = (sxy * sxy) / (sxx * syy);
      if (fit >= 0.45 && change <= -110 * k) return 'You sped up as it went on. Let the click hold you back.';
      if (fit >= 0.45 && change >= 110 * k) return 'You fell further behind as it went on. Keep your eyes a chord ahead of your hands.';
    }
  }
  return null;
}

/** What a run says about the sound of the chords and the strumming hand. */
function soundWord(result: FollowResult): string | null {
  if (result.mode === 'tempo' && result.extraStrikes >= Math.max(3, result.totalSteps * 0.2)) {
    return 'Some extra strums crept in. Keep the hand moving down and up, and just miss the strings where the pattern has a gap.';
  }
  if (result.deadStrikes >= Math.max(3, result.totalSteps * 0.25)) {
    return 'Several strums had hardly any note in them, as if the strings were muted. Press with the fingertips, just behind the frets, and let the strings ring.';
  }
  if (result.chordsRight !== null && result.chordsRight < 0.6 && result.quietNotes.length > 0) {
    const names = result.quietNotes.slice(0, 2).map((pc) => noteLetter(pc));
    return `The chords did not ring clearly: ${names.join(' and ')} ${names.length === 1 ? 'was' : 'were'} hard to hear. Pick each string of the chord on its own to find the one that is muted.`;
  }
  return null;
}

/** The most useful single thing to say about a run that fell short. */
export function diagnose(result: FollowResult): string | null {
  if (result.mode === 'wait') {
    const spots = troubleSpots(result, 1);
    const change = hardestChange(result);
    if (change) return `The change from ${change.from} to ${change.to} took longest.`;
    if (spots.length > 0 && result.perMeasure.length > 1) return `Most of the slips were in measure ${spots[0].measure + 1}.`;
    return soundWord(result);
  }
  return soundWord(result) ?? whyOffTheBeat(result) ?? null;
}

/** A run without a beat in a few words. */
export function waitSummary(result: FollowResult): string {
  if (result.clean) return result.kind === 'strum' ? 'Every chord right the first time' : 'Every note right the first time';
  const parts: string[] = [];
  const unit = result.kind === 'strum' ? 'chord' : 'note';
  const missed = result.wrongTries + result.unclearTries;
  parts.push(missed === 0 ? `No ${unit}s missed` : missed === 1 ? `One ${unit} took a second try` : `${missed} ${unit}s took another try`);
  if (result.hintedSteps > 0) parts.push(result.hintedSteps === 1 ? 'one shown' : `${result.hintedSteps} shown`);
  return parts.join(', ');
}

/** A run with a beat in a few words. */
export function tempoSummary(result: FollowResult): string {
  const pct = Math.round(result.accuracy * 100);
  const unit = result.kind === 'strum' ? 'strums' : 'notes';
  const timing = result.onTime >= 0.8 ? 'well in time' : result.biasMs > 30 ? 'a little behind the beat' : result.biasMs < -30 ? 'a little ahead of the beat' : 'a little uneven';
  return `${pct} percent of the ${unit}, ${timing}`;
}

function phraseOf(info: SongInfo, measure: number): number {
  const i = info.sections.findIndex(([a, b]) => measure >= a && measure <= b);
  return i < 0 ? 0 : i;
}

function placeFromTrial(info: SongInfo, state: SongState, result: FollowResult): { state: SongState; verdict: Verdict } {
  const rungs = rungsFor(info);
  const waitRung = rungs.findIndex((r) => r.mode === 'wait');
  const firstTempo = waitRung + 1;
  const fluent = result.pace === null || result.pace >= 0.4;
  const next: SongState = { ...state, trial: 'done', sections: state.sections.map((s) => ({ ...s })) };
  const levels = info.sections.map(([from, to]) => {
    const stats = result.perMeasure.filter((m) => m.measure >= from && m.measure <= to);
    const reached = stats.length > 0 && stats.every((m) => m.played >= m.steps);
    const errors = stats.reduce((a, m) => a + m.errors, 0);
    const hints = stats.reduce((a, m) => a + m.hints, 0);
    const pauses = stats.reduce((a, m) => a + m.hesitations, 0);
    if (!reached) return 'new' as const;
    if (errors === 0 && hints === 0 && pauses <= 1) return 'known' as const;
    return errors <= 2 && hints <= 1 && pauses <= 2 ? ('nearly' as const) : ('new' as const);
  });
  levels.forEach((level, i) => {
    const s = next.sections[i];
    s.streak = 0;
    s.fails = 0;
    if (level === 'known') s.rung = fluent ? rungs.length : firstTempo;
    else if (level === 'nearly') s.rung = waitRung;
  });
  let joined = 0;
  while (joined + 1 < info.sections.length && secure(info, next.sections[joined]) && secure(info, next.sections[joined + 1])) joined++;
  next.joined = secure(info, next.sections[0]) ? joined : 0;
  const known = levels.map((l, i) => (l === 'known' ? i + 1 : 0)).filter((n) => n > 0);
  const many = info.sections.length > 1;
  const strum = info.kind === 'strum';
  let message: string;
  let passed = true;
  let plain = false;
  if (known.length === levels.length) {
    message = fluent ? `You know ${strum ? 'the changes' : 'the notes'} already. Next, the whole song with a slow beat.` : `${strum ? 'The chords' : 'The notes'} are right. Next comes a slow beat.`;
  } else if (known.length > 0) {
    const list = known.length === 1 ? `Line ${known[0]} is` : `Lines ${known.slice(0, -1).join(', ')} and ${known[known.length - 1]} are`;
    message = `${list} in your fingers already. We will work on the rest.`;
  } else if (levels.some((l) => l === 'nearly')) {
    message = `Nearly there already. A little work on the ${strum ? 'changes' : 'notes'}, then the beat.`;
  } else {
    passed = false;
    plain = true;
    message = many ? 'That is all that was needed. This one is new to you, so we will build it a line at a time.' : 'That is all that was needed. This one is new to you, so we will build it step by step.';
  }
  return { state: next, verdict: { passed, message, learned: false, plain } };
}

/** Record a run and return the new state with the coach's reply. */
export function applyResult(info: SongInfo, state: SongState, task: Task, result: FollowResult | null, today: string = dayKey()): { state: SongState; verdict: Verdict } {
  const next: SongState = {
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

  const ok = passes(task, result, info.kind);
  const clean = ok && cleanPass(task, result);
  next.bestAccuracy = Math.max(next.bestAccuracy, result.accuracy);
  const found = ok ? null : diagnose(result);
  const aside = ok && task.mode === 'tempo' ? (soundWord(result) ?? whyOffTheBeat(result, true) ?? undefined) : undefined;
  let message = '';
  let learned = false;

  const lag = steadyLag(result);
  if (!ok && task.mode === 'tempo' && lag !== null && !found) {
    message =
      lag > 0
        ? 'The strums were all late by about the same amount. If it sounded on the beat to you, run the timing check in Settings. If not, aim to land with the click, not after it.'
        : 'The strums were all early by about the same amount. If it sounded on the beat to you, run the timing check in Settings. If not, let the click lead.';
    return { state: next, verdict: { passed: false, message, learned } };
  }

  if (task.scope.type === 'focus' && next.focus) {
    if (ok) {
      next.focus.left -= 1;
      if (next.focus.left <= 0) {
        const was = next.focus;
        next.focus = null;
        message = was.type === 'change' ? `That change is quicker now. Back to the song.` : 'That spot is fixed. Back to the song.';
      } else {
        message = 'Good. Once more the same way, to make it stick.';
      }
    } else {
      next.focus.left = 2;
      message = next.focus.type === 'change' ? 'Slower still. Picture the next shape before your fingers move.' : 'Slower still. Look at the next note before you play it.';
    }
    return { state: next, verdict: { passed: ok, message, learned } };
  }

  if (task.scope.type === 'section') {
    const index = task.scope.index;
    const s = next.sections[index];
    const rung = rungs[Math.min(s.rung, rungs.length - 1)];
    if (ok) {
      const once = clean && s.streak === 0 && rung.need > 1;
      s.streak = clean ? rung.need : s.streak + 1;
      s.fails = 0;
      if (s.streak >= rung.need) {
        s.rung += 1;
        s.streak = 0;
        const lead = once ? 'Clean, so once is enough.' : null;
        if (s.rung >= rungs.length) message = lead ? `${lead} This line is secure.` : 'This line is secure. Well done.';
        else {
          const after = rungs[s.rung];
          if (after.mode === 'tempo' && rung.mode === 'wait') message = `${lead ?? (info.kind === 'strum' ? 'You know the changes.' : 'You know the notes.')} Next, with a steady beat.`;
          else if (after.mode === 'tempo' && !after.simple && rung.simple) message = `${lead ?? 'Steady.'} Next, the song\'s own strum.`;
          else message = `${lead ?? 'Good.'} A little faster next.`;
        }
      } else {
        message = task.mode === 'wait' ? 'Right. Once more, just as calmly.' : 'Good. One more like that and we move on.';
      }
    } else {
      s.streak = 0;
      s.fails += 1;
      const change = hardestChange(result);
      if (info.kind === 'strum' && change && s.fails >= 2) {
        // The same change, again and again: take it out and practise it alone.
        next.focus = { type: 'change', from: change.from, to: change.to, left: 2 };
        s.fails = 0;
        message = `The change from ${change.from} to ${change.to} keeps holding you up. Let us practise just that, back and forth.`;
      } else if (task.mode === 'wait') {
        const spots = troubleSpots(result, 1);
        if (info.kind !== 'strum' && s.fails >= 2 && spots.length > 0 && task.to > task.from) {
          const m = spots[0].measure;
          next.focus = { type: 'measures', from: m, to: m, left: 2 };
          s.fails = 0;
          message = `Measure ${m + 1} keeps tripping you. Let us fix it on its own.`;
        } else {
          message = found ? `${found} Take that part slowly.` : info.kind === 'strum' ? 'Take your time with each shape. Strum only once your fingers are all in place.' : 'Slow down, and pause before any note you are unsure of.';
        }
      } else if (s.fails >= 2 && rungs[Math.max(0, s.rung - 1)].mode === 'tempo') {
        s.rung -= 1;
        s.fails = 0;
        message = 'That speed is too quick for today. One step back, then up again.';
      } else {
        message = found ? `${found} Try again, and keep your strumming hand going through any slip.` : 'Close. Try again, and keep your strumming hand going through any slip.';
      }
    }
    return { state: next, verdict: { passed: ok, message, learned, aside } };
  }

  if (task.scope.type === 'join') {
    if (ok) {
      next.joined = Math.max(next.joined, task.scope.upTo);
      message = 'Joined. No gap at all.';
    } else {
      message = 'The join is where it wobbles. Once more, and think ahead to the first chord of the next line.';
    }
    return { state: next, verdict: { passed: ok, message, learned, aside } };
  }

  // The whole song.
  if (isKept(state)) {
    message = ok ? 'Still in your fingers.' : 'A little rusty. It will come back quickly.';
    if (!ok) {
      next.wholeRung = WHOLE_TEMPI.length - 1;
      next.wholeStreak = 0;
    }
    return { state: next, verdict: { passed: ok, message, learned } };
  }
  if (ok) {
    const last = next.wholeRung >= WHOLE_TEMPI.length - 1;
    const once = state.learned || (clean && !last && next.wholeStreak === 0);
    next.wholeStreak = once ? 2 : next.wholeStreak + 1;
    next.wholeFails = 0;
    if (next.wholeStreak >= 2) {
      next.wholeRung += 1;
      next.wholeStreak = 0;
      if (next.wholeRung >= WHOLE_TEMPI.length) {
        next.learned = true;
        next.learnedOn = state.learnedOn ?? today;
        learned = !state.learned;
        message = state.learned ? 'Back in your fingers.' : 'You have learned this song. It will come back for a play through now and then, so it stays with you.';
      } else {
        message = once && !state.learned ? 'Clean, so once is enough. A little faster next.' : 'That holds together. A little faster next.';
      }
    } else {
      message = last ? 'Good. Once more at full speed, to show it was no accident.' : 'Good. Once more at this speed.';
    }
  } else {
    next.wholeStreak = 0;
    next.wholeFails += 1;
    const change = hardestChange(result);
    const spots = troubleSpots(result, 1);
    if (info.kind === 'strum' && change) {
      next.focus = { type: 'change', from: change.from, to: change.to, left: 2 };
      message = `The change from ${change.from} to ${change.to} came late ${change.times} times. Let us practise just that, then go back.`;
    } else if (next.wholeFails >= 2 && next.wholeRung > 0) {
      next.wholeRung -= 1;
      next.wholeFails = 0;
      message = found ? `${found} One step slower, then back up.` : 'One step slower, then back up.';
    } else if (next.wholeFails >= 2 && spots.length > 0) {
      const i = phraseOf(info, spots[0].measure);
      const firstTempo = rungs.findIndex((r) => r.mode === 'tempo');
      next.sections[i] = { rung: firstTempo, streak: 0, fails: 0 };
      next.wholeFails = 0;
      message = info.sections.length > 1 ? `Line ${i + 1} needs its slow beat again before the whole song will hold. Back to that.` : 'This needs its slow beat again before it will hold at this pace. Back to that.';
    } else if (info.kind !== 'strum' && spots.length > 0 && info.measures > 2) {
      const m = spots[0].measure;
      next.focus = { type: 'measures', from: m, to: Math.min(info.measures - 1, m + 1), left: 2 };
      message = `Most of the slips were around measure ${m + 1}. Let us take that out and fix it.`;
    } else {
      message = found ? `${found} Again, and keep the beat steady above all.` : 'Nearly. Again, and keep the beat steady above all.';
    }
  }
  return { state: next, verdict: { passed: ok, message, learned, aside: learned ? undefined : aside } };
}

// ------------------------------------------------------------------ the plan

/** A place on the plan that can be gone straight to. */
export type PlanPlace = { type: 'section'; index: number; rung: number } | { type: 'join'; upTo: number } | { type: 'whole'; rung: number };

export interface PlanStep {
  label: string;
  state: 'done' | 'now' | 'todo';
  /** Where this step is, for going straight to it. */
  place?: PlanPlace;
}

/**
 * Leave the step the coach has set and go on to the one after, with no
 * credit for it. The learner decides what they already know. The last run
 * of the whole song cannot be passed over: that one is the song.
 */
export function skipTask(info: SongInfo, state: SongState): SongState | null {
  const task = nextTask(info, state);
  if (!task || isKept(state)) return null;
  const next: SongState = { ...state, sections: state.sections.map((s) => ({ ...s })), focus: state.focus ? { ...state.focus } : null };
  const scope = task.scope;
  if (scope.type === 'trial') return skipTrial(next);
  if (scope.type === 'focus') {
    next.focus = null;
    return next;
  }
  if (scope.type === 'section') {
    next.sections[scope.index] = { rung: next.sections[scope.index].rung + 1, streak: 0, fails: 0 };
    return next;
  }
  if (scope.type === 'join') {
    next.joined = Math.max(next.joined, scope.upTo);
    return next;
  }
  if (next.wholeRung >= WHOLE_TEMPI.length - 1) return null;
  next.wholeRung += 1;
  next.wholeStreak = 0;
  next.wholeFails = 0;
  return next;
}

/**
 * Go straight to a place on the plan. Everything before it is taken as
 * known, and the step itself, with what follows it, is still to do.
 */
export function jumpTo(info: SongInfo, state: SongState, place: PlanPlace): SongState {
  const rungs = rungsFor(info);
  const secure = { rung: rungs.length, streak: 0, fails: 0 };
  const next: SongState = { ...state, sections: state.sections.map((s) => ({ ...s })), focus: null, trial: 'done', wholeStreak: 0, wholeFails: 0 };
  if (place.type === 'section') {
    next.sections = next.sections.map((s, i) => (i < place.index ? { ...secure } : i === place.index ? { rung: Math.max(0, Math.min(rungs.length - 1, place.rung)), streak: 0, fails: 0 } : s));
    next.joined = Math.min(next.joined, Math.max(0, place.index - 1));
    next.wholeRung = 0;
  } else if (place.type === 'join') {
    next.sections = next.sections.map((s, i) => (i <= place.upTo ? { ...secure } : s));
    next.joined = Math.max(0, place.upTo - 1);
    next.wholeRung = 0;
  } else {
    next.sections = next.sections.map(() => ({ ...secure }));
    next.joined = Math.max(0, info.sections.length - 1);
    next.wholeRung = Math.max(0, Math.min(WHOLE_TEMPI.length - 1, place.rung));
  }
  return next;
}

export interface PlanRow {
  title: string;
  detail?: string;
  steps: PlanStep[];
}

function rungLabel(rung: Rung, kind: SongInfo['kind']): string {
  if (rung.mode === 'listen') return 'Listen';
  if (rung.mode === 'wait') return kind === 'strum' ? 'Chord changes' : 'The notes';
  if (rung.simple) return 'One strum a beat';
  return kind === 'strum' ? 'The strum' : rung.tempoPct <= 60 ? 'Slow beat' : 'Faster';
}

/** The whole route to a learned song, with where the learner stands on it. */
export function planOutline(info: SongInfo, state: SongState): PlanRow[] {
  const rungs = rungsFor(info);
  const task = nextTask(info, state);
  const scope = task?.scope;
  const rows: PlanRow[] = [];
  const many = info.sections.length > 1;
  if (scope?.type === 'trial') rows.push({ title: 'To begin', steps: [{ label: 'Play it through', state: 'now' }] });
  if (scope?.type === 'focus' && task) rows.push({ title: 'A spot to fix', steps: [{ label: task.change ? `${task.change.from} to ${task.change.to}` : task.title, state: 'now' }] });
  info.sections.forEach(([from, to], i) => {
    const s = state.sections[i];
    const here = scope?.type === 'section' && scope.index === i;
    rows.push({
      title: many ? `Line ${i + 1}` : 'The chords and the beat',
      detail: many ? (from === to ? `Measure ${from + 1}` : `Measures ${from + 1} to ${to + 1}`) : undefined,
      steps: rungs.map((rung, r): PlanStep => ({ label: rungLabel(rung, info.kind), state: state.learned || r < s.rung ? 'done' : here && r === s.rung ? 'now' : 'todo', place: { type: 'section', index: i, rung: r } })),
    });
  });
  if (many) {
    rows.push({
      title: 'Join the lines',
      steps: info.sections.slice(1).map((_, k) => {
        const i = k + 1;
        const here = scope?.type === 'join' && scope.upTo === i;
        return { label: `${i} and ${i + 1}`, state: state.learned || state.joined >= i ? 'done' : here ? 'now' : 'todo', place: { type: 'join', upTo: i } };
      }),
    });
  }
  const kept = isKept(state);
  const whole = scope?.type === 'whole' && !kept;
  rows.push({
    title: 'The whole song',
    steps: WHOLE_TEMPI.map((pct, r) => ({
      label: pct === 100 ? 'Full speed' : `${pct} percent`,
      state: kept || r < state.wholeRung ? 'done' : whole && r === Math.min(state.wholeRung, WHOLE_TEMPI.length - 1) ? 'now' : 'todo',
      place: { type: 'whole', rung: r },
    })),
  });
  return rows;
}

/** How far along a song is, 0 to 1. */
export function songProgress(info: SongInfo, state: SongState | undefined): number {
  if (!state) return 0;
  if (state.learned) return 1;
  const rungs = rungsFor(info).length;
  const sectionPart = state.sections.reduce((a, s) => a + Math.min(s.rung, rungs) / rungs, 0) / Math.max(1, state.sections.length);
  const wholePart = state.wholeRung / WHOLE_TEMPI.length;
  return Math.min(0.98, sectionPart * 0.7 + wholePart * 0.3);
}

/** Default phrases: groups of four measures, a short tail merged in. */
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
