import type { Lesson, Stage } from '../types';
import { STAGE1 } from './stage1';
import { STAGE2 } from './stage2';

export const LESSONS: Lesson[] = [...STAGE1, ...STAGE2];

const ids = (stage: number) => LESSONS.filter((l) => l.stage === stage).map((l) => l.id);

export const STAGES: Stage[] = [
  { id: 1, title: 'First sounds', goal: 'Find your way around the keyboard and play real tunes by ear and by shape.', lessons: ids(1) },
  { id: 2, title: 'Reading', goal: 'Read notes and rhythms on both staves.', lessons: ids(2) },
].filter((s) => s.lessons.length > 0);
