// ============================================================================
// The Producer path's lessons load on demand (they are long: keeping them out of
// the first download keeps the iPad's first load light). This small module is
// what the rest of the app knows up front: the lesson ids, so the review queue
// treats their questions as "not loaded yet" rather than gone, and a loader that
// fetches the lessons and registers them with the store's lesson registry.
// ============================================================================

import type { Lesson } from '@/types';
import { STUDIO_LESSONS } from './lessons';

/** Every Producer path lesson id (lib/studio/producerLessons.ts must list exactly these) */
export const PRODUCER_LESSON_IDS = [
  'studio-producer-04-one-clock',
  'studio-producer-07-frequency-slots',
  'studio-producer-09-space-depth',
  'studio-producer-10-ear-lab',
  'studio-producer-11-arrangement',
  'studio-producer-12-transitions',
  'studio-producer-13-mixdown',
  'studio-producer-14-master-bounce',
] as const;

const ID_SET = new Set<string>(PRODUCER_LESSON_IDS);

export function isProducerLessonId(id: string): boolean {
  return ID_SET.has(id);
}

let loaded: Lesson[] | null = null;
let loading: Promise<Lesson[]> | null = null;
let registerHook: ((device: string, lessons: Lesson[]) => void) | null = null;
const listeners = new Set<(lessons: Lesson[]) => void>();

/** The Producer path lessons once loaded (null before) */
export function producerLessonsNow(): Lesson[] | null {
  return loaded;
}

/** Load the Producer path lessons (once) and register them for the review queue */
export function loadProducerLessons(): Promise<Lesson[]> {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = import('./producerLessons')
      .then(m => {
        loaded = m.PRODUCER_LESSONS;
        registerHook?.('studio', [...STUDIO_LESSONS, ...loaded]);
        listeners.forEach(l => l(loaded!));
        return loaded;
      })
      .catch(e => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

/** The store hands over its lesson registry when it loads (this module must not import the store) */
export function setProducerRegister(fn: (device: string, lessons: Lesson[]) => void) {
  registerHook = fn;
  if (loaded) fn('studio', [...STUDIO_LESSONS, ...loaded]);
}

/** Called once the lessons have loaded (at once if they already have) */
export function onProducerLessons(l: (lessons: Lesson[]) => void): () => void {
  listeners.add(l);
  if (loaded) l(loaded);
  return () => listeners.delete(l);
}

// The lesson runner and tests: every studio lesson, the Producer path included
if (typeof window !== 'undefined') {
  (window as unknown as { __synthStudioLessons?: () => Promise<Lesson[]> }).__synthStudioLessons =
    async () => [...STUDIO_LESSONS, ...(await loadProducerLessons())];
}
