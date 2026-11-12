/**
 * Where the app's own piano playing goes: the sampled piano in the iPad, or
 * the connected digital piano itself, played over MIDI with its own sound.
 */

import { piano } from './engine';
import { midi } from '../input/midi';
import { listener } from '../input/listen';

export const instrument = {
  /** Send demonstrations to the connected piano when it can receive them. */
  preferPiano: false,

  get onPiano(): boolean {
    return this.preferPiano && midi.hasOutput;
  },

  play(note: number, seconds: number, velocity = 0.7, when?: number): void {
    const t = when ?? piano.now();
    if (this.onPiano) midi.playNote(note, seconds, velocity, t);
    else piano.play(note, seconds, velocity, t);
    // Do not mistake the app's own playing for the learner's.
    listener.suppress(t + seconds + 0.3);
  },

  stop(): void {
    piano.allOff();
    midi.silence();
  },
};
