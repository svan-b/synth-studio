// ============================================================================
// The recommended sequence of lessons (docs/PEDAGOGY.md, "The curriculum for each
// instrument"): lessons in `order`, each open once its prerequisites are done.
// One place decides it, so the lesson browser's "Recommended next", the Welcome's
// "Start the first lesson" and the coach's "Next lesson" always agree.
// ============================================================================
import type { Lesson } from '@/types';

/** Lessons in their recommended order (lessons without an order come last, as written) */
export function inSequence(lessons: readonly Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/** Not done yet, and every prerequisite is done */
export function isReady(lesson: Lesson, completed: readonly string[]): boolean {
  return !completed.includes(lesson.id) && (lesson.prerequisites ?? []).every(p => completed.includes(p));
}

/** The first lesson in the sequence that is ready */
export function recommendedLesson(lessons: readonly Lesson[], completed: readonly string[]): Lesson | undefined {
  return inSequence(lessons).find(l => isReady(l, completed));
}

/**
 * The lesson to go on to after `current` (counted as done): the next ready one later in the
 * sequence, or else an earlier one that was skipped. Never a finished lesson, and never one
 * whose prerequisites are still open.
 */
export function lessonAfter(lessons: readonly Lesson[], current: Lesson, completed: readonly string[]): Lesson | undefined {
  const done = completed.includes(current.id) ? completed : [...completed, current.id];
  const seq = inSequence(lessons);
  const i = seq.findIndex(l => l.id === current.id);
  if (i < 0) return undefined;
  return seq.slice(i + 1).find(l => isReady(l, done)) ?? seq.slice(0, i).find(l => isReady(l, done));
}
