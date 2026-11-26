/**
 * The learner's path so far: the firsts worth remembering, each with its day.
 * All of it is read from progress already kept, so nothing extra is stored.
 */

import { allSongs, allStages } from '../content/catalog';
import type { SongState } from './coach';
import type { ChangeRecord, LessonProgress } from './store';

export interface Milestone {
  on: string;
  title: string;
  kind: 'start' | 'first' | 'stage' | 'song' | 'record';
}

const FIRSTS: Record<string, string> = {
  'meet-guitar': 'Tuned the guitar and played every string',
  'first-chord': 'Played a first chord',
  'a-chord': 'Played a first song',
  'the-pattern': 'Strummed a real pattern',
  'waltz-time': 'Played in waltz time',
  'c-chord': 'Played G, C and D, the campfire chords',
  'ode-to-joy': 'Played a melody note by note',
  'thumb-and-fingers': 'Picked with the fingers',
  'f-chord': 'Played a barre chord',
  blues: 'Played the blues',
  'your-song': 'Made up a song of your own',
};

/** Clean changes in a minute between two chords that are worth marking. */
const CHANGE_MARKS = [20, 30, 45, 60];

export function milestones(startedOn: string, lessons: Record<string, LessonProgress>, songs: Record<string, SongState>, changes: Record<string, ChangeRecord> = {}): Milestone[] {
  const out: Milestone[] = [{ on: startedOn, title: 'Started with Open String', kind: 'start' }];
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
  for (const song of allSongs()) {
    const s = songs[song.id];
    if (s?.learned && s.learnedOn) out.push({ on: s.learnedOn, title: `Learned ${song.title}`, kind: 'song' });
  }
  for (const [pair, rec] of Object.entries(changes)) {
    const [a, b] = pair.split('|');
    for (const mark of CHANGE_MARKS) {
      const first = rec.history.find(([, n]) => n >= mark);
      if (first) out.push({ on: first[0], title: `${mark} clean changes in a minute, ${a} and ${b}`, kind: 'record' });
    }
  }
  return out
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (a.m.on === b.m.on ? b.i - a.i : b.m.on.localeCompare(a.m.on)))
    .map((x) => x.m);
}
