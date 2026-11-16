/**
 * One stream of note events for the whole app, whatever the source:
 * the on screen keyboard, a MIDI keyboard, or a real piano heard through
 * the microphone.
 */

import { Emitter } from '../util/emitter';

export type NoteSource = 'touch' | 'midi' | 'mic' | 'keys';

export interface NoteInput {
  type: 'on' | 'off';
  midi: number;
  /** 0 to 1. The microphone reports a rough loudness. */
  velocity: number;
  /** Audio clock time in seconds. */
  time: number;
  source: NoteSource;
}

export const noteBus = new Emitter<NoteInput>();

/** Notes currently held down, for display. */
export const heldNotes = new Set<number>();

noteBus.subscribe((ev) => {
  if (ev.type === 'on') heldNotes.add(ev.midi);
  else heldNotes.delete(ev.midi);
});

/** The last few keys struck, so a run can pick up notes played a moment before it began. */
export const recentNotes: NoteInput[] = [];

export function emitNoteOn(midi: number, velocity: number, time: number, source: NoteSource): void {
  const ev: NoteInput = { type: 'on', midi, velocity, time, source };
  recentNotes.push(ev);
  if (recentNotes.length > 24) recentNotes.shift();
  noteBus.emit(ev);
}

export function emitNoteOff(midi: number, time: number, source: NoteSource): void {
  noteBus.emit({ type: 'off', midi, velocity: 0, time, source });
}
