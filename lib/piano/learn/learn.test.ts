import { describe, expect, it } from 'vitest';
import { applyResult, defaultSections, newPieceState, nextTask, pieceProgress, type PieceInfo } from './coach';
import { isDue, newCard, outcomeFromAccuracy, outcomeFromAnswer, review } from './srs';
import { streak } from './store';
import type { FlowResult } from '../engine/flow';

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
    ...patch,
  };
}

describe('practice coach', () => {
  it('starts by listening, then each hand, then together, then with the beat', () => {
    let state = newPieceState(info, '2026-01-01');
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const task = nextTask(info, state)!;
      if (task.scope.type !== 'section' || task.scope.index !== 0) break;
      seen.push(`${task.mode}:${task.hands.join('')}:${task.tempoPct}`);
      state = applyResult(info, state, task, task.mode === 'listen' ? null : result({ mode: task.mode === 'tempo' ? 'tempo' : 'wait' }), '2026-01-01').state;
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

  it('takes a trouble spot out after two poor tries, then puts it back', () => {
    let state = newPieceState(info, '2026-01-01');
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
    let state = newPieceState(info, '2026-01-01');
    state.sections[0].rung = 5;
    const bad = result({ mode: 'tempo', accuracy: 0.6, onTime: 0.4, clean: false });
    state = applyResult(info, state, nextTask(info, state)!, bad).state;
    expect(state.sections[0].rung).toBe(5);
    state = applyResult(info, state, nextTask(info, state)!, bad).state;
    expect(state.sections[0].rung).toBe(4);
    expect(nextTask(info, state)!.tempoPct).toBe(60);
  });

  it('joins phrases, then climbs with the whole piece until it is learned', () => {
    let state = newPieceState(info, '2026-01-01');
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
      const out = applyResult(info, state, task, result({ mode: 'tempo' }), '2026-01-03');
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

  it('tells late notes from wrong notes', () => {
    let state = newPieceState(info, '2026-01-01');
    state.sections[0].rung = 4;
    const late = result({ mode: 'tempo', accuracy: 0.95, onTime: 0.3, biasMs: 90, clean: false });
    const out = applyResult(info, state, nextTask(info, state)!, late);
    expect(out.verdict.passed).toBe(false);
    expect(out.verdict.message).toMatch(/behind the beat/);
  });

  it('uses a shorter ladder for one hand', () => {
    const solo: PieceInfo = { id: 's', title: 'S', hands: ['R'], sections: [[0, 3]], measures: 4 };
    let state = newPieceState(solo);
    const modes: string[] = [];
    for (let i = 0; i < 9; i++) {
      const task = nextTask(solo, state)!;
      if (task.scope.type !== 'section') break;
      modes.push(task.mode);
      state = applyResult(solo, state, task, task.mode === 'listen' ? null : result({ mode: task.mode === 'tempo' ? 'tempo' : 'wait' })).state;
    }
    expect(modes).toEqual(['listen', 'wait', 'wait', 'tempo', 'tempo', 'tempo', 'tempo']);
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
