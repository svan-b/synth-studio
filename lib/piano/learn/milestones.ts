/**
 * The learner's path so far: the firsts worth remembering, with the day each
 * happened. Everything here is read from progress already kept, so nothing
 * extra is stored.
 */

import { allPieces, allStages } from '../content/catalog';
import type { PieceState } from './coach';
import type { LessonProgress } from './store';

export interface Milestone {
  /** The day it happened, as YYYY-MM-DD. */
  on: string;
  title: string;
  kind: 'start' | 'first' | 'stage' | 'piece';
}

/** Lessons whose finishing marks a first, and what that first was. */
const FIRSTS: Record<string, string> = {
  'five-fingers': 'Played a first tune',
  'hands-together': 'Played with both hands at once',
  'steps-on-staff': 'Began to read music',
  'grand-staff': 'Read two staves at once',
  'triads': 'Played first chords',
  'progressions': 'Played a chord progression in two keys',
  'pedal': 'Used the pedal',
  'arpeggios-two-hands': 'Played arpeggios with both hands',
  'improvise': 'Made up music of your own',
};

export function milestones(startedOn: string, lessons: Record<string, LessonProgress>, pieces: Record<string, PieceState>): Milestone[] {
  const out: Milestone[] = [{ on: startedOn, title: 'Started with Middle C', kind: 'start' }];
  // A lesson marked as known was not taken, so it is no first of this learner's.
  const taken = (id: string) => (lessons[id]?.done && !lessons[id]?.skipped ? lessons[id].doneOn : undefined);

  for (const [id, title] of Object.entries(FIRSTS)) {
    const on = taken(id);
    if (on) out.push({ on, title, kind: 'first' });
  }
  for (const stage of allStages()) {
    if (!stage.lessons.every((id) => lessons[id]?.done)) continue;
    const days = stage.lessons.map(taken).filter((d): d is string => Boolean(d));
    if (days.length === 0) continue;
    out.push({ on: days.sort()[days.length - 1], title: `Finished stage ${stage.id}, ${stage.title}`, kind: 'stage' });
  }
  for (const piece of allPieces()) {
    const state = pieces[piece.id];
    if (state?.learned && state.learnedOn) out.push({ on: state.learnedOn, title: `Learned ${piece.title}`, kind: 'piece' });
  }
  // Newest first. Within a day, the order above is kept turned round, so later things come first.
  return out
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (a.m.on === b.m.on ? b.i - a.i : b.m.on.localeCompare(a.m.on)))
    .map((x) => x.m);
}
