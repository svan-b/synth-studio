/**
 * Spaced review, using the FSRS scheduler. Each item (a note to read, a
 * piece to keep in the fingers) carries a memory state, and comes back just
 * before it is likely to be forgotten.
 */

import { Rating, createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from 'ts-fsrs';

export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number;
  last_review?: string;
}

export type Outcome = 'again' | 'hard' | 'good' | 'easy';

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: false,
    // Motor and reading skills at the piano fade faster than facts if left
    // for months, so reviews never drift further apart than this.
    maximum_interval: 60,
    request_retention: 0.9,
  }),
);

const RATING: Record<Outcome, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function revive(c: StoredCard): Card {
  return {
    ...c,
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  } as Card;
}

function store(c: Card): StoredCard {
  return {
    due: new Date(c.due).toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: c.learning_steps,
    state: c.state,
    last_review: c.last_review ? new Date(c.last_review).toISOString() : undefined,
  };
}

export function newCard(now: Date = new Date()): StoredCard {
  return store(createEmptyCard(now));
}

export function review(card: StoredCard | undefined, outcome: Outcome, now: Date = new Date()): StoredCard {
  const current = card ? revive(card) : createEmptyCard(now);
  return store(scheduler.next(current, now, RATING[outcome]).card);
}

export function isDue(card: StoredCard | undefined, now: Date = new Date()): boolean {
  if (!card) return false;
  return new Date(card.due).getTime() <= now.getTime();
}

/** Days until the card is due, negative when overdue. */
export function dueInDays(card: StoredCard, now: Date = new Date()): number {
  return (new Date(card.due).getTime() - now.getTime()) / 86400000;
}

/** Turn a measured performance into a review outcome. */
export function outcomeFromAccuracy(accuracy: number, clean: boolean): Outcome {
  if (accuracy < 0.7) return 'again';
  if (accuracy < 0.88) return 'hard';
  return clean && accuracy >= 0.97 ? 'easy' : 'good';
}

/** For quick drills: right or wrong, and how long the answer took. */
export function outcomeFromAnswer(correct: boolean, seconds: number, fast = 2.5, slow = 6): Outcome {
  if (!correct) return 'again';
  if (seconds <= fast) return 'easy';
  if (seconds >= slow) return 'hard';
  return 'good';
}
