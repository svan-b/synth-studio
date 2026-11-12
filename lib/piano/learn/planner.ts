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
  now?: Date;
}

const done = (lessons: Record<string, LessonProgress>) => (id: string) => lessons[id]?.done === true;

/** Pieces the learner has been introduced to, in the order they were met. */
export function introducedPieces(lessons: Record<string, LessonProgress>): string[] {
  const out: string[] = [];
  for (const id of lessonOrder()) {
    if (!lessons[id]?.done) continue;
    for (const p of getLesson(id).pieces ?? []) if (!out.includes(p)) out.push(p);
  }
  return out;
}

/** Whether the learner has met staff notation yet. */
export function readsStaff(lessons: Record<string, LessonProgress>): boolean {
  return lessons['steps-on-staff']?.done === true;
}

/** The piece to work on now: one in progress first, then the next not started. */
export function currentPiece(lessons: Record<string, LessonProgress>, pieces: Record<string, PieceState>): string | null {
  const known = introducedPieces(lessons).filter((id) => !pieces[id]?.learned);
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

export function planSession(input: PlanInput): Block[] {
  const now = input.now ?? new Date();
  const isDone = done(input.lessons);
  const blocks: Block[] = [];

  // A quick recall to start: notes that are due.
  const due = dueReadingCards(input.cards, now);
  if (due.length > 0) {
    blocks.push({
      kind: 'drill',
      id: 'reading',
      minutes: 2,
      title: 'Note reading',
      detail: due.length === 1 ? 'One note is due for review' : `${due.length} notes are due for review`,
    });
  }

  // New material while fresh, unless there is already plenty in progress.
  const next = lessonOrder().find((id) => !isDone(id) && lessonUnlocked(id, isDone));
  const inProgress = introducedPieces(input.lessons).filter((id) => !input.pieces[id]?.learned).length;
  if (next && inProgress < 4) {
    const lesson = getLesson(next);
    blocks.push({ kind: 'lesson', id: next, minutes: lesson.minutes, title: lesson.title, detail: lesson.summary });
  }

  // Work on a piece with the coach.
  const piece = currentPiece(input.lessons, input.pieces);
  if (piece) {
    const info = pieceInfo(piece);
    const progress = pieceProgress(info, input.pieces[piece]);
    blocks.push({
      kind: 'piece',
      id: piece,
      minutes: input.minutes >= 20 ? 7 : 5,
      title: info.title,
      detail: progress === 0 ? 'Start learning this piece' : `Carry on, ${Math.round(progress * 100)} percent learned`,
    });
  }

  // Keep a learned piece alive.
  const review = pieceDueForReview(input.pieces, input.cards, now);
  if (review && review !== piece) {
    blocks.push({ kind: 'piece', id: review, minutes: 2, title: pieceInfo(review).title, detail: 'Play it through to keep it in your fingers' });
  }

  // A different skill for contrast, turning through the kinds day by day.
  const kinds: DrillKind[] = readsStaff(input.lessons) ? ['ear', 'sight', 'rhythm'] : ['ear', 'rhythm'];
  const dayIndex = Math.floor(new Date(dayKey(now) + 'T12:00:00').getTime() / 86400000);
  const drill = kinds[dayIndex % kinds.length];
  const labels: Record<DrillKind, [string, string]> = {
    ear: ['Play by ear', 'Hear a pattern and play it back'],
    rhythm: ['Rhythm', 'Tap rhythms in time with the beat'],
    sight: ['Sight reading', 'Read music you have never seen'],
    reading: ['Note reading', 'Name notes on the staff'],
  };
  blocks.push({ kind: 'drill', id: drill, minutes: 3, title: labels[drill][0], detail: labels[drill][1] });

  // Trim to the time available, always keeping at least the first two blocks.
  let total = blocks.reduce((a, b) => a + b.minutes, 0);
  while (blocks.length > 2 && total > input.minutes + 3) {
    const removed = blocks.pop()!;
    total -= removed.minutes;
  }
  return blocks;
}

export function planMinutes(blocks: Block[]): number {
  return blocks.reduce((a, b) => a + b.minutes, 0);
}
