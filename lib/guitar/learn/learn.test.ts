import { describe, expect, it } from 'vitest';
import { lessonOrder, songInfo } from '../content/catalog';
import type { FollowResult } from '../engine/follow';
import { applyResult, isKept, newSongState, nextTask, planOutline, songProgress, type SongState } from './coach';
import { milestones } from './milestones';
import { DRILL_LESSON, openDrills, planDay } from './planner';
import { daysAway, daysThisWeek } from './store';

function result(over: Partial<FollowResult> = {}): FollowResult {
  return {
    mode: 'wait',
    kind: 'strum',
    bpm: 80,
    totalSteps: 8,
    rightSteps: 8,
    wrongTries: 0,
    unclearTries: 0,
    hintedSteps: 0,
    pausedSteps: 0,
    missedSteps: 0,
    accuracy: 1,
    onTime: 1,
    meanAbsMs: 20,
    biasMs: 0,
    chordsRight: 1,
    extraStrikes: 0,
    deadStrikes: 0,
    fluency: 1,
    pace: 0.8,
    perMeasure: Array.from({ length: 8 }, (_, i) => ({ measure: i, steps: 1, errors: 0, hesitations: 0, hints: 0, played: 1 })),
    changes: [],
    detail: [],
    seconds: 20,
    clean: true,
    cutShort: false,
    earlyStrikes: 0,
    quietNotes: [],
    ...over,
  };
}

describe('the coach', () => {
  const info = songInfo('skip-to-my-lou');

  it('starts a new song with a play through, and skips what is already known', () => {
    const state = newSongState(info);
    expect(nextTask(info, state)?.scope.type).toBe('trial');
    const out = applyResult(info, state, nextTask(info, state)!, result({ perMeasure: Array.from({ length: 16 }, (_, i) => ({ measure: i, steps: 1, errors: 0, hesitations: 0, hints: 0, played: 1 })) }));
    expect(out.verdict.message).toMatch(/already/);
    // Every line known: the next thing is the whole song with a slow beat.
    expect(nextTask(info, out.state)?.scope.type).toBe('whole');
  });

  it('climbs a strummed song from the changes to the slow beat to its own strum', () => {
    let state: SongState = { ...newSongState(info), trial: 'done' };
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const task = nextTask(info, state)!;
      if (task.scope.type !== 'section' || task.scope.index !== 0) break;
      seen.push(`${task.mode}${task.simple ? ' simple' : ''}`);
      const r = task.mode === 'listen' ? null : result({ mode: task.mode === 'tempo' ? 'tempo' : 'wait', clean: false, accuracy: 0.95, onTime: 0.9 });
      state = applyResult(info, state, task, r).state;
    }
    expect(seen).toEqual(['listen', 'wait', 'wait', 'tempo simple', 'tempo simple', 'tempo', 'tempo']);
  });

  it('takes out a change that keeps coming late, drills it, and puts it back', () => {
    let state: SongState = { ...newSongState(info), trial: 'done', sections: info.sections.map(() => ({ rung: 3, streak: 0, fails: 0 })) };
    const late = result({
      mode: 'tempo',
      accuracy: 0.7,
      onTime: 0.5,
      clean: false,
      changes: [
        { from: 'A', to: 'E7', measure: 2, state: 'late' },
        { from: 'E7', to: 'A', measure: 4, state: 'ok' },
        { from: 'A', to: 'E7', measure: 6, state: 'late' },
      ],
    });
    let task = nextTask(info, state)!;
    state = applyResult(info, state, task, late).state;
    task = nextTask(info, state)!;
    const out = applyResult(info, state, task, late);
    expect(out.verdict.message).toMatch(/A to E7/);
    state = out.state;
    task = nextTask(info, state)!;
    expect(task.scope.type).toBe('focus');
    expect(task.change).toEqual({ from: 'A', to: 'E7' });
    for (let i = 0; i < 2; i++) state = applyResult(info, state, nextTask(info, state)!, result({ clean: false, accuracy: 0.9 })).state;
    expect(state.focus).toBeNull();
  });

  it('learns a song at full speed only after two good runs, then keeps it', () => {
    let state: SongState = { ...newSongState(info), trial: 'done', sections: info.sections.map(() => ({ rung: 4, streak: 0, fails: 0 })), joined: info.sections.length - 1 };
    let learned = false;
    for (let i = 0; i < 10 && !learned; i++) {
      const task = nextTask(info, state)!;
      expect(task.scope.type).toBe('whole');
      const out = applyResult(info, state, task, result({ mode: 'tempo', accuracy: 0.95, onTime: 0.85, clean: false }));
      state = out.state;
      learned = out.verdict.learned;
    }
    expect(learned).toBe(true);
    expect(isKept(state)).toBe(true);
    expect(songProgress(info, state)).toBe(1);
    expect(nextTask(info, state)?.title).toBe('Play it through');
  });

  it('lays out the plan with where the learner is', () => {
    const rows = planOutline(info, { ...newSongState(info), trial: 'done' });
    expect(rows[0].steps.map((s) => s.label)).toEqual(['Listen', 'Chord changes', 'One strum a beat', 'The strum']);
    expect(rows[0].steps[0].state).toBe('now');
  });
});

describe('the daily plan', () => {
  const day = (d: string) => new Date(`${d}T10:00:00`);

  it('gives the first day two lessons so it ends with a chord, and tunes first every day after', () => {
    const plan = planDay({ minutes: 15, lessons: {}, songs: {}, cards: {}, now: day('2026-12-01') });
    // The first lesson teaches tuning, so the first day has no separate tune up.
    expect(plan.blocks.some((b) => b.kind === 'tune')).toBe(false);
    expect(plan.blocks.filter((b) => b.kind === 'lesson').map((b) => b.id)).toEqual(lessonOrder().slice(0, 2));
    const first = lessonOrder()[0];
    const next = planDay({ minutes: 15, lessons: { [first]: { done: true, doneOn: '2026-12-01', step: 0 } }, songs: {}, cards: {}, days: { '2026-12-01': {} }, now: day('2026-12-02') });
    expect(next.blocks[0].kind).toBe('tune');
  });

  it('holds the next lesson while two songs are still being learned', () => {
    const lessons = Object.fromEntries(lessonOrder().slice(0, 5).map((id) => [id, { done: true, doneOn: '2026-12-01', step: 0 }]));
    const plan = planDay({ minutes: 20, lessons, songs: {}, cards: {}, days: { '2026-12-01': {} }, now: day('2026-12-02') });
    expect(plan.held).toBe('songs');
    expect(plan.blocks.some((b) => b.kind === 'lesson')).toBe(false);
    expect(plan.blocks.some((b) => b.kind === 'song')).toBe(true);
  });

  it('opens each exercise only after the lesson that prepares it', () => {
    expect(openDrills({})).toEqual([]);
    const after = Object.fromEntries(Object.values(DRILL_LESSON).map((id) => [id, { done: true, step: 0 }]));
    expect(openDrills(after).sort()).toEqual(['changes', 'ear', 'recall', 'rhythm']);
  });
});

describe('days played', () => {
  it('counts the days of this week, so one gap is only one gap', () => {
    const days = { '2026-12-01': { seconds: 600, played: 0, activities: 1 }, '2026-12-03': { seconds: 300, played: 0, activities: 1 } };
    expect(daysThisWeek(days, '2026-12-03')).toEqual([false, false, false, false, true, false, true]);
    expect(daysAway(days, '2026-12-05')).toBe(2);
    expect(daysAway({}, '2026-12-05')).toBeNull();
  });

  it('marks firsts and records on the path', () => {
    const ms = milestones('2026-11-30', { 'first-chord': { done: true, doneOn: '2026-11-30', step: 0 } }, {}, { 'A|E7': { best: 31, history: [['2026-12-02', 22], ['2026-12-04', 31]] } });
    const titles = ms.map((m) => m.title);
    expect(titles).toContain('Played a first chord');
    expect(titles).toContain('20 clean changes in a minute, A and E7');
    expect(titles).toContain('30 clean changes in a minute, A and E7');
  });
});
