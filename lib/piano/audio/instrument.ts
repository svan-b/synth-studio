/**
 * Where the app's own piano playing goes: the sampled piano in the iPad, or
 * the connected digital piano itself, played over MIDI with its own sound.
 */

import { piano } from './engine';
import { midi } from '../input/midi';
import { listener } from '../input/listen';

/** The strength the app's own playing is written at. */
const WRITTEN = 0.68;

export const instrument = {
  /**
   * Where demonstrations sound. Left to the app, they go to the piano
   * whenever it can receive them: its own sound through its own speakers is
   * the only thing as loud as the learner's playing.
   */
  where: 'auto' as 'auto' | 'piano' | 'ipad',

  get onPiano(): boolean {
    return this.where !== 'ipad' && midi.hasOutput;
  },

  /** How firmly the app plays on the piano: as firmly as the learner does, once that is known. */
  get level(): number {
    return Math.min(0.95, Math.max(0.5, midi.typicalTouch ?? 0.75));
  },

  /**
   * Play a note. On the piano, the written strength is scaled so that the
   * app's playing is as loud as the learner's own. `exact` plays the strength
   * as given, as when a learner's own take is played back.
   */
  play(note: number, seconds: number, velocity = 0.7, when?: number, exact = false): void {
    const t = when ?? piano.now();
    // A note sent to the piano sounds at once, while the iPad's own sound, the click with it, is
    // heard a little after it is sent, and much after over Bluetooth. The piano's note waits that
    // long, so that everything the learner hears lines up.
    if (this.onPiano) midi.playNote(note, seconds, exact ? velocity : Math.min(1, Math.max(0.2, velocity * (this.level / WRITTEN))), t + piano.outputLatency());
    else piano.play(note, seconds, velocity, t);
    // Do not mistake the app's own playing for the learner's.
    listener.suppress(t + seconds + 0.3);
  },

  /** The small chime for finishing something. The listening input is told not to take it for playing. */
  chime(): void {
    piano.chime();
    listener.suppress(piano.now() + 0.75);
  },

  stop(): void {
    piano.allOff();
    midi.silence();
  },
};
