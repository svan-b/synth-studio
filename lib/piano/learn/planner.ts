/**
 * Builds the daily session: a short, varied plan sized to the time the
 * learner has. New material comes early while attention is fresh, then
 * work on a piece, then a different skill for contrast.
 */

import { allPieces, getLesson, lessonOrder, lessonUnlocked, pieceInfo } from '../content/catalog';
import { dayKey, dayNumber, endOfDay } from '../util/emitter';
import { isKept, pieceProgress, type PieceState } from './coach';
import { isDue, type StoredCard } from './srs';
import type { LessonProgress } from './store';

export type DrillKind = 'reading' | 'rhythm' | 'ear' | 'sight' | 'chords' | 'technique';

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
  /** When each exercise was last practised, so the one left longest comes next. */
  drills?: Record<string, { lastOn?: string } | undefined>;
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
    for (const p of getLesson(id).pieces ?? []) {
      if (out.includes(p)) continue;
      if (lessons[id]?.done) {
        if (lessons[id].skipped && !pieces[p]) continue;
        out.push(p);
      } else if (pieces[p] && lessons[CAME_FROM[p] ?? '']?.done && !lessons[CAME_FROM[p]]?.skipped) {
        // Begun under the earlier course, when another lesson brought it. It stays in practice.
        out.push(p);
      }
    }
  }
  return out;
}

/**
 * Pieces that a different lesson used to bring, before the course was
 * reordered. A learner who met one that way and began it keeps it in practice,
 * even though the lesson that brings it now is still ahead of them.
 */
const CAME_FROM: Record<string, string> = {
  'lightly-row': 'hands-together',
};

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

/** The lesson that prepares each exercise. Until it is done the exercise would ask for something not yet taught. */
export const DRILL_LESSON: Record<Exclude<DrillKind, 'reading'>, string> = {
  ear: 'five-fingers',
  rhythm: 'steady-beat',
  sight: 'steps-on-staff',
  chords: 'triads',
  technique: 'major-scale',
};

/** The exercises the lessons have prepared the learner for, in the order they turn through the days. */
export function openDrills(lessons: Record<string, LessonProgress>): DrillKind[] {
  const order: Array<Exclude<DrillKind, 'reading'>> = ['ear', 'sight', 'rhythm', 'technique', 'chords'];
  return order.filter((kind) => lessons[DRILL_LESSON[kind]]?.done === true);
}

/** A learned piece that slipped at its last play through. A little work brings it back, and until then it is not played for pleasure. */
export function isRusty(state: PieceState | undefined): boolean {
  return state !== undefined && state.learned && !isKept(state);
}

/** Learned pieces in good order, not played today, the one left alone the longest first. */
function keptPieces(pieces: Record<string, PieceState>, today: string): string[] {
  return allPieces()
    .map((p) => p.id)
    .filter((id) => pieces[id]?.learned && !isRusty(pieces[id]) && pieces[id].lastOn !== today)
    .sort((a, b) => pieces[a].lastOn.localeCompare(pieces[b].lastOn));
}

/** A learned piece to end on: the one left alone the longest, and not one played today. */
export function pieceToEndOn(pieces: Record<string, PieceState>, today: string): string | null {
  const learned = allPieces()
    .map((p) => p.id)
    .filter((id) => pieces[id]?.learned && !isRusty(pieces[id]) && pieces[id].lastOn !== today);
  if (learned.length === 0) return null;
  return learned.sort((a, b) => pieces[a].lastOn.localeCompare(pieces[b].lastOn))[0];
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

/** Pieces met in lessons and not yet learned, in the order they were met. */
export function waitingPieces(lessons: Record<string, LessonProgress>, pieces: Record<string, PieceState>): string[] {
  return introducedPieces(lessons, pieces).filter((id) => !pieces[id]?.learned);
}

/**
 * How many pieces may be waiting to be learned before new lessons are held
 * back. A lesson a day outruns the playing: what it teaches would sit
 * unplayed for weeks. So the course moves as fast as the pieces are learned.
 */
export const PIECES_IN_HAND = 2;

/**
 * Practice days without a new lesson after which one comes anyway, so that a
 * learner held up on one piece still meets something new. Only while fewer
 * than `MOST_WAITING` pieces are waiting: past that the lessons would be
 * running ahead of the playing again.
 */
const LONGEST_WAIT = 4;
const MOST_WAITING = 4;

/**
 * Why today's plan has no new lesson in it:
 *   taken   one was taken today already, or the day's session is done
 *   pieces  enough pieces are waiting to be learned
 *   turn    with little time, lessons and pieces take the days in turn, and today is the piece's
 */
export type Held = 'taken' | 'pieces' | 'turn';

/**
 * A learned piece to play through today: first one that went rusty, which
 * comes back with a little work while it is still close, then one whose
 * review has come round. Reviews count by the day, so one that falls due this
 * afternoon is in the morning's plan.
 */
export function pieceDueForReview(pieces: Record<string, PieceState>, cards: Record<string, StoredCard>, now: Date): string | null {
  const today = dayKey(now);
  const rusty = allPieces().find((p) => isRusty(pieces[p.id]) && pieces[p.id].lastOn !== today);
  if (rusty) return rusty.id;
  const by = endOfDay(now);
  for (const p of allPieces()) {
    if (pieces[p.id]?.learned && isDue(cards[`piece:${p.id}`], by)) return p.id;
  }
  return null;
}

/** Notes whose review falls due today, the most overdue first. */
export function dueReadingCards(cards: Record<string, StoredCard>, now: Date): string[] {
  const by = endOfDay(now);
  return Object.keys(cards)
    .filter((id) => id.startsWith('read:') && isDue(cards[id], by))
    .sort((a, b) => new Date(cards[a].due).getTime() - new Date(cards[b].due).getTime());
}

/** How far a plan may run over the time chosen. A session of "10 minutes" is never 14. */
const OVER = 2;

/** What each exercise is called, and what it asks for. */
export const DRILL_LABEL: Record<DrillKind, [string, string]> = {
  ear: ['Play by ear', 'Hear a pattern and play it back'],
  rhythm: ['Rhythm', 'Tap rhythms in time with the beat'],
  sight: ['Sight reading', 'Read music you have never seen'],
  reading: ['Note reading', 'Name notes on the staff'],
  chords: ['Chords', 'Play chords and progressions from their symbols'],
  technique: ['Scales and arpeggios', 'Smooth, even runs with the right fingers'],
};

export function planSession(input: PlanInput): Block[] {
  return planDay(input).blocks;
}

/**
 * The day's plan, the lesson that comes next, and why it is held back if it
 * is. Where it waits on the pieces, `comesIn` is the number of practice days
 * after which it comes anyway, or null when only learning a piece will bring it.
 */
export function planDay(input: PlanInput): {
  blocks: Block[];
  upNext: string | undefined;
  held: Held | null;
  waiting: string[];
  comesIn: number | null;
  /** Where the lesson waits on the pieces: how many of them to learn before it comes. */
  toLearn: number;
} {
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

  // One new lesson, early, while attention is fresh. Never more than one a day,
  // with one exception: the very first lesson is a tour of the keyboard with
  // no music in it, so the second follows on the same day and the first day
  // ends with a tune.
  const order = lessonOrder();
  const taken = Object.values(input.lessons).filter((l) => l.done && !l.skipped && l.doneOn);
  const lessonToday = taken.some((l) => l.doneOn === today);
  const takenIds = order.filter((id) => input.lessons[id]?.done && !input.lessons[id]?.skipped);
  const onlyTheFirst = takenIds.length === 1 && takenIds[0] === order[0];
  const upNext = order.find((id) => !isDone(id) && lessonUnlocked(id, isDone));
  const lastLesson = taken.map((l) => l.doneOn as string).sort().pop();
  // A learner who placed themselves and has taken no lesson since counts from the day they placed themselves.
  const placedOn = Object.values(input.lessons)
    .filter((l) => l.done && l.skipped && l.doneOn)
    .map((l) => l.doneOn as string)
    .sort()
    .pop();
  const practised = Object.keys(input.days ?? {}).filter((d) => d < today).sort();

  // The course moves as fast as the pieces are learned. While enough of them are
  // waiting, the time goes to them and the next lesson waits its turn. It never
  // waits for ever: after some days of practice without one, it comes anyway.
  const waiting = waitingPieces(input.lessons, input.pieces);
  const since = lastLesson ?? placedOn;
  const daysSince = since ? practised.filter((d) => d > since).length : practised.length;
  let held: Held | null = null;
  if (input.again || (lessonToday && !onlyTheFirst)) held = 'taken';
  else if (waiting.length >= PIECES_IN_HAND && (daysSince < LONGEST_WAIT || waiting.length >= MOST_WAITING)) held = 'pieces';

  const lessonBlock = (id: string): Block => {
    const l = getLesson(id);
    return { kind: 'lesson', id, minutes: l.minutes, title: l.title, detail: l.summary };
  };
  let lesson: Block | null = upNext && !held ? lessonBlock(upNext) : null;
  // The lesson that follows the tour: the next one not already taken, which may have been opened from the course.
  const afterFirst = order.find((id) => id !== order[0] && !isDone(id) && lessonUnlocked(id, (x) => x === order[0] || isDone(x)));
  const second: Block | null = lesson && upNext === order[0] && afterFirst ? lessonBlock(afterFirst) : null;

  // Work on a piece with the coach.
  // A learner who skipped ahead has met no piece in a lesson yet. Until they have one, the last
  // piece of what they marked as known goes in: the session has music in it from the first day,
  // and playing it shows them whether the skip was right.
  // Later, whenever no piece is waiting, the pieces of the known part come in turn from the first.
  const fromLessons = currentPiece(input.lessons, input.pieces);
  const unopened = fromLessons ? [] : skippedPieces(input.lessons, input.pieces);
  const trial = unopened.length === 0 ? undefined : Object.keys(input.pieces).length === 0 ? unopened[unopened.length - 1] : unopened[0];
  const pieceId = fromLessons ?? trial ?? null;
  let piece: Block | null = null;
  if (pieceId) {
    const info = pieceInfo(pieceId);
    const progress = pieceProgress(info, input.pieces[pieceId]);
    piece = {
      kind: 'piece',
      id: pieceId,
      minutes: budget >= 20 ? 7 : 5,
      title: info.title,
      detail: trial
        ? 'A piece from the part you marked as known'
        : progress === 0
          ? 'Start learning this piece'
          : `Carry on, ${Math.round(progress * 100)} percent learned`,
    };
  }

  // Keep a learned piece alive. One that went rusty gets a little longer, to win it back.
  const reviewId = pieceDueForReview(input.pieces, input.cards, now);
  const rusty = reviewId ? isRusty(input.pieces[reviewId]) : false;
  const review: Block | null =
    reviewId && reviewId !== pieceId
      ? {
          kind: 'piece',
          id: reviewId,
          minutes: rusty ? 4 : 2,
          title: pieceInfo(reviewId).title,
          detail: rusty ? 'It slipped last time. A little work brings it back' : 'Play it through to keep it in your fingers',
        }
      : null;

  // A different skill for contrast, turning through the kinds day by day.
  // Only kinds a lesson has prepared: an exercise never comes before what it exercises.
  const open = openDrills(input.lessons);
  const dayIndex = dayNumber(today);
  // They take turns by the day. Where it is known when each was last practised,
  // the one left longest comes first, and one never tried comes before any.
  const turn = open.map((_, i) => open[(dayIndex + i) % Math.max(1, open.length)]);
  const last = (kind: DrillKind) => input.drills?.[kind]?.lastOn ?? '';
  const kinds = input.drills ? turn.slice().sort((a, b) => last(a).localeCompare(last(b))) : turn;
  const drillOf = (kind: DrillKind): Block => ({ kind: 'drill', id: kind, minutes: 3, title: DRILL_LABEL[kind][0], detail: DRILL_LABEL[kind][1] });
  const drill = kinds.length > 0 ? drillOf(kinds[0]) : null;

  // Something already learned to finish with, when nothing learned is otherwise in the plan.
  const endId = review ? null : pieceToEndOn(input.pieces, today);
  const ending: Block | null =
    endId && endId !== pieceId ? { kind: 'piece', id: endId, minutes: 2, title: pieceInfo(endId).title, detail: 'End on something you play well' } : null;

  // With little time, a new lesson and a piece do not both fit. They take the
  // days in turn: when the last day of practice brought a new lesson, today
  // belongs to the piece, so that what was taught gets played.
  if (lesson && !second && piece && lesson.minutes + piece.minutes > budget + OVER) {
    const lastDay = practised[practised.length - 1];
    if (lastLesson && lastDay && lastLesson >= lastDay) {
      lesson = null;
      held = 'turn';
    }
  }

  // On a day with no new lesson and time for it, a second piece shares the
  // session. Two things practised in turn hold better than one practised alone.
  const otherId = !lesson && pieceId && budget >= 20 ? waiting.find((id) => id !== pieceId) : undefined;
  let piece2: Block | null = null;
  if (otherId) {
    const info = pieceInfo(otherId);
    const progress = pieceProgress(info, input.pieces[otherId]);
    piece2 = {
      kind: 'piece',
      id: otherId,
      minutes: 5,
      title: info.title,
      detail: progress === 0 ? 'Start learning this piece' : `Carry on, ${Math.round(progress * 100)} percent learned`,
    };
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
  // A lesson is never crowded out by the notes that are due. Where both do not fit, the notes wait a day.
  const crowded = reading && lesson && reading.minutes + lesson.minutes > budget + OVER;
  add(crowded ? null : reading);
  add(lesson);
  // The first day ends with a tune at every session length, so its second lesson is not left out for time.
  if (lesson && second && blocks.includes(lesson)) {
    blocks.push(second);
    total += second.minutes;
  }
  add(piece);
  add(piece2);
  add(review);
  add(drill);
  add(ending);

  // Time to spare goes to the pieces first, then to a second kind of exercise.
  let spare = budget - total;
  const main = blocks.find((b) => b.kind === 'piece' && b.id === pieceId);
  const also = piece2 && blocks.includes(piece2) ? piece2 : null;
  if (main && spare >= 1) {
    const more = Math.min(spare, 8);
    // Shared between the two pieces when there are two.
    const toOther = also ? Math.floor(more / 2) : 0;
    main.minutes += more - toOther;
    if (also) also.minutes += toOther;
    spare -= more;
  }
  // Anything added from here goes before the closing piece, so the session still ends on something that goes well.
  const beforeEnd = () => (ending && blocks.includes(ending) ? blocks.indexOf(ending) : blocks.length);
  const other = kinds.length > 1 ? kinds[1] : null;
  if (spare >= 3 && drill && other && other !== drill.id && blocks.includes(drill)) {
    blocks.splice(beforeEnd(), 0, drillOf(other));
    spare -= 3;
  }
  // With nothing to learn, or not enough to fill the time, the pieces already learned have it: a few of them,
  // the ones left alone the longest. Playing them is what they were learned for.
  if (spare >= 3) {
    const inPlan = new Set(blocks.filter((b) => b.kind === 'piece').map((b) => b.id));
    let added = 0;
    for (const id of keptPieces(input.pieces, today)) {
      if (spare < 3 || added >= 3) break;
      if (inPlan.has(id)) continue;
      const minutes = Math.min(4, spare);
      blocks.splice(beforeEnd(), 0, { kind: 'piece', id, minutes, title: pieceInfo(id).title, detail: 'One you know. Play it through for the pleasure of it' });
      spare -= minutes;
      added += 1;
    }
  }
  const third = kinds.length > 2 ? kinds[2] : null;
  if (spare >= 3 && third && drill && blocks.includes(drill)) {
    blocks.splice(beforeEnd(), 0, drillOf(third));
    spare -= 3;
  }
  // What is left lengthens the exercises a little each.
  const exercises = blocks.filter((b) => b.kind === 'drill' && b.id !== 'reading');
  for (let i = 0; spare >= 1 && exercises.some((b) => b.minutes < 8); i++) {
    const b = exercises[i % exercises.length];
    if (b.minutes < 8) {
      b.minutes += 1;
      spare -= 1;
    }
  }
  const comesIn = held === 'pieces' && waiting.length < MOST_WAITING ? Math.max(1, LONGEST_WAIT - daysSince) : null;
  // Below MOST_WAITING, learning all but one brings the lesson. At it or above, the days count only once fewer are waiting.
  const toLearn = Math.max(1, waiting.length >= MOST_WAITING ? waiting.length - MOST_WAITING + 1 : waiting.length - PIECES_IN_HAND + 1);
  return { blocks, upNext, held: upNext && !blocks.some((b) => b.kind === 'lesson') ? (held ?? 'taken') : null, waiting, comesIn, toLearn };
}

export function planMinutes(blocks: Block[]): number {
  return blocks.reduce((a, b) => a + b.minutes, 0);
}
