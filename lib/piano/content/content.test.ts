import { describe, expect, it } from 'vitest';
import { allLessons, allPieces, allStages, getLesson, lessonOrder, lessonUnlocked, nextLesson, pieceInfo, pieceScore, resolveMusic } from './catalog';
import type { Music, Step } from './types';

function musicOf(step: Step): Music[] {
  if (step.kind === 'listen' || step.kind === 'play') return [step.music];
  if (step.kind === 'echo') return step.motifs.map((m) => (step.hand === 'L' ? { lh: m, key: step.key } : { rh: m, key: step.key }));
  if ((step.kind === 'say' || step.kind === 'quiz') && step.figure?.kind === 'staff') return [step.figure.music];
  return [];
}

describe('pieces', () => {
  it('all parse, with measures that add up', () => {
    for (const p of allPieces()) {
      expect(() => pieceScore(p.id), p.id).not.toThrow();
    }
  });

  it('have unique ids and sensible ranges', () => {
    const seen = new Set<string>();
    for (const p of allPieces()) {
      expect(seen.has(p.id), `duplicate ${p.id}`).toBe(false);
      seen.add(p.id);
      const score = pieceScore(p.id);
      for (const n of score.notes) {
        expect(n.midi, `${p.id} note out of range`).toBeGreaterThanOrEqual(33);
        expect(n.midi, `${p.id} note out of range`).toBeLessThanOrEqual(96);
        if (n.finger !== undefined) expect(n.finger).toBeGreaterThanOrEqual(1);
      }
      expect(p.tempo).toBeGreaterThanOrEqual(40);
      expect(p.tempo).toBeLessThanOrEqual(160);
    }
  });

  it('keep each hand on its own side of the other', () => {
    for (const p of allPieces()) {
      const score = pieceScore(p.id);
      if (score.hands.length < 2) continue;
      for (const step of score.steps) {
        const r = step.notes.filter((n) => n.hand === 'R').map((n) => n.midi);
        const l = step.notes.filter((n) => n.hand === 'L').map((n) => n.midi);
        if (r.length && l.length) expect(Math.min(...r), `${p.id} hands cross at beat ${step.start}`).toBeGreaterThanOrEqual(Math.max(...l));
      }
    }
  });

  it('have sections that cover the piece exactly once', () => {
    for (const p of allPieces()) {
      const info = pieceInfo(p.id);
      let next = 0;
      for (const [a, b] of info.sections) {
        expect(a, `${p.id} section start`).toBe(next);
        expect(b).toBeGreaterThanOrEqual(a);
        next = b + 1;
      }
      expect(next, `${p.id} sections end`).toBe(info.measures);
    }
  });

  it('give a start fingering for every hand', () => {
    for (const p of allPieces()) {
      const score = pieceScore(p.id);
      for (const hand of score.hands) {
        const first = score.notes.find((n) => n.hand === hand);
        expect(first?.finger, `${p.id} ${hand} first note has no finger`).toBeDefined();
      }
    }
  });
});

describe('lessons', () => {
  it('have unique ids and belong to a stage', () => {
    const seen = new Set<string>();
    const staged = new Set(lessonOrder());
    for (const l of allLessons()) {
      expect(seen.has(l.id), `duplicate ${l.id}`).toBe(false);
      seen.add(l.id);
      expect(staged.has(l.id), `${l.id} missing from stages`).toBe(true);
      expect(l.steps.length).toBeGreaterThan(3);
    }
    expect(staged.size).toBe(allLessons().length);
  });

  it('contain only music that parses and pieces that exist', () => {
    for (const l of allLessons()) {
      l.steps.forEach((step, i) => {
        for (const m of musicOf(step)) {
          expect(() => resolveMusic(m), `${l.id} step ${i + 1}`).not.toThrow();
        }
      });
      for (const id of l.pieces ?? []) expect(() => pieceScore(id), `${l.id} piece ${id}`).not.toThrow();
    }
  });

  it('have quizzes with a valid answer', () => {
    for (const l of allLessons()) {
      for (const step of l.steps) {
        if (step.kind !== 'quiz') continue;
        expect(step.answer).toBeGreaterThanOrEqual(0);
        expect(step.answer).toBeLessThan(step.choices.length);
        expect(step.choices.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('use well formed review card ids', () => {
    for (const l of allLessons()) {
      for (const id of l.cards ?? []) expect(id, l.id).toMatch(/^read:[TB]:\d+$/);
    }
  });

  it('introduce every piece of a stage at or before that stage', () => {
    const introduced = new Map<string, number>();
    for (const l of allLessons()) for (const id of l.pieces ?? []) introduced.set(id, l.stage);
    const stages = new Set(allStages().map((s) => s.id));
    for (const p of allPieces()) {
      if (!stages.has(p.stage)) continue;
      const at = introduced.get(p.id);
      if (at !== undefined) expect(at, `${p.id} introduced late`).toBeLessThanOrEqual(p.stage);
    }
  });

  it('avoid characters the course style rules out', () => {
    for (const l of allLessons()) {
      const text = JSON.stringify(l);
      expect(text.includes('—'), `${l.id} has an em dash`).toBe(false);
      expect(text.includes(' -- '), `${l.id} has a double dash`).toBe(false);
    }
  });

  it('unlock in order', () => {
    const order = lessonOrder();
    const done = new Set<string>();
    const isDone = (id: string) => done.has(id);
    expect(nextLesson(isDone)?.id).toBe(order[0]);
    expect(lessonUnlocked(order[0], isDone)).toBe(true);
    expect(lessonUnlocked(order[1], isDone)).toBe(false);
    done.add(order[0]);
    expect(lessonUnlocked(order[1], isDone)).toBe(true);
    expect(nextLesson(isDone)?.id).toBe(order[1]);
    expect(getLesson(order[0]).title.length).toBeGreaterThan(3);
  });
});
