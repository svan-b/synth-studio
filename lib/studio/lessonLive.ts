// ============================================================================
// Live studio state for lesson checks (Lesson API v3 – studio state).
//
// The lesson runtime (lessonRuntime.ts) measures what can only be measured while
// audio runs - the master meter, channel meters, REC and Bounce, what the learner
// did since the lesson started, the song position - and publishes it here. The
// store reads it when it builds a lesson check state. Pure: no audio, no store,
// no hub, so the store can import it without a cycle.
// ============================================================================

import type { LessonBounceState, LessonCheckState, LessonHistory, LessonMeters } from '@/types';

export interface LessonLive {
  meters?: LessonMeters;
  bounce?: LessonBounceState;
  history?: LessonHistory;
  arranger?: LessonCheckState['arranger'];
}

let live: LessonLive = {};
const listeners = new Set<() => void>();

/** The latest live state (fields are missing until the runtime has measured them) */
export function getLessonLive(): LessonLive {
  return live;
}

/** Publish new live values (the runtime does, a few times a second at most) */
export function setLessonLive(patch: Partial<LessonLive>) {
  live = { ...live, ...patch };
  listeners.forEach(l => l());
}

/** Called after every publish: the coach refreshes live checklists and readouts */
export function onLessonLive(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Hooks the runtime registers so the store can ask for studio-level actions it cannot
 * do itself (the store must not import the hub): stop everything before a studio is
 * replaced, forget the undo history afterwards.
 */
export interface LessonStudioHooks {
  /** Stop the studio transport and every instrument's own sequencer */
  stopAll(): void;
  /** A lesson replaced (or restored) the whole studio */
  studioReplaced(): void;
}

let hooks: LessonStudioHooks | null = null;

export function setLessonStudioHooks(h: LessonStudioHooks | null) {
  hooks = h;
}

export function lessonStudioHooks(): LessonStudioHooks | null {
  return hooks;
}
