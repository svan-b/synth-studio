import { describe, expect, it } from 'vitest';
import {
  applyResult,
  cleanPass,
  defaultSections,
  diagnose,
  newPieceState,
  nextTask,
  passes,
  pieceProgress,
  planOutline,
  skipTrial,
  trialPending,
  type PieceInfo,
  type PieceState,
} from './coach';
import { isDue, newCard, outcomeFromAccuracy, outcomeFromAnswer, review } from './srs';
import { milestones } from './milestones';
import { streak } from './store';
import type { FlowResult, MeasureStat, NoteOutcome } from '../engine/flow';

const info: PieceInfo = { id: 'p', title: 'P', hands: ['R', 'L'], sections: [[0, 3], [4, 7]], measures: 8 };

function result(patch: Partial<FlowResult> = {}): FlowResult {
  return {
    mode: 'wait',
    hands: ['R'],
    bpm: 80,
    totalNotes: 16,
    correctNotes: 16,
    wrongNotes: 0,
    missedNotes: 0,
    hintedSteps: 0,
    pausedSteps: 0,
    totalSteps: 16,
    accuracy: 1,
    onTime: 1,
    meanAbsMs: 20,
    biasMs: 0,
    fluency: 1,
    perMeasure: [],
    seconds: 10,
    clean: true,
    velocity: null,
    byEar: false,
    detail: [],
    wrong: [],
    held: null,
    pace: null,
    cutShort: false,
    octaveShift: 0,
    earlyKeys: 0,
    take: null,
    ...patch,
  };
}

/** A pass that counts but is not spotless, so nothing is skipped. */
const good = { clean: false, accuracy: 0.93, onTime: 0.7 };

/** A piece already past its first play through, as most of these tests want. */
function begun(i: PieceInfo = info, day = '2026-01-01'): PieceState {
  return skipTrial(newPieceState(i, day));
}

/** Per measure figures for a play through of the eight measure test piece. */
function measures(patch: Record<number, Partial<MeasureStat>> = {}, reached = 8): MeasureStat[] {
  return Array.from({ length: 8 }, (_, m) => ({ measure: m, notes: 4, errors: 0, hesitations: 0, hints: 0, played: m < reached ? 4 : 0, ...(patch[m] ?? {}) }));
}

/** Notes on the beat, one a beat, with the timing errors given. */
function timed(errs: number[], opts: { dur?: number; step?: number; hand?: 'R' | 'L' } = {}): NoteOutcome[] {
  const step = opts.step ?? 1;
  return errs.map((errMs, i) => ({
    id: `${opts.hand ?? 'R'}${i}`,
    hand: opts.hand ?? 'R',
    measure: Math.floor((i * step) / 4),
    start: i * step,
    dur: opts.dur ?? step,
    midi: 60,
    state: Math.abs(errMs) <= 100 ? 'ok' : 'off',
    errMs,
  }));
}

describe('practice coach', () => {
  it('starts by listening, then each hand, then together, then with the beat', () => {
    let state = begun();
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const task = nextTask(info, state)!;
      if (task.scope.type !== 'section' || task.scope.index !== 0) break;
      seen.push(`${task.mode}:${task.hands.join('')}:${task.tempoPct}`);
      state = applyResult(info, state, task, task.mode === 'listen' ? null : result({ mode: task.mode === 'tempo' ? 'tempo' : 'wait', ...good }), '2026-01-01').state;
    }
    expect(seen).toEqual([
      'listen:RL:85',
      'wait:R:0',
      'wait:L:0',
      'wait:RL:0',
      'wait:RL:0',
      'tempo:RL:60',
      'tempo:RL:60',
      'tempo:RL:80',
      'tempo:RL:80',
    ]);
    // Phrase one is secure, so the coach moves to phrase two.
    const task = nextTask(info, state)!;
    expect(task.scope).toEqual({ type: 'section', index: 1 });
    expect(task.mode).toBe('listen');
  });

  it('does not ask for a clean pass twice, except at full tempo', () => {
    let state = begun();
    const seen: string[] = [];
    let said = '';
    for (let i = 0; i < 12; i++) {
      const task = nextTask(info, state)!;
      if (task.scope.type !== 'section' || task.scope.index !== 0) break;
      seen.push(`${task.mode}:${task.hands.join('')}:${task.tempoPct}`);
      const out = applyResult(info, state, task, task.mode === 'listen' ? null : result({ mode: task.mode === 'tempo' ? 'tempo' : 'wait' }));
      if (task.mode === 'wait' && task.hands.length === 2) said = out.verdict.message;
      state = out.state;
    }
    expect(seen).toEqual(['listen:RL:85', 'wait:R:0', 'wait:L:0', 'wait:RL:0', 'tempo:RL:60', 'tempo:RL:80']);
    expect(said).toMatch(/once is enough|no need to repeat/);

    // The whole piece: 70 and 85 once each when clean, full tempo twice whatever happens.
    state.sections.forEach((s) => (s.rung = 6));
    state.joined = 1;
    const tempi: number[] = [];
    for (let i = 0; i < 8 && !state.learned; i++) {
      const task = nextTask(info, state)!;
      tempi.push(task.tempoPct);
      state = applyResult(info, state, task, result({ mode: 'tempo' })).state;
    }
    expect(tempi).toEqual([70, 85, 100, 100]);
  });

  it('counts a pass as clean only when it is right, fluent and on the beat', () => {
    const wait = nextTask(info, { ...begun(), sections: [{ rung: 3, streak: 0, fails: 0 }, { rung: 0, streak: 0, fails: 0 }] })!;
    expect(cleanPass(wait, result())).toBe(true);
    expect(cleanPass(wait, result({ fluency: 0.7 }))).toBe(false);
    expect(cleanPass(wait, result({ clean: false }))).toBe(false);
    const tempo = nextTask(info, { ...begun(), sections: [{ rung: 4, streak: 0, fails: 0 }, { rung: 0, streak: 0, fails: 0 }] })!;
    expect(cleanPass(tempo, result({ mode: 'tempo', onTime: 0.9 }))).toBe(true);
    expect(cleanPass(tempo, result({ mode: 'tempo', onTime: 0.7 }))).toBe(false);
  });

  it('takes a trouble spot out after two poor tries, then puts it back', () => {
    let state = begun();
    state.sections[0].rung = 3;
    const bad = result({ accuracy: 0.6, wrongNotes: 5, clean: false, perMeasure: [
      { measure: 0, notes: 4, errors: 0, hesitations: 0 },
      { measure: 2, notes: 4, errors: 4, hesitations: 1 },
    ] });
    let task = nextTask(info, state)!;
    state = applyResult(info, state, task, bad).state;
    expect(state.focus).toBeNull();
    task = nextTask(info, state)!;
    const out = applyResult(info, state, task, bad);
    state = out.state;
    expect(state.focus).toEqual({ from: 2, to: 2, left: 2, hands: ['R', 'L'] });
    expect(out.verdict.message).toMatch(/Measure 3/);
    task = nextTask(info, state)!;
    expect(task.scope.type).toBe('focus');
    expect([task.from, task.to]).toEqual([2, 2]);
    state = applyResult(info, state, task, result()).state;
    state = applyResult(info, state, nextTask(info, state)!, result()).state;
    expect(state.focus).toBeNull();
    expect(nextTask(info, state)!.scope).toEqual({ type: 'section', index: 0 });
  });

  it('steps the tempo down after two poor tries with the beat', () => {
    let state = begun();
    state.sections[0].rung = 5;
    const bad = result({ mode: 'tempo', accuracy: 0.6, onTime: 0.4, clean: false });
    state = applyResult(info, state, nextTask(info, state)!, bad).state;
    expect(state.sections[0].rung).toBe(5);
    state = applyResult(info, state, nextTask(info, state)!, bad).state;
    expect(state.sections[0].rung).toBe(4);
    expect(nextTask(info, state)!.tempoPct).toBe(60);
  });

  it('joins phrases, then climbs with the whole piece until it is learned', () => {
    let state = begun();
    state.sections.forEach((s) => (s.rung = 6));
    let task = nextTask(info, state)!;
    expect(task.scope).toEqual({ type: 'join', upTo: 1 });
    expect([task.from, task.to]).toEqual([0, 7]);
    state = applyResult(info, state, task, result({ mode: 'tempo' })).state;
    const tempi: number[] = [];
    let learned = false;
    for (let i = 0; i < 10 && !learned; i++) {
      task = nextTask(info, state)!;
      expect(task.scope.type).toBe('whole');
      tempi.push(task.tempoPct);
      const out = applyResult(info, state, task, result({ mode: 'tempo', ...good }), '2026-01-03');
      state = out.state;
      learned = out.verdict.learned;
    }
    expect(tempi).toEqual([70, 70, 85, 85, 100, 100]);
    expect(state.learned).toBe(true);
    expect(state.learnedOn).toBe('2026-01-03');
    expect(pieceProgress(info, state)).toBe(1);
    // A learned piece comes back as a single play through.
    expect(nextTask(info, state)!.need).toBe(1);
  });

  it('does not go round in circles when the whole piece keeps failing at one tempo', () => {
    let state = begun();
    state.sections.forEach((s) => (s.rung = 6));
    state.joined = 1;
    state.wholeRung = 1;
    // Measure 5 goes wrong every time with the beat, though it comes out right when taken slowly.
    const stats = measures({ 4: { errors: 4 } });
    const detail = timed(new Array(32).fill(0)).map((d) => (d.measure === 4 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
    const miss = result({ mode: 'tempo', accuracy: 0.8, onTime: 1, clean: false, missedNotes: 4, perMeasure: stats, detail });
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const task = nextTask(info, state)!;
      seen.push(task.scope.type === 'whole' ? `whole:${task.tempoPct}` : task.scope.type === 'focus' ? 'focus' : `${task.scope.type}:${task.tempoPct}`);
      const out = applyResult(info, state, task, task.mode === 'wait' ? result() : miss);
      state = out.state;
      if (seen.length >= 3 && seen[seen.length - 1].startsWith('section')) break;
    }
    // Taken out and fixed once at 85, then a step down to 70, fixed once there, then the phrase goes back to its slow beat.
    expect(seen).toEqual(['whole:85', 'focus', 'focus', 'whole:85', 'whole:70', 'focus', 'focus', 'whole:70', 'section:60']);
    expect(nextTask(info, state)!.scope).toEqual({ type: 'section', index: 1 });
  });

  it('names a hand that dropped out of the whole piece, and takes no measure out for it', () => {
    let state = begun();
    state.sections.forEach((s) => (s.rung = 6));
    state.joined = 1;
    const right = timed(new Array(16).fill(0));
    const left = timed([0, 0, 0, 0, 0, 0, 0, 0], { hand: 'L', step: 2, dur: 2 }).map((d) => ({ ...d, state: 'missed' as const, errMs: undefined }));
    const stats = measures({ 7: { errors: 2 } });
    const out = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', hands: ['R', 'L'], accuracy: 0.67, clean: false, detail: [...right, ...left], perMeasure: stats }));
    // The hand was not there at all, which is said as it is.
    expect(out.verdict.message).toBe('The left hand hardly played. Again, and keep that hand going from start to finish.');
    expect(out.state.focus).toBeNull();
  });

  it('says where a trouble spot goes back to once it is fixed', () => {
    const fix = (state: PieceState) => {
      state.focus = { from: 4, to: 5, left: 1, hands: ['R'] };
      return applyResult(info, state, nextTask(info, state)!, result()).verdict.message;
    };
    // Out of a phrase that is still being learned.
    expect(fix(begun())).toBe('That spot is fixed. Back to the phrase.');
    // Out of the whole piece, once every phrase is secure and joined.
    const whole = begun();
    whole.sections.forEach((s) => (s.rung = 6));
    whole.joined = 1;
    expect(fix(whole)).toBe('That spot is fixed. Back to the whole piece.');
  });

  it('asks for more than most of the notes before it calls a piece learned', () => {
    let state = begun();
    state.sections.forEach((s) => (s.rung = 6));
    state.joined = 1;
    state.wholeRung = 2;
    const task = nextTask(info, state)!;
    expect(task.tempoPct).toBe(100);
    // Three notes in twenty four missed, twice over: good enough to move on lower down, not good enough to be done.
    const nearly = result({ mode: 'tempo', accuracy: 0.88, onTime: 1, clean: false, missedNotes: 3 });
    for (let i = 0; i < 3; i++) {
      const out = applyResult(info, state, nextTask(info, state)!, nearly);
      expect(out.verdict.passed).toBe(false);
      expect(out.verdict.learned).toBe(false);
      state = { ...out.state, focus: null, wholeRung: 2, wholeFails: 0 };
    }
    const well = result({ mode: 'tempo', accuracy: 0.96, onTime: 0.9, clean: false });
    state = applyResult(info, state, nextTask(info, state)!, well).state;
    const done = applyResult(info, state, nextTask(info, state)!, well, '2026-02-01');
    expect(done.verdict.learned).toBe(true);
    // The same 88 percent is a pass on the way up.
    const lower = { ...begun(), sections: [{ rung: 4, streak: 0, fails: 0 }, { rung: 0, streak: 0, fails: 0 }] };
    expect(applyResult(info, lower, nextTask(info, lower)!, nearly).verdict.passed).toBe(true);
  });

  it('keeps the day a piece was first learned when it goes rusty and comes back', () => {
    let state: PieceState = { ...begun(), learned: true, learnedOn: '2026-01-05', wholeRung: 3, joined: 1 };
    state.sections.forEach((s) => (s.rung = 6));
    state = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', accuracy: 0.6, clean: false }), '2026-03-01').state;
    expect(state.wholeRung).toBe(2);
    // The plan shows the step it is being won back at, not a row of ticks.
    const row = planOutline(info, state).find((r) => r.title === 'The whole piece')!;
    expect(row.steps.map((x) => x.state)).toEqual(['done', 'done', 'now']);
    // One good pass brings it back. It was learned already, so it is not announced as learned again.
    const task = nextTask(info, state)!;
    expect(task.need).toBe(1);
    const out = applyResult(info, state, task, result({ mode: 'tempo', accuracy: 0.97, onTime: 0.9, clean: false }), '2026-03-01');
    expect(out.verdict.passed).toBe(true);
    expect(out.verdict.learned).toBe(false);
    expect(out.verdict.message).toBe('Back in your fingers.');
    expect(out.state.wholeRung).toBe(3);
    expect(out.state.learnedOn).toBe('2026-01-05');
    expect(nextTask(info, out.state)!.title).toBe('Play it through');
  });

  it('calls pauses pauses, and uneven timing uneven', () => {
    let state = begun();
    state.sections[0].rung = 3;
    // No wrong key at all, but four of the sixteen notes had to be shown, three of them in one measure.
    const shown = [4, 5, 6, 12];
    const detail = timed(new Array(16).fill(0)).map((d, i) => ({ ...d, errMs: undefined, state: shown.includes(i) ? ('off' as const) : ('ok' as const) }));
    const paused = applyResult(info, state, nextTask(info, state)!, result({ accuracy: 1, hintedSteps: 4, pausedSteps: 4, clean: false, detail }));
    expect(paused.verdict.passed).toBe(false);
    expect(paused.verdict.message).toMatch(/pauses were in measure 2/);
    expect(paused.verdict.message).not.toMatch(/slips/);
    state = begun();
    state.sections[0].rung = 4;
    // Early and late in turn: the average is on the beat, the playing is not.
    const uneven = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', accuracy: 1, onTime: 0, biasMs: 1, meanAbsMs: 190, clean: false }));
    expect(uneven.verdict.message).toMatch(/some came early and some late/);
  });

  it('does not fail a run for a pause or two to think', () => {
    const state = begun();
    state.sections[0].rung = 3;
    const task = nextTask(info, state)!;
    // Sixteen steps, every key right, and twice the learner stopped until the key was shown.
    const two = result({ accuracy: 1, hintedSteps: 2, pausedSteps: 2, clean: false });
    expect(passes(task, two)).toBe(true);
    // It counts, but it is not the spotless pass that would skip the second one.
    const out = applyResult(info, state, task, two);
    expect(out.verdict.passed).toBe(true);
    expect(out.state.sections[0]).toMatchObject({ rung: 3, streak: 1 });
    // Waiting for a good share of the keys is another matter.
    expect(passes(task, result({ accuracy: 1, hintedSteps: 5, pausedSteps: 5, clean: false }))).toBe(false);
    // And wrong keys still count as they did.
    expect(passes(task, result({ accuracy: 0.8, wrongNotes: 4, clean: false }))).toBe(false);
  });

  it('says what it heard on a pass too, and does not call such a pass clean', () => {
    let state = begun();
    state.sections.forEach((s) => (s.rung = 6));
    state.joined = 1;
    // Right notes, and every note after a long one comes in well early.
    const detail = [
      ...timed([0, 10, -10, 0]),
      ...timed([5, -220, -200, -210, -230], { step: 2, dur: 2 }).map((d, i) => ({ ...d, id: `h${i}`, start: 4 + i * 2 })),
    ];
    const out = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', accuracy: 1, onTime: 0.85, clean: true, detail }));
    expect(out.verdict.passed).toBe(true);
    expect(out.verdict.aside).toMatch(/early after the long notes/);
    // Something was left to put right, so the pass counts once and is asked for again.
    expect(out.verdict.message).not.toMatch(/Clean/);
    expect(out.state.wholeStreak).toBe(1);
    // A pass with the misses in one place says where.
    state = out.state;
    const missed = timed(new Array(32).fill(0)).map((d, i) => (i === 20 || i === 21 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
    const second = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', accuracy: 0.94, onTime: 1, clean: false, missedNotes: 2, detail: missed }));
    expect(second.verdict.passed).toBe(true);
    expect(second.verdict.aside).toBe('Most of the slips were in measure 6.');
  });

  it('does not pin slips on one measure when they were spread through the piece', () => {
    const state = begun();
    state.sections.forEach((s) => (s.rung = 6));
    state.joined = 1;
    state.wholeRung = 2;
    // Every third note left out.
    const detail = timed(new Array(32).fill(0)).map((d, i) => (i % 3 === 1 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
    const stats = measures(Object.fromEntries(Array.from({ length: 8 }, (_, m) => [m, { errors: 1 }])));
    const out = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', accuracy: 0.66, onTime: 1, clean: false, missedNotes: 11, detail, perMeasure: stats }));
    expect(out.verdict.passed).toBe(false);
    expect(out.verdict.message).not.toMatch(/Most/);
    expect(out.verdict.message).toMatch(/spread through the piece/);
    expect(out.state.focus).toBeNull();
    // A second run like it, and the tempo eases.
    const again = applyResult(info, out.state, nextTask(info, out.state)!, result({ mode: 'tempo', accuracy: 0.66, onTime: 1, clean: false, missedNotes: 11, detail, perMeasure: stats }));
    expect(again.state.wholeRung).toBe(1);
  });

  it('says how many notes were missing when they were missing here and there', () => {
    const state = begun();
    state.sections[0].rung = 4;
    // Every fourth note left out, in both hands, so no one place and no one hand stands out.
    const right = timed(new Array(16).fill(0)).map((d, i) => (i % 4 === 3 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
    const left = timed(new Array(8).fill(0), { hand: 'L', step: 2, dur: 2 }).map((d, i) => (i % 4 === 3 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
    const out = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', hands: ['R', 'L'], accuracy: 0.75, onTime: 1, clean: false, missedNotes: 6, detail: [...right, ...left] }));
    expect(out.verdict.passed).toBe(false);
    expect(out.verdict.message).toBe('6 notes were left out, here and there. Try again, and keep the pulse going through any slip.');
  });

  it('does not claim a first try after a stumble', () => {
    const state = begun();
    state.sections[0] = { rung: 3, streak: 0, fails: 1 };
    const out = applyResult(info, state, nextTask(info, state)!, result());
    expect(out.verdict.message).toMatch(/^Clean this time/);
    expect(out.verdict.message).not.toMatch(/first time/);
  });

  it('leaves out the single hand steps in a phrase where one hand only rests', () => {
    // The right hand does not come in until the second phrase.
    const piece: PieceInfo = { ...info, sectionHands: [['L'], ['R', 'L']] };
    let state = begun(piece);
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const task = nextTask(piece, state)!;
      if (task.scope.type !== 'section' || task.scope.index !== 0) break;
      seen.push(`${task.mode}:${task.hands.join('')}:${task.tempoPct}`);
      state = applyResult(piece, state, task, task.mode === 'listen' ? null : result({ mode: task.mode === 'tempo' ? 'tempo' : 'wait', ...good }), '2026-01-01').state;
    }
    // No step asks the right hand to play rests, and the left hand is not asked for the same thing twice over.
    expect(seen).toEqual(['listen:L:85', 'wait:L:0', 'wait:L:0', 'tempo:L:60', 'tempo:L:60', 'tempo:L:80', 'tempo:L:80']);
    // The second phrase has both hands, and so the whole ladder.
    expect(nextTask(piece, state)!.scope).toEqual({ type: 'section', index: 1 });
    const rows = planOutline(piece, begun(piece));
    expect(rows[0].steps.map((x) => x.label)).toEqual(['Listen', 'The notes', 'Slow beat', 'Faster']);
    expect(rows[1].steps.map((x) => x.label)).toEqual(['Listen', 'Right hand', 'Left hand', 'Together', 'Slow beat', 'Faster']);
  });

  it('blames the hand that pressed the wrong keys when there is no beat', () => {
    const state = begun();
    state.sections[0].rung = 3;
    // A wrong right hand key on each first beat. Every note of those steps is marked, the left hand's too.
    const right = timed(new Array(16).fill(0)).map((d, i) => ({ ...d, errMs: undefined, state: i % 4 === 0 ? ('off' as const) : ('ok' as const) }));
    const left = timed([0, 0, 0, 0], { hand: 'L', step: 4, dur: 4 }).map((d) => ({ ...d, errMs: undefined, state: 'off' as const }));
    const wrong = [0, 1, 2, 3].map((m) => ({ measure: m, midi: 65, expected: [64, 48], hand: 'R' as const }));
    const out = applyResult(info, state, nextTask(info, state)!, result({ hands: ['R', 'L'], accuracy: 0.75, wrongNotes: 4, clean: false, detail: [...right, ...left], wrong }));
    expect(out.verdict.message).toMatch(/right hand that slipped/);
    expect(out.verdict.message).not.toMatch(/left hand/);
  });

  it('tells late notes from wrong notes', () => {
    let state = begun();
    state.sections[0].rung = 4;
    // Late, but unevenly so: that is the playing.
    const late = result({ mode: 'tempo', accuracy: 0.95, onTime: 0.3, biasMs: 70, meanAbsMs: 150, clean: false });
    const out = applyResult(info, state, nextTask(info, state)!, late);
    expect(out.verdict.passed).toBe(false);
    expect(out.verdict.message).toMatch(/behind the beat/);
  });

  it('does not slow the music down when every note is late by the same amount', () => {
    let state = begun();
    state.sections[0].rung = 4;
    // 260 ms late on every note: a delay in the connection, not a tempo that is too quick.
    const lagging = result({ mode: 'tempo', accuracy: 1, onTime: 0, biasMs: 260, meanAbsMs: 262, clean: false });
    for (let i = 0; i < 3; i++) {
      const out = applyResult(info, state, nextTask(info, state)!, lagging);
      expect(out.verdict.passed).toBe(false);
      expect(out.verdict.message).toMatch(/timing check/);
      state = out.state;
    }
    expect(state.sections[0].rung).toBe(4);
  });

  it('gives a pass judged by ear a little more room', () => {
    const state = begun();
    state.sections[0].rung = 4;
    const task = nextTask(info, state)!;
    expect(task.mode).toBe('tempo');
    // One note misheard in a short phrase: 7 of 8 matched and one stray.
    const slip = { mode: 'tempo' as const, accuracy: 0.8125, onTime: 0.9, clean: false };
    expect(applyResult(info, state, task, result(slip)).verdict.passed).toBe(false);
    expect(applyResult(info, state, task, result({ ...slip, byEar: true })).verdict.passed).toBe(false);
    const oneOff = { mode: 'tempo' as const, accuracy: 0.84, onTime: 0.9, clean: false };
    expect(applyResult(info, state, task, result(oneOff)).verdict.passed).toBe(false);
    expect(applyResult(info, state, task, result({ ...oneOff, byEar: true })).verdict.passed).toBe(true);
  });

  it('uses a shorter ladder for one hand', () => {
    const solo: PieceInfo = { id: 's', title: 'S', hands: ['R'], sections: [[0, 3]], measures: 4 };
    let state = begun(solo);
    const modes: string[] = [];
    for (let i = 0; i < 9; i++) {
      const task = nextTask(solo, state)!;
      if (task.scope.type !== 'section') break;
      modes.push(task.mode);
      state = applyResult(solo, state, task, task.mode === 'listen' ? null : result({ mode: task.mode === 'tempo' ? 'tempo' : 'wait', ...good })).state;
    }
    expect(modes).toEqual(['listen', 'wait', 'wait', 'tempo', 'tempo', 'tempo', 'tempo']);
  });

  describe('the first play through', () => {
    it('comes first for a new piece, and ends early if the learner is stuck', () => {
      const state = newPieceState(info, '2026-01-01');
      expect(trialPending(state)).toBe(true);
      const task = nextTask(info, state)!;
      expect(task.scope).toEqual({ type: 'trial' });
      expect([task.mode, task.from, task.to]).toEqual(['wait', 0, 7]);
      expect(task.hands).toEqual(['R', 'L']);
      expect(task.stopAfter).toEqual({ hints: 2, wrong: 4 });
    });

    it('skips the notes of a piece that is already known', () => {
      const state = newPieceState(info, '2026-01-01');
      const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: measures(), pace: 0.8 }));
      expect(out.verdict.passed).toBe(true);
      expect(out.verdict.message).toMatch(/know the notes already/);
      expect(trialPending(out.state)).toBe(false);
      const next = nextTask(info, out.state)!;
      expect(next.scope).toEqual({ type: 'whole' });
      expect(next.tempoPct).toBe(70);
      expect(pieceProgress(info, out.state)).toBeCloseTo(0.7, 5);
    });

    it('gives slow but right playing a slow beat before the whole piece', () => {
      const state = newPieceState(info, '2026-01-01');
      const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: measures(), pace: 0.3 }));
      const next = nextTask(info, out.state)!;
      expect(next.scope).toEqual({ type: 'section', index: 0 });
      expect([next.mode, next.tempoPct]).toEqual(['tempo', 60]);
    });

    it('works only on the phrase that is not known', () => {
      const state = newPieceState(info, '2026-01-01');
      // Phrase one is right. In phrase two the key had to be shown, and the run stopped there.
      const stats = measures({ 4: { hints: 1, played: 4 }, 5: { hints: 1, played: 1 } }, 5);
      const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: stats, cutShort: true, clean: false, accuracy: 0.6, hintedSteps: 2, pace: 0.7 }));
      expect(out.verdict.message).toMatch(/Phrase 1 is in your fingers/);
      expect(out.state.sections.map((s) => s.rung)).toEqual([6, 0]);
      const next = nextTask(info, out.state)!;
      expect(next.scope).toEqual({ type: 'section', index: 1 });
      expect(next.mode).toBe('listen');
      // Once phrase two is secure, the two are joined.
      const later = { ...out.state, sections: [out.state.sections[0], { rung: 6, streak: 0, fails: 0 }] };
      expect(nextTask(info, later)!.scope).toEqual({ type: 'join', upTo: 1 });
    });

    it('lets a slip or two skip the single hand steps but not the notes', () => {
      const state = newPieceState(info, '2026-01-01');
      const stats = measures({ 1: { errors: 1 }, 6: { errors: 2 } });
      const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: stats, clean: false, accuracy: 0.9, wrongNotes: 3, pace: 0.7 }));
      expect(out.state.sections.map((s) => s.rung)).toEqual([3, 3]);
      const next = nextTask(info, out.state)!;
      expect([next.mode, next.hands.join('')]).toEqual(['wait', 'RL']);
    });

    it('forgives a hand that started a key out of place', () => {
      const state = newPieceState(info, '2026-01-01');
      // Two wrong keys on the first note, the key is shown, and from there it is right.
      const stats = measures({ 0: { errors: 2, hints: 1 } });
      const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: stats, clean: false, accuracy: 0.97, wrongNotes: 2, hintedSteps: 1, pace: 0.7 }));
      expect(out.state.sections.map((s) => s.rung)).toEqual([3, 6]);
      expect(out.verdict.message).toMatch(/Phrase 2 is in your fingers/);
    });

    it('starts a piece that is new from its beginning, without calling it a failure', () => {
      const state = newPieceState(info, '2026-01-01');
      const stats = measures({ 0: { hints: 2, played: 2 } }, 0);
      const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: stats, cutShort: true, clean: false, accuracy: 0.05, hintedSteps: 2, pace: null }));
      expect(out.verdict.plain).toBe(true);
      expect(out.verdict.message).toMatch(/new to you/);
      const next = nextTask(info, out.state)!;
      expect(next.scope).toEqual({ type: 'section', index: 0 });
      expect(next.mode).toBe('listen');
    });

    it('says so when the piece was played in another octave, and counts it as known', () => {
      const state = newPieceState(info, '2026-01-01');
      const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: measures(), pace: 0.9, octaveShift: 12 }));
      expect(out.verdict.passed).toBe(true);
      expect(out.verdict.aside).toBe('You played it an octave higher than it is written. The keys on the screen show where it sits.');
      expect(out.state.sections.every((s) => s.rung === 6)).toBe(true);
    });

    it('knows a learner who played one hand of a two hand piece from one who is lost', () => {
      const state = newPieceState(info, '2026-01-01');
      // The tune was played. The left hand's first note never came, so the music could not move on.
      const right = timed(new Array(16).fill(0)).map((d, i) => ({ ...d, midi: 64 + (i % 3), errMs: undefined, state: i === 0 ? ('ok' as const) : ('missed' as const) }));
      const left = timed([0, 0, 0, 0], { hand: 'L', step: 4, dur: 4 }).map((d) => ({ ...d, midi: 48, errMs: undefined, state: 'missed' as const }));
      const take = { bpm: 0, lead: 0, notes: [[64, 0, 0.3, 0.7], [65, 0.5, 0.3, 0.7], [66, 1, 0.3, 0.7], [65, 1.5, 0.3, 0.7]] as Array<[number, number, number, number]>, pedal: [], seconds: 2 };
      const out = applyResult(
        info,
        state,
        nextTask(info, state)!,
        result({ hands: ['R', 'L'], accuracy: 0, wrongNotes: 3, clean: false, cutShort: true, perMeasure: measures({ 0: { errors: 3, played: 1 } }, 0), detail: [...right, ...left], take }),
      );
      expect(out.verdict.plain).toBe(true);
      expect(out.verdict.message).toMatch(/^That is the right hand's part\. The left hand has notes too/);
      expect(out.state.sections.every((s) => s.rung === 0)).toBe(true);
    });

    it('can be skipped, and is not asked of a piece already under way', () => {
      const fresh = newPieceState(info, '2026-01-01');
      expect(nextTask(info, skipTrial(fresh))!.mode).toBe('listen');
      // A piece begun before the first play through existed has no record of one.
      const old: PieceState = { ...fresh, trial: undefined };
      expect(trialPending(old)).toBe(true);
      expect(trialPending({ ...old, sections: [{ rung: 2, streak: 0, fails: 0 }, { rung: 0, streak: 0, fails: 0 }] })).toBe(false);
      expect(trialPending({ ...old, learned: true })).toBe(false);
    });
  });

  describe('saying what went wrong', () => {
    it('names the measure where the slips were', () => {
      const detail = timed([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).map((d, i) => (i >= 8 && i <= 10 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
      expect(diagnose(result({ mode: 'tempo', accuracy: 0.75, detail }))).toMatch(/measure 3/);
    });

    it('names the hand that slipped', () => {
      const right = timed([0, 0, 0, 0, 0, 0, 0, 0]);
      const left = timed([0, 0, 0, 0, 0, 0, 0, 0], { hand: 'L' }).map((d, i) => (i % 2 === 0 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
      expect(diagnose(result({ mode: 'tempo', hands: ['R', 'L'], accuracy: 0.75, detail: [...right, ...left] }))).toMatch(/left hand/);
    });

    /** Quarter notes on the beat, then half notes, each followed by a note that arrives well before its beat. */
    const cutShort = () => [
      ...timed([0, 10, -10, 0]),
      ...timed([5, -140, -120, -150, -130], { step: 2, dur: 2 }).map((d, i) => ({ ...d, id: `h${i}`, start: 4 + i * 2 })),
    ];

    it('does not blame a hand only because it has more of the notes', () => {
      // The tune has sixteen notes and the bass four. A quarter of each went wrong.
      const right = timed(new Array(16).fill(0)).map((d, i) => (i % 4 === 1 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
      const left = timed([0, 0, 0, 0], { hand: 'L', step: 4, dur: 4 }).map((d, i) => (i === 2 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
      const said = diagnose(result({ mode: 'tempo', hands: ['R', 'L'], accuracy: 0.75, detail: [...right, ...left] }));
      expect(said ?? '').not.toMatch(/hand/);
    });

    it('spots coming in early after long notes', () => {
      expect(diagnose(result({ mode: 'tempo', accuracy: 1, onTime: 0.5, detail: cutShort() }))).toMatch(/early after the long notes/);
      // When every note is early by the same amount there is nothing to tell the long notes by.
      const all = timed([-140, -140, -120, -150, -130, -160], { step: 2, dur: 2 });
      expect(diagnose(result({ mode: 'tempo', accuracy: 1, onTime: 0, detail: all }))).toBeNull();
    });

    it('names the measure and the hand together when both are clear', () => {
      const right = timed([0, 0, 0, 0, 0, 0, 0, 0]);
      const left = timed([0, 0, 0, 0, 0, 0, 0, 0], { hand: 'L' }).map((d, i) => (i >= 4 && i <= 6 ? { ...d, state: 'missed' as const, errMs: undefined } : d));
      expect(diagnose(result({ mode: 'tempo', hands: ['R', 'L'], accuracy: 0.8, detail: [...right, ...left] }))).toBe('Most of the slips were in the left hand, in measure 2.');
    });

    it('spots quick notes running ahead of the beat', () => {
      const quarters = timed([0, 10, -10, 0]);
      const eighths = timed([-70, -80, -60, -90, -75, -85], { step: 0.5 }).map((d, i) => ({ ...d, id: `e${i}`, start: 4 + i * 0.5 }));
      expect(diagnose(result({ mode: 'tempo', accuracy: 1, onTime: 0.4, detail: [...quarters, ...eighths] }))).toMatch(/quick notes ran ahead/);
    });

    it('spots speeding up from start to finish', () => {
      const detail = timed([0, -15, -30, -50, -70, -85, -100, -120, -140, -160, -175, -190]);
      expect(diagnose(result({ mode: 'tempo', accuracy: 1, onTime: 0.4, detail }))).toMatch(/sped up/);
    });

    it('says nothing when there is no clear pattern', () => {
      const detail = timed([120, -130, 20, -110, 140, 0, -125, 115]);
      expect(diagnose(result({ mode: 'tempo', accuracy: 1, onTime: 0.25, detail }))).toBeNull();
      expect(diagnose(result({ detail: [] }))).toBeNull();
    });

    it('mentions long notes let go early, even after a pass', () => {
      const state = begun();
      state.sections[0].rung = 4;
      const out = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', ...good, held: 0.2 }));
      expect(out.verdict.passed).toBe(true);
      expect(out.verdict.message).toMatch(/One more like that/);
      expect(out.verdict.aside).toMatch(/let go early/);
    });

    it('uses what it found in the coach\'s reply', () => {
      const state = begun();
      state.sections[0].rung = 4;
      const out = applyResult(info, state, nextTask(info, state)!, result({ mode: 'tempo', accuracy: 1, onTime: 0.5, biasMs: -60, meanAbsMs: 65, clean: false, detail: cutShort() }));
      expect(out.verdict.passed).toBe(false);
      expect(out.verdict.message).toMatch(/The notes were right\. You came in early after the long notes/);
    });
  });

  it('lays out the whole route to a learned piece', () => {
    const fresh = newPieceState(info, '2026-01-01');
    expect(planOutline(info, fresh)[0]).toEqual({ title: 'To begin', steps: [{ label: 'Play it through', state: 'now' }] });
    const state = begun();
    state.sections[0].rung = 2;
    const rows = planOutline(info, state);
    expect(rows.map((r) => r.title)).toEqual(['Phrase 1', 'Phrase 2', 'Join the phrases', 'The whole piece']);
    expect(rows[0].detail).toBe('Measures 1 to 4');
    expect(rows[0].steps.map((s) => `${s.label}:${s.state}`)).toEqual([
      'Listen:done',
      'Right hand:done',
      'Left hand:now',
      'Together:todo',
      'Slow beat:todo',
      'Faster:todo',
    ]);
    expect(rows[3].steps.map((s) => s.label)).toEqual(['70 percent', '85 percent', 'Full tempo']);
    const solo: PieceInfo = { id: 's', title: 'S', hands: ['R'], sections: [[0, 3]], measures: 4 };
    expect(planOutline(solo, begun(solo)).map((r) => r.title)).toEqual(['The notes and the beat', 'The whole piece']);
  });

  it('splits a piece into phrases of four measures', () => {
    expect(defaultSections(8, false)).toEqual([[0, 3], [4, 7]]);
    expect(defaultSections(9, true)).toEqual([[0, 4], [5, 8]]);
    expect(defaultSections(4, false)).toEqual([[0, 3]]);
    expect(defaultSections(10, false)).toEqual([[0, 3], [4, 7], [8, 9]]);
    expect(defaultSections(9, false)).toEqual([[0, 3], [4, 8]]);
    expect(defaultSections(16, false)).toHaveLength(4);
  });
});

describe('spaced review', () => {
  it('spaces a card further apart each time it is remembered', () => {
    const t0 = new Date('2026-01-01T10:00:00Z');
    let card = newCard(t0);
    expect(isDue(card, t0)).toBe(true);
    card = review(card, 'good', t0);
    const gap1 = new Date(card.due).getTime() - t0.getTime();
    const t1 = new Date(card.due);
    card = review(card, 'good', t1);
    const gap2 = new Date(card.due).getTime() - t1.getTime();
    const t2 = new Date(card.due);
    card = review(card, 'good', t2);
    const gap3 = new Date(card.due).getTime() - t2.getTime();
    expect(gap2).toBeGreaterThan(gap1);
    expect(gap3).toBeGreaterThan(gap2);
    expect(isDue(card, t2)).toBe(false);
  });

  it('brings a forgotten card back soon', () => {
    const t0 = new Date('2026-01-01T10:00:00Z');
    let card = review(review(newCard(t0), 'good', t0), 'good', new Date('2026-01-02T10:00:00Z'));
    const before = new Date(card.due).getTime();
    card = review(card, 'again', new Date('2026-01-08T10:00:00Z'));
    expect(new Date(card.due).getTime()).toBeLessThan(new Date('2026-01-09T10:00:00Z').getTime());
    expect(before).toBeGreaterThan(0);
    expect(card.lapses).toBe(1);
  });

  it('never waits longer than two months', () => {
    let now = new Date('2026-01-01T10:00:00Z');
    let card = newCard(now);
    for (let i = 0; i < 12; i++) {
      card = review(card, 'easy', now);
      const gapDays = (new Date(card.due).getTime() - now.getTime()) / 86400000;
      expect(gapDays).toBeLessThanOrEqual(60.01);
      now = new Date(card.due);
    }
  });

  it('grades from measured results', () => {
    expect(outcomeFromAccuracy(0.5, false)).toBe('again');
    expect(outcomeFromAccuracy(0.8, false)).toBe('hard');
    expect(outcomeFromAccuracy(0.93, false)).toBe('good');
    expect(outcomeFromAccuracy(1, true)).toBe('easy');
    expect(outcomeFromAnswer(false, 1)).toBe('again');
    expect(outcomeFromAnswer(true, 1)).toBe('easy');
    expect(outcomeFromAnswer(true, 4)).toBe('good');
    expect(outcomeFromAnswer(true, 9)).toBe('hard');
  });
});

describe('the path so far', () => {
  it('lists the firsts, finished stages and learned pieces, newest first', () => {
    const order = lessonOrder();
    const lessons: Record<string, { done: boolean; doneOn?: string; skipped?: boolean; step: number }> = {};
    order.slice(0, 6).forEach((id, i) => (lessons[id] = { done: true, doneOn: `2026-03-0${i + 1}`, step: 0 }));
    const pieces = { 'hot-cross-buns': { ...newPieceState(pieceInfo('hot-cross-buns'), '2026-03-02'), learned: true, learnedOn: '2026-03-04' } };
    const path = milestones('2026-03-01', lessons, pieces);
    expect(path.map((m) => `${m.on} ${m.title}`)).toEqual([
      '2026-03-06 Finished stage 1, First sounds',
      '2026-03-06 Played with both hands at once',
      '2026-03-04 Learned Hot Cross Buns',
      '2026-03-02 Played a first tune',
      '2026-03-01 Started with Middle C',
    ]);
  });

  it('does not count lessons that were marked as known', () => {
    const lessons = Object.fromEntries(lessonOrder().slice(0, 12).map((id) => [id, { done: true, skipped: true, step: 0 }]));
    expect(milestones('2026-03-01', lessons, {}).map((m) => m.kind)).toEqual(['start']);
  });
});

describe('streak', () => {
  it('counts days in a row, allowing today to be still to come', () => {
    const d = (seconds: number) => ({ seconds, notes: 0, activities: 0 });
    const days = { '2026-03-01': d(600), '2026-03-02': d(600), '2026-03-03': d(600), '2026-02-27': d(600) };
    expect(streak(days, '2026-03-03')).toBe(3);
    expect(streak(days, '2026-03-04')).toBe(3);
    expect(streak(days, '2026-03-05')).toBe(0);
    expect(streak({ '2026-03-01': d(20) }, '2026-03-01')).toBe(0);
  });
});

import {
  chordExercise,
  chordLevelCap,
  earExercise,
  evenness,
  rhythmExercise,
  sightExercise,
  techniqueExercise,
  techniqueLevelCap,
  CHORD_LEVELS,
  EAR_LEVELS,
  RHYTHM_LEVELS,
  SIGHT_LEVELS,
  TECH_LEVELS,
} from './generators';
import { currentPiece, introducedPieces, openDrills, pieceToEndOn, planDay, planSession, readsStaff, skippedPieces } from './planner';
import { startingLevel } from './placement';
import { parseScore, scoreRange } from '../music/score';
import { lessonOrder, pieceInfo } from '../content/catalog';

describe('generated exercises', () => {
  it('always produce music that parses, at every level', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (let level = 1; level <= RHYTHM_LEVELS; level++) {
        const m = rhythmExercise(level, seed);
        const s = parseScore(m);
        expect(s.measureCount, `rhythm level ${level} seed ${seed}`).toBe(4);
      }
      for (let level = 1; level <= EAR_LEVELS; level++) {
        for (const hand of ['R', 'L'] as const) {
          const s = parseScore(earExercise(level, seed, hand));
          expect(s.notes[0].midi % 12, 'ear patterns start on C').toBe(0);
          const r = scoreRange(s);
          expect(r.high - r.low).toBeLessThanOrEqual(7);
        }
      }
      for (let level = 1; level <= SIGHT_LEVELS; level++) {
        const m = sightExercise(level, seed);
        const s = parseScore(m);
        expect(s.measureCount, `sight level ${level} seed ${seed}`).toBe(4);
        const melody = s.notes.filter((n) => n.hand === (m.rh ? 'R' : 'L'));
        const r = { low: Math.min(...melody.map((n) => n.midi)), high: Math.max(...melody.map((n) => n.midi)) };
        expect(r.high - r.low, 'stays in one hand position').toBeLessThanOrEqual(7);
        expect(melody[0].finger).toBeDefined();
      }
    }
  });

  it('makes four chords of one key at every level, written from the note each is named after', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (let level = 1; level <= CHORD_LEVELS; level++) {
        const ex = chordExercise(level, seed);
        const s = parseScore(ex.music);
        expect(s.measureCount, `chords level ${level} seed ${seed}`).toBe(4);
        expect(s.chords).toHaveLength(4);
        expect(s.notes).toHaveLength(ex.style === 'block' ? 12 : 16);
        for (let m = 0; m < 4; m++) {
          const notes = s.notes.filter((n) => n.measure === m);
          // Three different notes, stacked in thirds: a triad in root position.
          const classes = Array.from(new Set(notes.map((n) => n.midi))).sort((a, b) => a - b);
          expect(classes).toHaveLength(3);
          expect([3, 4]).toContain(classes[1] - classes[0]);
          expect([3, 4]).toContain(classes[2] - classes[1]);
          if (ex.style === 'broken') expect(notes.map((n) => n.midi)).toEqual([classes[0], classes[1], classes[2], classes[1]]);
        }
        const symbols = s.chords.map((c) => c.symbol);
        // Only what the lessons have taught: the chords on steps one, four, five and six, in C and in G.
        if (ex.byNumber) for (const sym of symbols) expect(sym, `level ${level}`).toMatch(/^(I|IV|V|vi)$/);
        else for (const sym of symbols) expect(['C', 'F', 'G', 'Am', 'D', 'Em'], `level ${level}`).toContain(sym);
        expect(['C', 'G']).toContain(ex.key);
        // Numbers and the key of G wait for the lesson that explains them.
        if (level <= 4) {
          expect(ex.byNumber).toBe(false);
          expect(ex.key).toBe('C');
        }
      }
    }
    // The early levels stay in C, on its three main chords. Then A minor joins them.
    for (let seed = 1; seed <= 30; seed++) {
      const symbols = parseScore(chordExercise(1, seed).music).chords.map((c) => c.symbol);
      for (const sym of symbols) expect(['C', 'F', 'G']).toContain(sym);
      const withSix = parseScore(chordExercise(3, seed).music).chords.map((c) => c.symbol);
      for (const sym of withSix) expect(['C', 'F', 'G', 'Am']).toContain(sym);
      expect(withSix).toContain('Am');
    }
  });

  it('does not set the same four chords twice running', () => {
    for (let level = 1; level <= CHORD_LEVELS; level++) {
      let last: string | undefined;
      for (let seed = 1; seed <= 80; seed++) {
        const ex = chordExercise(level, seed, last);
        expect(ex.id, `level ${level} seed ${seed}`).not.toBe(last);
        last = ex.id;
      }
    }
  });

  it('writes scales and arpeggios that parse, with a finger on every note', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let level = 1; level <= TECH_LEVELS; level++) {
        const ex = techniqueExercise(level, seed);
        const s = parseScore(ex.music);
        expect(ex.name.length, `level ${level}`).toBeGreaterThan(10);
        for (const n of s.notes) expect(n.finger, `${ex.name} has a note without a finger`).toBeDefined();
        for (const step of s.steps) {
          const r = step.notes.filter((n) => n.hand === 'R').map((n) => n.midi);
          const l = step.notes.filter((n) => n.hand === 'L').map((n) => n.midi);
          if (r.length && l.length) expect(Math.min(...r)).toBeGreaterThan(Math.max(...l));
        }
        for (const n of s.notes) {
          expect(n.midi).toBeGreaterThanOrEqual(41);
          expect(n.midi).toBeLessThanOrEqual(84);
        }
      }
    }
  });

  it('gives the C major scale its standard fingering, up and down', () => {
    const right = parseScore(techniqueExercise(1, 3).music);
    expect(right.notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 72, 71, 69, 67, 65, 64, 62, 60]);
    expect(right.notes.map((n) => n.finger)).toEqual([1, 2, 3, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 3, 2, 1]);
    const left = parseScore(techniqueExercise(2, 3).music);
    expect(left.notes.map((n) => n.midi).slice(0, 8)).toEqual([48, 50, 52, 53, 55, 57, 59, 60]);
    expect(left.notes.map((n) => n.finger).slice(0, 8)).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
  });

  it('gives arpeggios the fingers 1 2 3 5 and 5 4 2 1, and passes one between the hands', () => {
    let sawRight = false;
    let sawLeft = false;
    for (let seed = 1; seed <= 30; seed++) {
      const ex = techniqueExercise(5, seed);
      const s = parseScore(ex.music);
      const up = s.notes.slice(0, 4);
      // Root, third, fifth and the root again an octave up.
      expect(up[3].midi - up[0].midi).toBe(12);
      expect(up[1].midi - up[0].midi).toBe(4);
      expect(up[2].midi - up[0].midi).toBe(7);
      if (s.hands[0] === 'R') {
        sawRight = true;
        expect(up.map((n) => n.finger)).toEqual([1, 2, 3, 5]);
      } else {
        sawLeft = true;
        expect(up.map((n) => n.finger)).toEqual([5, 4, 2, 1]);
      }
    }
    expect(sawRight && sawLeft).toBe(true);
    const sweep = parseScore(techniqueExercise(7, 2).music);
    expect(sweep.hands).toEqual(['R', 'L']);
    // Thirteen notes, each sounding alone: up through both hands and back down.
    expect(sweep.steps).toHaveLength(13);
    expect(sweep.steps.every((st) => st.notes.length === 1)).toBe(true);
    const line = sweep.steps.map((st) => st.notes[0].midi);
    expect(line.slice(0, 7)).toEqual(line.slice(0, 7).slice().sort((a, b) => a - b));
    expect(line.slice(6)).toEqual(line.slice(6).slice().sort((a, b) => b - a));
  });

  it('lets scales and arpeggios climb only as far as the lessons have gone, and measures evenness', () => {
    const upTo = (ids: string[]) => (id: string) => ids.includes(id);
    expect(techniqueLevelCap(upTo(['major-scale']))).toBe(2);
    expect(techniqueLevelCap(upTo(['major-scale', 'keys']))).toBe(4);
    // One hand arpeggios open with their lesson. The pass between the hands waits for the lesson after it.
    expect(techniqueLevelCap(upTo(['major-scale', 'keys', 'arpeggios']))).toBe(6);
    expect(techniqueLevelCap(upTo(['major-scale', 'keys', 'arpeggios', 'arpeggios-two-hands']))).toBe(TECH_LEVELS);
    expect(evenness([10, 10, 10, 10])).toBe(0);
    expect(evenness([-40, 40, -40, 40])).toBe(40);
    expect(evenness([5, 5])).toBeNull();
  });

  it('lets chords climb only as far as the lessons have gone', () => {
    const upTo = (ids: string[]) => (id: string) => ids.includes(id);
    expect(chordLevelCap(upTo(['triads']))).toBe(2);
    expect(chordLevelCap(upTo(['triads', 'minor-chords']))).toBe(4);
    // Other keys teach scales. Chords in another key, and chords by number, come with the lesson on progressions.
    expect(chordLevelCap(upTo(['triads', 'minor-chords', 'keys']))).toBe(4);
    expect(chordLevelCap(upTo(['triads', 'minor-chords', 'keys', 'progressions']))).toBe(CHORD_LEVELS);
  });

  it('is repeatable for a seed and varies between seeds', () => {
    expect(sightExercise(2, 5)).toEqual(sightExercise(2, 5));
    const distinct = new Set(Array.from({ length: 20 }, (_, i) => sightExercise(2, i + 1).rh));
    expect(distinct.size).toBeGreaterThan(12);
  });

  it('gets harder with level', () => {
    const easy = Array.from({ length: 30 }, (_, i) => rhythmExercise(1, i + 1).rh!).join(' ');
    const hard = Array.from({ length: 30 }, (_, i) => rhythmExercise(5, i + 1).rh!).join(' ');
    expect(/B4e/.test(easy)).toBe(false);
    expect(/B4e/.test(hard)).toBe(true);
  });
});

describe('daily plan', () => {
  const order = lessonOrder();
  const doneUpTo = (n: number) => Object.fromEntries(order.slice(0, n).map((id) => [id, { done: true, step: 0 }]));

  it('gives a brand new learner the first two lessons, so the first day ends with a tune', () => {
    const now = new Date('2026-03-02T09:00:00');
    const plan = planSession({ minutes: 20, lessons: {}, pieces: {}, cards: {}, now });
    expect(plan.map((b) => `${b.kind}:${b.id}`)).toEqual([`lesson:${order[0]}`, `lesson:${order[1]}`]);
    // At every session length. The first day runs long for a ten minute learner, and it is the only day that does.
    const short = planSession({ minutes: 10, lessons: {}, pieces: {}, cards: {}, now });
    expect(short.map((b) => `${b.kind}:${b.id}`)).toEqual([`lesson:${order[0]}`, `lesson:${order[1]}`]);
    // Having taken that first lesson today, the second is still offered today.
    const lessons = { [order[0]]: { done: true, doneOn: '2026-03-02', step: 0 } };
    const after = planSession({ minutes: 20, lessons, pieces: {}, cards: {}, now });
    expect(after[0]).toMatchObject({ kind: 'lesson', id: order[1] });
    // From then on it is one lesson a day.
    const two = { ...lessons, [order[1]]: { done: true, doneOn: '2026-03-02', step: 0 } };
    expect(planSession({ minutes: 20, lessons: two, pieces: {}, cards: {}, now }).some((b) => b.kind === 'lesson')).toBe(false);
  });

  it('never sets an exercise before the lesson that prepares it', () => {
    expect(openDrills({})).toEqual([]);
    expect(openDrills(doneUpTo(1))).toEqual([]);
    expect(openDrills(doneUpTo(2))).toEqual(['ear']);
    expect(openDrills(doneUpTo(3))).toEqual(['ear', 'rhythm']);
    expect(openDrills(doneUpTo(8))).toEqual(['ear', 'sight', 'rhythm']);
    expect(openDrills(doneUpTo(order.indexOf('major-scale') + 1))).toEqual(['ear', 'sight', 'rhythm', 'technique']);
    expect(openDrills(doneUpTo(order.indexOf('triads') + 1))).toEqual(['ear', 'sight', 'rhythm', 'technique', 'chords']);
    const now = new Date('2026-03-02T09:00:00');
    for (let day = 0; day < 4; day++) {
      const at = new Date(now.getTime() + day * 86400000);
      for (let n = 0; n <= order.length; n++) {
        const lessons = doneUpTo(n);
        const open = openDrills(lessons);
        for (const b of planSession({ minutes: 30, lessons, pieces: {}, cards: {}, now: at })) {
          if (b.kind === 'drill' && b.id !== 'reading') expect(open, `after ${n} lessons`).toContain(b.id);
        }
      }
    }
  });

  it('sets the exercise that has been left the longest', () => {
    const now = new Date('2026-03-10T09:00:00');
    const lessons = doneUpTo(12);
    const drillOf = (drills?: Record<string, { lastOn?: string }>) =>
      planSession({ minutes: 20, lessons, pieces: {}, cards: {}, drills, now }).find((b) => b.kind === 'drill' && b.id !== 'reading')?.id;
    // Ear and rhythm were practised lately. Sight reading never, so it comes first.
    expect(drillOf({ ear: { lastOn: '2026-03-09' }, rhythm: { lastOn: '2026-03-08' } })).toBe('sight');
    expect(drillOf({ ear: { lastOn: '2026-03-09' }, rhythm: { lastOn: '2026-03-03' }, sight: { lastOn: '2026-03-08' } })).toBe('rhythm');
    // With nothing known, they take turns by the day.
    const days = [0, 1, 2].map((d) => planSession({ minutes: 20, lessons, pieces: {}, cards: {}, now: new Date(now.getTime() + d * 86400000) }).find((b) => b.kind === 'drill')?.id);
    expect(new Set(days).size).toBe(3);
  });

  it('ends on a piece the learner already plays well, when there is one', () => {
    const now = new Date('2026-03-10T09:00:00');
    const lessons = doneUpTo(6);
    const learned = (id: string, lastOn: string) => ({ ...newPieceState(pieceInfo(id), '2026-03-01'), learned: true, wholeRung: 3, lastOn });
    const pieces = { 'hot-cross-buns': learned('hot-cross-buns', '2026-03-08'), 'mary-lamb': learned('mary-lamb', '2026-03-05') };
    expect(pieceToEndOn(pieces, '2026-03-10')).toBe('mary-lamb');
    const plan = planSession({ minutes: 30, lessons, pieces, cards: {}, now });
    const last = plan[plan.length - 1];
    expect(last).toMatchObject({ kind: 'piece', id: 'mary-lamb', minutes: 2 });
    expect(plan.reduce((a, b) => a + b.minutes, 0)).toBeLessThanOrEqual(32);
    // One played today already is not offered again.
    expect(pieceToEndOn({ 'mary-lamb': learned('mary-lamb', '2026-03-10') }, '2026-03-10')).toBeNull();
  });

  it('adds piece work once a lesson has introduced a piece', () => {
    const lessons = doneUpTo(2);
    expect(introducedPieces(lessons)).toEqual(['hot-cross-buns']);
    expect(currentPiece(lessons, {})).toBe('hot-cross-buns');
    const plan = planSession({ minutes: 20, lessons, pieces: {}, cards: {}, now: new Date('2026-03-02T09:00:00') });
    expect(plan.map((b) => b.kind)).toEqual(['lesson', 'piece', 'drill']);
    expect(plan[0]).toMatchObject({ id: order[2] });
  });

  it('opens with note reading when notes are due, and fits the time', () => {
    const lessons = doneUpTo(8);
    const cards = { 'read:T:60': newCard(new Date('2026-03-01T09:00:00')) };
    const plan = planSession({ minutes: 10, lessons, pieces: {}, cards, now: new Date('2026-03-02T09:00:00') });
    expect(plan[0]).toMatchObject({ kind: 'drill', id: 'reading' });
    expect(plan.reduce((a, b) => a + b.minutes, 0)).toBeLessThanOrEqual(12);
    expect(readsStaff(lessons)).toBe(true);
  });

  it('keeps to the minutes chosen at every point in the course', () => {
    const now = new Date('2026-03-02T09:00:00');
    for (const minutes of [10, 20, 30]) {
      for (let n = 0; n <= order.length; n++) {
        const lessons = doneUpTo(n);
        const plan = planSession({ minutes, lessons, pieces: {}, cards: {}, now });
        const total = plan.reduce((a, b) => a + b.minutes, 0);
        // One block is always offered, even if a lesson alone runs a little long. The first day is the one exception.
        if (plan.length > 1 && n > 0) expect(total, `${minutes} minutes after ${n} lessons`).toBeLessThanOrEqual(minutes + 2);
        expect(plan.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses the time when there is more of it', () => {
    const lessons = doneUpTo(8);
    const now = new Date('2026-03-02T09:00:00');
    const short = planSession({ minutes: 20, lessons, pieces: {}, cards: {}, now });
    const long = planSession({ minutes: 30, lessons, pieces: {}, cards: {}, now });
    const sum = (p: typeof short) => p.reduce((a, b) => a + b.minutes, 0);
    expect(sum(long)).toBeGreaterThanOrEqual(26);
    expect(sum(long)).toBeGreaterThan(sum(short));
  });

  it('brings nothing new once the day is done, or once a lesson has been taken today', () => {
    const now = new Date('2026-03-02T09:00:00');
    const lessons = doneUpTo(6);
    expect(planSession({ minutes: 20, lessons, pieces: {}, cards: {}, now, again: true }).some((b) => b.kind === 'lesson')).toBe(false);
    const withToday = { ...lessons, [order[6]]: { done: true, doneOn: '2026-03-02', step: 0 } };
    expect(planSession({ minutes: 20, lessons: withToday, pieces: {}, cards: {}, now }).some((b) => b.kind === 'lesson')).toBe(false);
  });

  it('with little time, lets a new lesson and the piece take turns', () => {
    const now = new Date('2026-03-03T09:00:00');
    const lessons: Record<string, { done: boolean; doneOn?: string; step: number }> = doneUpTo(1);
    lessons[order[1]] = { done: true, doneOn: '2026-03-02', step: 0 };
    // Yesterday brought a lesson, and with it a piece that has not been opened yet. Today it is played.
    const pieceDay = planDay({ minutes: 10, lessons, pieces: {}, cards: {}, days: { '2026-03-02': {} }, now });
    expect(pieceDay.blocks.some((b) => b.kind === 'lesson')).toBe(false);
    expect(pieceDay.blocks[0]).toMatchObject({ kind: 'piece', id: 'hot-cross-buns' });
    expect(pieceDay.held).toBe('turn');
    expect(pieceDay.blocks.reduce((a, b) => a + b.minutes, 0)).toBeLessThanOrEqual(12);
    // The day after, with no lesson since, the next lesson comes, whether or not the piece is learned yet.
    const pieces = { 'hot-cross-buns': newPieceState(pieceInfo('hot-cross-buns'), '2026-03-03') };
    const lessonDay = planDay({ minutes: 10, lessons, pieces, cards: {}, days: { '2026-03-02': {}, '2026-03-03': {} }, now: new Date('2026-03-04T09:00:00') });
    expect(lessonDay.blocks.some((b) => b.kind === 'lesson')).toBe(true);
    expect(lessonDay.held).toBeNull();
  });

  it('holds the next lesson back while two pieces are waiting, and gives the day to them', () => {
    const now = new Date('2026-03-10T09:00:00');
    // Four lessons taken, the last of them yesterday. Three pieces met, none learned yet.
    const lessons: Record<string, { done: boolean; doneOn?: string; step: number }> = {};
    order.slice(0, 4).forEach((id, i) => (lessons[id] = { done: true, doneOn: `2026-03-0${6 + i}`, step: 0 }));
    const waiting = introducedPieces(lessons);
    expect(waiting).toEqual(['hot-cross-buns', 'mary-lamb', 'ode-first']);
    const days = { '2026-03-06': {}, '2026-03-07': {}, '2026-03-08': {}, '2026-03-09': {} };
    const day = planDay({ minutes: 20, lessons, pieces: {}, cards: {}, days, now });
    expect(day.held).toBe('pieces');
    expect(day.upNext).toBe(order[4]);
    // Two of the waiting pieces share the session, and the time is used.
    expect(day.blocks.filter((b) => b.kind === 'piece').map((b) => b.id)).toEqual(['hot-cross-buns', 'mary-lamb']);
    expect(day.blocks.some((b) => b.kind === 'lesson')).toBe(false);
    const total = day.blocks.reduce((a, b) => a + b.minutes, 0);
    expect(total).toBeGreaterThanOrEqual(18);
    expect(total).toBeLessThanOrEqual(22);
    // Once all but one are learned, the next lesson comes.
    const learned = (id: string) => ({ ...newPieceState(pieceInfo(id), '2026-03-08'), learned: true, wholeRung: 3 });
    const pieces = { 'hot-cross-buns': learned('hot-cross-buns'), 'mary-lamb': learned('mary-lamb') };
    const after = planDay({ minutes: 20, lessons, pieces, cards: {}, days, now });
    expect(after.held).toBeNull();
    expect(after.blocks[0]).toMatchObject({ kind: 'lesson', id: order[4] });
  });

  it('never holds a lesson back for ever', () => {
    const lessons: Record<string, { done: boolean; doneOn?: string; step: number }> = {};
    order.slice(0, 4).forEach((id) => (lessons[id] = { done: true, doneOn: '2026-03-05', step: 0 }));
    const plan = (practised: string[], today: string) =>
      planDay({ minutes: 20, lessons, pieces: {}, cards: {}, days: Object.fromEntries(practised.map((d) => [d, {}])), now: new Date(`${today}T09:00:00`) });
    // Three days of practice since the last lesson, and the pieces are still not learned: it waits, one more day at most.
    const fourth = plan(['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08'], '2026-03-09');
    expect(fourth.held).toBe('pieces');
    expect(fourth.comesIn).toBe(1);
    // After a fourth, the lesson comes anyway.
    const fifth = plan(['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-10');
    expect(fifth.held).toBeNull();
    expect(fifth.blocks.some((b) => b.kind === 'lesson')).toBe(true);
    // With four or more waiting, only learning one brings the next lesson, however many days go by.
    const many: Record<string, { done: boolean; doneOn?: string; step: number }> = {};
    order.slice(0, 6).forEach((id) => (many[id] = { done: true, doneOn: '2026-03-05', step: 0 }));
    const days = Object.fromEntries(['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'].map((d) => [d, {}]));
    const stuck = planDay({ minutes: 20, lessons: many, pieces: {}, cards: {}, days, now: new Date('2026-03-11T09:00:00') });
    expect(stuck.waiting.length).toBeGreaterThanOrEqual(4);
    expect(stuck.held).toBe('pieces');
    expect(stuck.comesIn).toBeNull();
  });

  it('does not offer the pieces of lessons that were marked as known', () => {
    const lessons = Object.fromEntries(order.slice(0, 12).map((id) => [id, { done: true, skipped: true, step: 0 }]));
    expect(introducedPieces(lessons)).toEqual([]);
    expect(skippedPieces(lessons, {}).length).toBeGreaterThan(3);
    expect(currentPiece(lessons, {})).toBeNull();
    // One the learner opens anyway is theirs to practise.
    const pieces = { 'hot-cross-buns': newPieceState(pieceInfo('hot-cross-buns'), '2026-03-01') };
    expect(introducedPieces(lessons, pieces)).toEqual(['hot-cross-buns']);
  });

  it('gives a learner who skipped ahead a piece from what they skipped, so the first session has music in it', () => {
    const lessons = Object.fromEntries(order.slice(0, 12).map((id) => [id, { done: true, skipped: true, step: 0 }]));
    const now = new Date('2026-03-02T09:00:00');
    const plan = planSession({ minutes: 20, lessons, pieces: {}, cards: {}, now });
    const last = skippedPieces(lessons, {}).pop();
    // The last piece of the part marked as known: the best test of whether the skip was right.
    expect(plan.find((b) => b.kind === 'piece')).toMatchObject({ id: last });
    expect(plan.find((b) => b.kind === 'piece')?.detail).toMatch(/marked as known/);
    // And still the next lesson of the course.
    expect(plan.find((b) => b.kind === 'lesson')).toMatchObject({ id: order[12] });
    // Only until they have a piece of their own. After that the lessons bring the pieces.
    const pieces = { [last as string]: { ...newPieceState(pieceInfo(last as string), '2026-03-02'), learned: true } };
    const later = planSession({ minutes: 20, lessons, pieces, cards: {}, now: new Date('2026-03-03T09:00:00') });
    expect(later.some((b) => b.kind === 'piece' && /marked as known/.test(b.detail))).toBe(false);
    // A learner who skipped nothing is not given one.
    expect(planSession({ minutes: 20, lessons: {}, pieces: {}, cards: {}, now }).some((b) => b.kind === 'piece')).toBe(false);
  });

  it('starts untried exercises further up for a learner who skipped ahead', () => {
    expect(startingLevel(0, 6)).toBe(1);
    expect(startingLevel(1, 6)).toBe(2);
    expect(startingLevel(2, 6)).toBe(2);
    expect(startingLevel(3, 6)).toBe(3);
    expect(startingLevel(5, 6)).toBe(4);
    // Never past what the exercise has, or past what the lessons taken reach.
    expect(startingLevel(5, 2)).toBe(2);
  });

  it('offers exactly one new lesson, then work on a piece already met', () => {
    const lessons = doneUpTo(2);
    expect(introducedPieces(lessons)).toHaveLength(1);
    const plan = planSession({ minutes: 30, lessons, pieces: {}, cards: {}, now: new Date('2026-03-02T09:00:00') });
    expect(plan.filter((b) => b.kind === 'lesson')).toHaveLength(1);
    expect(plan.find((b) => b.kind === 'piece')).toMatchObject({ id: 'hot-cross-buns' });
  });

  it('ends once the course is finished with pieces and exercises only', () => {
    const lessons = doneUpTo(order.length);
    const plan = planSession({ minutes: 20, lessons, pieces: {}, cards: {}, now: new Date('2026-03-02T09:00:00') });
    expect(plan.some((b) => b.kind === 'lesson')).toBe(false);
    expect(plan.some((b) => b.kind === 'piece')).toBe(true);
  });
});
