/**
 * Placing a learner who already plays. The course is one path, so placing
 * means marking the early part of it as known. That is kept apart from
 * lessons really taken, shown as such, and can be undone.
 */

import { allStages, getLesson } from '../content/catalog';
import {
  CHORD_LEVELS,
  EAR_LEVELS,
  RHYTHM_LEVELS,
  SIGHT_LEVELS,
  TECH_LEVELS,
  chordLevelCap,
  rhythmLevelCap,
  sightLevelCap,
  techniqueLevelCap,
} from './generators';
import { usePiano } from './store';

/**
 * Mark every lesson up to the end of a stage as known, without taking it.
 * The notes those lessons teach join the reading review, and exercises that
 * have never been practised begin further up than the bottom.
 */
export function markKnownThrough(stageId: number): void {
  const s = usePiano.getState();
  for (const stage of allStages()) {
    if (stage.id > stageId) break;
    for (const id of stage.lessons) {
      s.skipLesson(id);
      const cards = getLesson(id).cards;
      if (cards) s.addCards(cards);
    }
  }
  seedLevels(stageId);
  // The day's plan is different now, so one begun before is not picked up.
  usePiano.getState().keepSession(null);
}

/** Take back the mark on one stage: its lessons that were marked as known, and not taken, are to do again. */
export function undoKnown(stageId: number): void {
  const s = usePiano.getState();
  const stage = allStages().find((x) => x.id === stageId);
  for (const id of stage?.lessons ?? []) {
    if (!s.lessons[id]?.skipped) continue;
    s.unskipLesson(id);
    // The notes the mark added to the reading review go too, unless they have been reviewed since.
    const cards = getLesson(id).cards;
    if (cards) s.dropCards(cards);
  }
  // Exercises never practised go back to where the stages still marked as known would start them.
  reseedUntried(knownStages());
  s.keepSession(null);
}

/** How many stages from the first are wholly behind the learner, taken or marked as known. */
function knownStages(): number {
  const lessons = usePiano.getState().lessons;
  let n = 0;
  for (const stage of allStages()) {
    if (!stage.lessons.every((id) => lessons[id]?.done)) break;
    n = stage.id;
  }
  return n;
}

/** Set the exercises the learner has never practised to the level for this many known stages. */
function reseedUntried(stagesKnown: number): void {
  const done = (id: string) => usePiano.getState().lessons[id]?.done === true;
  for (const [kind, top] of Object.entries(levelTops(done))) {
    const had = usePiano.getState().drills[kind];
    if (!had || tried(had)) continue;
    const level = stagesKnown > 0 ? startingLevel(stagesKnown, top) : 1;
    if (level !== had.level) usePiano.getState().setDrillLevel(kind, level);
  }
}

/** Whether the learner has ever practised an exercise. A level only set by placing has not been. */
function tried(drill: { recent: number[]; lastOn?: string }): boolean {
  return drill.recent.length > 0 || drill.lastOn !== undefined;
}

function levelTops(done: (id: string) => boolean): Record<string, number> {
  return {
    rhythm: Math.min(RHYTHM_LEVELS, rhythmLevelCap(done)),
    ear: EAR_LEVELS,
    sight: Math.min(SIGHT_LEVELS, sightLevelCap(done)),
    chords: Math.min(CHORD_LEVELS, chordLevelCap(done)),
    technique: Math.min(TECH_LEVELS, techniqueLevelCap(done)),
  };
}

/** The level an untried exercise starts at for someone who knows this many stages. It finds its own level from there. */
export function startingLevel(stagesKnown: number, top: number): number {
  return Math.max(1, Math.min(top, 1 + Math.ceil(stagesKnown / 2)));
}

function seedLevels(stagesKnown: number): void {
  const done = (id: string) => usePiano.getState().lessons[id]?.done === true;
  for (const [kind, top] of Object.entries(levelTops(done))) {
    const had = usePiano.getState().drills[kind];
    // An exercise the learner has already worked at keeps the level it found.
    if (had && tried(had)) continue;
    const level = startingLevel(stagesKnown, top);
    if (level > 1) usePiano.getState().setDrillLevel(kind, level);
  }
}
