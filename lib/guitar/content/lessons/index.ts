import type { Lesson, Stage } from '../types';
import { STAGE1 } from './stage1';
import { STAGE2 } from './stage2';
import { STAGE3 } from './stage3';
import { STAGE4 } from './stage4';
import { STAGE5 } from './stage5';
import { STAGE6 } from './stage6';

export const LESSONS: Lesson[] = [...STAGE1, ...STAGE2, ...STAGE3, ...STAGE4, ...STAGE5, ...STAGE6];

const ids = (stage: number) => LESSONS.filter((l) => l.stage === stage).map((l) => l.id);

export const STAGES: Stage[] = [
  { id: 1, title: 'First sounds', goal: 'Hold and tune the guitar, play your first chords, and a first song in your first week.', lessons: ids(1) },
  { id: 2, title: 'Strumming', goal: 'A steady strumming hand, the pattern behind countless songs, waltz time, and minor chords.', lessons: ids(2) },
  { id: 3, title: 'The campfire chords', goal: 'G, C and the seven chords, enough to play a whole songbook.', lessons: ids(3) },
  { id: 4, title: 'Melodies and tab', goal: 'Read tab, and play tunes note by note.', lessons: ids(4) },
  { id: 5, title: 'Fingerpicking', goal: 'Pick with the thumb and fingers, broken chords, and an old tune.', lessons: ids(5) },
  { id: 6, title: 'Going further', goal: 'The first barre chord, the blues, chords by ear, and a song of your own.', lessons: ids(6) },
];
