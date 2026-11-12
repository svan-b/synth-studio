/** Lookups over the course content, with scores parsed once and kept. */

import { defaultSections, type PieceInfo } from '../learn/coach';
import { parseScore, sliceScore, type Score } from '../music/score';
import { PIECES } from './pieces';
import { LESSONS, STAGES } from './lessons';
import type { Lesson, Music, MusicRef, Piece, Stage } from './types';

const pieceById = new Map(PIECES.map((p) => [p.id, p]));
const lessonById = new Map(LESSONS.map((l) => [l.id, l]));
const scoreCache = new Map<string, Score>();

export function getPiece(id: string): Piece {
  const p = pieceById.get(id);
  if (!p) throw new Error(`Unknown piece: ${id}`);
  return p;
}

export function getLesson(id: string): Lesson {
  const l = lessonById.get(id);
  if (!l) throw new Error(`Unknown lesson: ${id}`);
  return l;
}

export function allPieces(): Piece[] {
  return PIECES;
}

export function allLessons(): Lesson[] {
  return LESSONS;
}

export function allStages(): Stage[] {
  return STAGES;
}

export function pieceScore(id: string): Score {
  let s = scoreCache.get(id);
  if (!s) {
    const p = getPiece(id);
    s = parseScore({ key: p.key, time: p.time, tempo: p.tempo, pickup: p.pickup, rh: p.rh, lh: p.lh, chords: p.chords });
    scoreCache.set(id, s);
  }
  return s;
}

export function pieceInfo(id: string): PieceInfo {
  const p = getPiece(id);
  const score = pieceScore(id);
  const sections: Array<[number, number]> = p.sections
    ? p.sections.map(([a, b]) => [a - 1, b - 1])
    : defaultSections(score.measureCount, score.pickup > 0);
  return { id, title: p.title, hands: score.hands, sections, measures: score.measureCount };
}

function isRef(m: Music): m is MusicRef {
  return (m as MusicRef).piece !== undefined;
}

/** Turn a lesson's music, inline or a reference to a piece, into a score. */
export function resolveMusic(m: Music): Score {
  if (isRef(m)) {
    const score = pieceScore(m.piece);
    if (m.from === undefined && m.to === undefined) return score;
    return sliceScore(score, (m.from ?? 1) - 1, (m.to ?? score.measureCount) - 1);
  }
  const key = JSON.stringify(m);
  let s = scoreCache.get(key);
  if (!s) {
    s = parseScore(m);
    scoreCache.set(key, s);
  }
  return s;
}

/** Lessons in course order. */
export function lessonOrder(): string[] {
  return STAGES.flatMap((s) => s.lessons);
}

/** The first lesson not yet finished, or null when the course is complete. */
export function nextLesson(done: (id: string) => boolean): Lesson | null {
  for (const id of lessonOrder()) if (!done(id)) return getLesson(id);
  return null;
}

/** A lesson opens once the one before it is done. */
export function lessonUnlocked(id: string, done: (id: string) => boolean): boolean {
  const order = lessonOrder();
  const i = order.indexOf(id);
  return i <= 0 || done(order[i - 1]);
}

/** The stage the learner is working in. */
export function currentStage(done: (id: string) => boolean): number {
  const next = nextLesson(done);
  return next ? next.stage : STAGES[STAGES.length - 1].id;
}
