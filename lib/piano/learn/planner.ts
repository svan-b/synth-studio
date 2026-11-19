/**
 * Builds the daily session: a short, varied plan sized to the time the
 * learner has. New material comes early while attention is fresh, then
 * work on a piece, then a different skill for contrast.
 */

import { allPieces, getLesson, lessonOrder, lessonUnlocked, pieceInfo } from '../content/catalog';
import { dayKey } from '../util/emitter';
import { pieceProgress, type PieceState } from './coach';
import { isDue, type StoredCard } from './srs';
import type { LessonProgress } from './store';

export type DrillKind = 'reading' | 'rhythm' | 'ear' | 'sight';

export type Block =
  | { kind: 'lesson'; id: string; minutes: number; title: string; detail: string }
  | { kind: 'piece'; id: string; minutes: number; title: string; detail: string }
  | { kind: 'drill'; id: DrillKind; minutes: number; title: string; detail: string };

export interface PlanInput {
  minutes: number;
  lessons: Record<string, LessonProgress>;
  pieces: Record<string, PieceState>;
  cards: Record<string, StoredCard>;
  /** Days on which something was practised, by date. Only the dates are read. */
  days?: Record<string, unknown>;
  /** The day's session is already done. This is extra practice, with nothing new in it. */
  again?: boolean;
  now?: Date;
}

const done = (lessons: Record<string, LessonProgress>) => (id: string) => lessons[id]?.done === true;

/**
 * Pieces the learner has been introduced to, in the order they were met.
 * A piece from a lesson that was marked as known, not taken, is left out
 * unless the learner has opened it: they said they are past it.
 */
export function introducedPieces(lessons: Record<string, LessonProgress>, pieces: Record<string, PieceState> = {}): string[] {
  const out: string[] = [];
  for (const id of lessonOrder()) {
    if (!lessons[id]?.done) continue;
    for (const p of getLesson(id).pieces ?? []) {
      if (lessons[id].skipped && !pieces[p]) continue;
      if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** Pieces from lessons that were marked as known, which the learner has not opened. */
export function skippedPieces(lessons: Record<string, LessonProgress>, pieces: Record<string, PieceState>): string[] {
  const met = introducedPieces(lessons, pieces);
  const out: string[] = [];
  for (const id of lessonOrder()) {
    if (!lessons[id]?.done || !lessons[id].skipped) continue;
    for (const p of getLesson(id).pieces ?? []) if (!met.includes(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

/** Whether the learner has met staff notation yet. */
export function readsStaff(lessons: Record<string, LessonProgress>): boolean {
  return lessons['steps-on-staff']?.done === true;
}

/** The piece to work on now: one in progress first, then the next not started. */
export function currentPiece(lessons: Record<string, LessonProgress>, pieces: Record<string, PieceState>): string | null {
  const known = introducedPieces(lessons, pieces).filter((id) => !pieces[id]?.learned);
  if (known.length === 0) return null;
  const started = known.filter((id) => pieces[id]);
  if (started.length > 0) {
    // Most recently introduced piece that is under way.
    return started[started.length - 1];
  }
  return known[0];
}

/** A learned piece whose review has come round. */
export function pieceDueForReview(pieces: Record<string, PieceState>, cards: Record<string, StoredCard>, now: Date): string | null {
  for (const p of allPieces()) {
    if (pieces[p.id]?.learned && isDue(cards[`piece:${p.id}`], now)) return p.id;
  }
  return null;
}

export function dueReadingCards(cards: Record<string, StoredCard>, now: Date): string[] {
  return Object.keys(cards)
    .filter((id) => id.startsWith('read:') && isDue(cards[id], now))
    .sort((a, b) => new Date(cards[a].due).getTime() - new Date(cards[b].due).getTime());
}

/** How far a plan may run over the time chosen. A session of "10 minutes" is never 14. */
const OVER = 2;

export function planSession(input: PlanInput): Block[] {
  const now = input.now ?? new Date();
  const today = dayKey(now);
  const isDone = done(input.lessons);
  const budget = input.minutes;

  // A quick recall to start: notes that are due.
  const due = dueReadingCards(input.cards, now);
  const reading: Block | null =
    due.length > 0
      ? {
          kind: 'drill',
          id: 'reading',
          minutes: 2,
          title: 'Note reading',
          detail: due.length === 1 ? 'One note is due for review' : `${due.length} notes are due for review`,
        }
      : null;

  // One new lesson, early, while attention is fresh. Never more than one a day.
  const taken = Object.values(input.lessons).filter((l) => l.done && !l.skipped && l.doneOn);
  const lessonToday = taken.some((l) => l.doneOn === today);
  const next = input.again || lessonToday ? undefined : lessonOrder().find((id) => !isDone(id) && lessonUnlocked(id, isDone));
  let lesson: Block | null = null;
  if (next) {
    const l = getLesson(next);
    lesson = { kind: 'lesson', id: next, minutes: l.minutes, title: l.title, detail: l.summary };
  }

  // Work on a piece with the coach.
  const pieceId = currentPiece(input.lessons, input.pieces);
  let piece: Block | null = null;
  if (pieceId) {
    const info = pieceInfo(pieceId);
    const progress = pieceProgress(info, input.pieces[pieceId]);
    piece = {
      kind: 'piece',
      id: pieceId,
      minutes: budget >= 20 ? 7 : 5,
      title: info.title,
      detail: progress === 0 ? 'Start learning this piece' : `Carry on, ${Math.round(progress * 100)} percent learned`,
    };
  }

  // Keep a learned piece alive.
  const reviewId = pieceDueForReview(input.pieces, input.cards, now);
  const review: Block | null =
    reviewId && reviewId !== pieceId
      ? { kind: 'piece', id: reviewId, minutes: 2, title: pieceInfo(reviewId).title, detail: 'Play it through to keep it in your fingers' }
      : null;

  // A different skill for contrast, turning through the kinds day by day.
  const kinds: DrillKind[] = readsStaff(input.lessons) ? ['ear', 'sight', 'rhythm'] : ['ear', 'rhythm'];
  const dayIndex = Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000);
  const labels: Record<DrillKind, [string, string]> = {
    ear: ['Play by ear', 'Hear a pattern and play it back'],
    rhythm: ['Rhythm', 'Tap rhythms in time with the beat'],
    sight: ['Sight reading', 'Read music you have never seen'],
    reading: ['Note reading', 'Name notes on the staff'],
  };
  const drillOf = (kind: DrillKind): Block => ({ kind: 'drill', id: kind, minutes: 3, title: labels[kind][0], detail: labels[kind][1] });
  const drill = drillOf(kinds[dayIndex % kinds.length]);

  // With little time, a new lesson and a piece under way do not both fit.
  // They take turns: when the last day of practice brought a new lesson,
  // today belongs to the piece, so that what was taught gets played.
  if (lesson && piece && pieceId && input.pieces[pieceId] && lesson.minutes + piece.minutes > budget + OVER) {
    const lastLesson = taken.map((l) => l.doneOn as string).sort().pop();
    const lastDay = Object.keys(input.days ?? {})
      .filter((d) => d < today)
      .sort()
      .pop();
    if (lastLesson && lastDay && lastLesson >= lastDay) lesson = null;
  }

  // Fill the time in the order things are played, leaving out what does not fit.
  const blocks: Block[] = [];
  let total = 0;
  const add = (b: Block | null) => {
    if (!b) return;
    if (blocks.length > 0 && total + b.minutes > budget + OVER) return;
    blocks.push(b);
    total += b.minutes;
  };
  add(reading);
  add(lesson);
  add(piece);
  add(review);
  add(drill);

  // Time to spare goes to the piece first, then to a second kind of exercise.
  let spare = budget - total;
  const main = blocks.find((b) => b.kind === 'piece' && b.id === pieceId);
  if (main && spare >= 3) {
    const more = Math.min(spare, 8);
    main.minutes += more;
    spare -= more;
  }
  const second = kinds[(dayIndex + 1) % kinds.length];
  if (spare >= 3 && second !== drill.id && blocks.includes(drill)) blocks.push(drillOf(second));
  return blocks;
}

export function planMinutes(blocks: Block[]): number {
  return blocks.reduce((a, b) => a + b.minutes, 0);
}
