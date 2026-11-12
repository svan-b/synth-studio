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
  { id: 1, title: 'First sounds', goal: 'Find your way around the keyboard and play real tunes by ear and by shape.', lessons: ids(1) },
  { id: 2, title: 'Reading', goal: 'Read notes and rhythms on both staves.', lessons: ids(2) },
  { id: 3, title: 'Hands together', goal: 'Play full pieces with both hands, and learn how to practise.', lessons: ids(3) },
  { id: 4, title: 'Chords and keys', goal: 'Build scales and chords, and play songs from chord symbols.', lessons: ids(4) },
  { id: 5, title: 'Fluency', goal: 'Use the pedal, play in minor keys and give each hand its own line.', lessons: ids(5) },
  { id: 6, title: 'Musicianship', goal: 'Richer harmony, playing by ear, making music up, and pieces to keep.', lessons: ids(6) },
];
