/**
 * Builds the daily session: short, varied, and sized to the time the learner
 * has. It always opens by tuning up, brings new material early while
 * attention is fresh, gives most of the time to songs, adds one different
 * skill for contrast, and ends on something already learned.
 */

import { allSongs, getLesson, getSong, lessonOrder, lessonUnlocked, songInfo } from '../content/catalog';
import { dayKey } from '../util/emitter';
import { songProgress, type SongState } from './coach';
import { isDue, type StoredCard } from './srs';
import type { LessonProgress } from './store';

export type DrillKind = 'recall' | 'changes' | 'rhythm' | 'ear';

export type Block =
  | { kind: 'tune'; id: 'tune'; minutes: number; title: string; detail: string }
  | { kind: 'lesson'; id: string; minutes: number; title: string; detail: string }
  | { kind: 'song'; id: string; minutes: number; title: string; detail: string }
  | { kind: 'drill'; id: DrillKind; minutes: number; title: string; detail: string };

export interface PlanInput {
  minutes: number;
  lessons: Record<string, LessonProgress>;
  songs: Record<string, SongState>;
  cards: Record<string, StoredCard>;
  days?: Record<string, unknown>;
  drills?: Record<string, { lastOn?: string } | undefined>;
  /** The day's session is done. This is extra practice, with nothing new in it. */
  again?: boolean;
  now?: Date;
}

const done = (lessons: Record<string, LessonProgress>) => (id: string) => lessons[id]?.done === true;

/** Songs the learner has been brought to, in the order they were met. A song from a lesson marked as known is left out unless opened. */
export function introducedSongs(lessons: Record<string, LessonProgress>, songs: Record<string, SongState> = {}): string[] {
  const out: string[] = [];
  for (const id of lessonOrder()) {
    if (!lessons[id]?.done) continue;
    for (const s of getLesson(id).songs ?? []) {
      if (lessons[id].skipped && !songs[s]) continue;
      if (!out.includes(s)) out.push(s);
    }
  }
  return out;
}

/** The lesson that opens each exercise. Before it, the exercise would ask for something not yet taught. */
export const DRILL_LESSON: Record<DrillKind, string> = {
  recall: 'e-and-e7',
  changes: 'a-chord',
  rhythm: 'steady-hand',
  ear: 'meet-guitar',
};

export const DRILL_LABEL: Record<DrillKind, [string, string]> = {
  recall: ['Chord check', 'Play the chords you know, from their names'],
  changes: ['One minute changes', 'How many clean changes in a minute'],
  rhythm: ['Strumming', 'Strum patterns in time with the click'],
  ear: ['Ear', 'Tell sounds apart by listening'],
};

export function openDrills(lessons: Record<string, LessonProgress>): DrillKind[] {
  const order: DrillKind[] = ['changes', 'rhythm', 'ear', 'recall'];
  return order.filter((k) => lessons[DRILL_LESSON[k]]?.done === true);
}

/** A learned song to end on: the one left longest, and not one played today. */
export function songToEndOn(songs: Record<string, SongState>, today: string): string | null {
  const learned = allSongs()
    .map((s) => s.id)
    .filter((id) => songs[id]?.learned && songs[id].lastOn !== today);
  if (learned.length === 0) return null;
  return learned.sort((a, b) => songs[a].lastOn.localeCompare(songs[b].lastOn))[0];
}

/** The song to work on now: one under way first, then the next not started. */
export function currentSong(lessons: Record<string, LessonProgress>, songs: Record<string, SongState>): string | null {
  const known = introducedSongs(lessons, songs).filter((id) => !songs[id]?.learned);
  if (known.length === 0) return null;
  const started = known.filter((id) => songs[id]);
  return started.length > 0 ? started[started.length - 1] : known[0];
}

export function waitingSongs(lessons: Record<string, LessonProgress>, songs: Record<string, SongState>): string[] {
  return introducedSongs(lessons, songs).filter((id) => !songs[id]?.learned);
}

/** Songs that may wait to be learned before new lessons hold back. */
export const SONGS_IN_HAND = 2;
const LONGEST_WAIT = 4;
const MOST_WAITING = 4;

export type Held = 'taken' | 'songs' | 'turn';

export function songDueForReview(songs: Record<string, SongState>, cards: Record<string, StoredCard>, now: Date): string | null {
  for (const s of allSongs()) if (songs[s.id]?.learned && isDue(cards[`song:${s.id}`], now)) return s.id;
  return null;
}

/** Chords whose review has come round, soonest due first. */
export function dueChords(cards: Record<string, StoredCard>, now: Date): string[] {
  return Object.keys(cards)
    .filter((id) => id.startsWith('chord:') && isDue(cards[id], now))
    .sort((a, b) => new Date(cards[a].due).getTime() - new Date(cards[b].due).getTime())
    .map((id) => id.slice(6));
}

const OVER = 2;

export function planSession(input: PlanInput): Block[] {
  return planDay(input).blocks;
}

export function planDay(input: PlanInput): { blocks: Block[]; upNext: string | undefined; held: Held | null; waiting: string[]; comesIn: number | null } {
  const now = input.now ?? new Date();
  const today = dayKey(now);
  const isDone = done(input.lessons);
  const budget = input.minutes;

  // Every session starts with the guitar in tune. A guitar drifts from day to day, and nothing sounds right out of tune.
  const tune: Block = { kind: 'tune', id: 'tune', minutes: 1, title: 'Tune up', detail: 'Every string in tune before you play' };

  const due = dueChords(input.cards, now);
  const recall: Block | null =
    due.length > 0 && input.lessons[DRILL_LESSON.recall]?.done
      ? { kind: 'drill', id: 'recall', minutes: 2, title: 'Chord check', detail: due.length === 1 ? `${due[0]} is due for a check` : `${due.length} chords are due for a check` }
      : null;

  // One new lesson, early, while attention is fresh. The very first lesson has no music in it, so the second follows on the first day.
  const order = lessonOrder();
  const taken = Object.values(input.lessons).filter((l) => l.done && !l.skipped && l.doneOn);
  const lessonToday = taken.some((l) => l.doneOn === today);
  const takenIds = order.filter((id) => input.lessons[id]?.done && !input.lessons[id]?.skipped);
  const onlyTheFirst = takenIds.length === 1 && takenIds[0] === order[0];
  const upNext = order.find((id) => !isDone(id) && lessonUnlocked(id, isDone));
  const lastLesson = taken.map((l) => l.doneOn as string).sort().pop();
  const practised = Object.keys(input.days ?? {})
    .filter((d) => d < today)
    .sort();

  const waiting = waitingSongs(input.lessons, input.songs);
  const daysSince = lastLesson ? practised.filter((d) => d > lastLesson).length : 0;
  let held: Held | null = null;
  if (input.again || (lessonToday && !onlyTheFirst)) held = 'taken';
  else if (waiting.length >= SONGS_IN_HAND && (daysSince < LONGEST_WAIT || waiting.length >= MOST_WAITING)) held = 'songs';

  const lessonBlock = (id: string): Block => {
    const l = getLesson(id);
    return { kind: 'lesson', id, minutes: l.minutes, title: l.title, detail: l.summary };
  };
  let lesson: Block | null = upNext && !held ? lessonBlock(upNext) : null;
  const second: Block | null = lesson && upNext === order[0] && order.length > 1 ? lessonBlock(order[1]) : null;

  const songId = currentSong(input.lessons, input.songs);
  let song: Block | null = null;
  if (songId) {
    const p = songProgress(songInfo(songId), input.songs[songId]);
    song = {
      kind: 'song',
      id: songId,
      minutes: budget >= 20 ? 7 : 5,
      title: getSong(songId).title,
      detail: p === 0 ? 'Start learning this song' : `Carry on, ${Math.round(p * 100)} percent learned`,
    };
  }

  const reviewId = songDueForReview(input.songs, input.cards, now);
  const review: Block | null =
    reviewId && reviewId !== songId ? { kind: 'song', id: reviewId, minutes: 2, title: getSong(reviewId).title, detail: 'Play it through to keep it in your fingers' } : null;

  const open = openDrills(input.lessons).filter((k) => k !== 'recall');
  const dayIndex = Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000);
  const turn = open.map((_, i) => open[(dayIndex + i) % Math.max(1, open.length)]);
  const last = (k: DrillKind) => input.drills?.[k]?.lastOn ?? '';
  const kinds = input.drills ? turn.slice().sort((a, b) => last(a).localeCompare(last(b))) : turn;
  const drillOf = (k: DrillKind): Block => ({ kind: 'drill', id: k, minutes: k === 'changes' ? 2 : 3, title: DRILL_LABEL[k][0], detail: DRILL_LABEL[k][1] });
  const drill = kinds.length > 0 ? drillOf(kinds[0]) : null;

  const endId = review ? null : songToEndOn(input.songs, today);
  const ending: Block | null = endId && endId !== songId ? { kind: 'song', id: endId, minutes: 2, title: getSong(endId).title, detail: 'End on something you play well' } : null;

  // With little time, a new lesson and a song do not both fit. They take the days in turn.
  if (lesson && !second && song && lesson.minutes + song.minutes + tune.minutes > budget + OVER) {
    const lastDay = practised[practised.length - 1];
    if (lastLesson && lastDay && lastLesson >= lastDay) {
      lesson = null;
      held = 'turn';
    }
  }

  // On a day with no new lesson and time for it, a second song shares the session.
  const otherId = !lesson && songId && budget >= 20 ? waiting.find((id) => id !== songId) : undefined;
  let song2: Block | null = null;
  if (otherId) {
    const p = songProgress(songInfo(otherId), input.songs[otherId]);
    song2 = { kind: 'song', id: otherId, minutes: 5, title: getSong(otherId).title, detail: p === 0 ? 'Start learning this song' : `Carry on, ${Math.round(p * 100)} percent learned` };
  }

  // The very first lesson teaches tuning itself, so the first day starts with it instead.
  const blocks: Block[] = isDone(order[0]) ? [tune] : [];
  let total = blocks.length > 0 ? tune.minutes : 0;
  const add = (b: Block | null) => {
    if (!b) return;
    if (total + b.minutes > budget + OVER) return;
    blocks.push(b);
    total += b.minutes;
  };
  const crowded = recall && lesson && recall.minutes + lesson.minutes + total > budget + OVER;
  add(crowded ? null : recall);
  if (lesson) {
    // A lesson is never left out for time. It is the one new thing of the day.
    blocks.push(lesson);
    total += lesson.minutes;
  }
  if (lesson && second) {
    blocks.push(second);
    total += second.minutes;
  }
  add(song);
  add(song2);
  add(review);
  add(drill);
  add(ending);

  let spare = budget - total;
  const main = blocks.find((b) => b.kind === 'song' && b.id === songId);
  const also = song2 && blocks.includes(song2) ? song2 : null;
  if (main && spare >= 1) {
    const more = Math.min(spare, 8);
    const toOther = also ? Math.floor(more / 2) : 0;
    main.minutes += more - toOther;
    if (also) also.minutes += toOther;
    spare -= more;
  }
  const other = kinds.length > 1 ? kinds[1] : null;
  if (spare >= 3 && drill && other && other !== drill.id && blocks.includes(drill)) {
    const at = ending && blocks.includes(ending) ? blocks.indexOf(ending) : blocks.length;
    blocks.splice(at, 0, drillOf(other));
  }
  const comesIn = held === 'songs' && waiting.length < MOST_WAITING ? Math.max(1, LONGEST_WAIT - daysSince) : null;
  return { blocks, upNext, held: upNext && !blocks.some((b) => b.kind === 'lesson') ? (held ?? 'taken') : null, waiting, comesIn };
}

export function planMinutes(blocks: Block[]): number {
  return blocks.reduce((a, b) => a + b.minutes, 0);
}
