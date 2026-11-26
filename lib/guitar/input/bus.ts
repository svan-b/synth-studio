/**
 * One stream of what the guitar did, whatever heard it: the microphone, or
 * the development robot playing into the same detector.
 *
 * Two kinds of event. A note is a pitch the detector could name. A strike is
 * any pluck or strum it heard, with the chord it sounded like, named or not:
 * a muted strum is a strike with no notes.
 */

import { Emitter } from '../util/emitter';

export type NoteSource = 'mic' | 'touch';

export interface NoteInput {
  midi: number;
  /** 0 to 1, rough. */
  velocity: number;
  /** Audio clock time of the onset, in seconds. */
  time: number;
  source: NoteSource;
  /** Accepted because the music expected it, as against found blind. */
  assisted: boolean;
}

export interface StrikeInput {
  time: number;
  strength: number;
  novelty: number;
  /** The struck sound on the twelve notes of the scale, C first, or empty when nothing pitched was heard. */
  chroma: number[];
  source: NoteSource;
}

export const noteBus = new Emitter<NoteInput>();
export const strikeBus = new Emitter<StrikeInput>();

/** The last few notes and strikes, so a run can take in what was played a moment before it began. */
export const recentNotes: NoteInput[] = [];
export const recentStrikes: StrikeInput[] = [];

export function emitNote(ev: NoteInput): void {
  recentNotes.push(ev);
  if (recentNotes.length > 24) recentNotes.shift();
  noteBus.emit(ev);
}

export function emitStrike(ev: StrikeInput): void {
  recentStrikes.push(ev);
  if (recentStrikes.length > 12) recentStrikes.shift();
  strikeBus.emit(ev);
}
