/**
 * Plays back a take: what the learner themselves played in a run, key for
 * key, with their own timing and touch. Hearing it from the outside shows
 * things that are hard to notice while playing.
 */

import type { Take } from '../engine/flow';
import { midi } from '../input/midi';
import type { Score, Step } from '../music/score';
import { piano } from './engine';
import { instrument } from './instrument';
import { Transport, clickEvents, measureStartFor, type TimedEvent } from './transport';

export interface ReplayOptions {
  /** The music the take was played from. Needed for the click and for following along. */
  score?: Score;
  /** Sound the beat the take was played to. Only a take made with a beat has one. */
  click?: boolean;
  /** A key going down or coming up, for lighting the keyboard. */
  onKey?: (midiNote: number, down: boolean) => void;
  /** The steps the cursor follows. Defaults to every step in the music. */
  steps?: Step[];
  /** Each step of the music going by, for moving a cursor. Only with a beat. */
  onStep?: (index: number) => void;
  onDone?: () => void;
}

/** The longest silence kept when the music waited. A long search for a note is not part of the tune. */
const LONGEST_GAP = 1.4;

/** When each key of a take should sound on playback, in seconds from its start. */
export function playbackTimes(take: Take): number[] {
  if (take.bpm > 0) return take.notes.map((n) => n[1]);
  // Without a beat, pauses are shortened so the tune can be heard as a tune.
  const order = take.notes.map((n, i) => ({ at: n[1], i })).sort((a, b) => a.at - b.at);
  const out = new Array<number>(take.notes.length).fill(0);
  let shift = 0;
  let last = 0;
  for (const { at, i } of order) {
    if (at - last > LONGEST_GAP) shift += at - last - LONGEST_GAP;
    last = at;
    out[i] = at - shift;
  }
  return out;
}

/** How long a take lasts when played back, in seconds. */
export function playbackSeconds(take: Take): number {
  const times = playbackTimes(take);
  return take.notes.reduce((end, n, i) => Math.max(end, times[i] + n[2]), 0);
}

export class TakePlayer {
  private transport = new Transport();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private pedalDown = false;
  playing = false;

  private at(when: number, fn: () => void): void {
    const t = setTimeout(
      () => {
        this.timers.delete(t);
        if (this.playing) fn();
      },
      Math.max(0, (when - piano.now()) * 1000),
    );
    this.timers.add(t);
  }

  private pedal(down: boolean): void {
    if (this.pedalDown === down) return;
    this.pedalDown = down;
    if (instrument.onPiano) midi.send([0xb0, 64, down ? 127 : 0]);
    else piano.setPedal(down);
  }

  play(take: Take, opts: ReplayOptions = {}): void {
    this.stop();
    if (take.notes.length === 0) {
      opts.onDone?.();
      return;
    }
    const times = playbackTimes(take);
    const beat = take.bpm > 0 ? 60 / take.bpm : 0;
    // The transport counts in beats. Here one beat is one second.
    const events: TimedEvent[] = take.notes.map((n, i) => ({
      beat: times[i],
      run: (when: number) => {
        // The learner's own strength, as it was played.
        instrument.play(n[0], Math.max(0.05, n[2]), n[3], when, true);
        if (opts.onKey) {
          this.at(when, () => opts.onKey?.(n[0], true));
          this.at(when + Math.max(0.08, n[2]) - 0.02, () => opts.onKey?.(n[0], false));
        }
      },
    }));
    if (take.bpm > 0) {
      for (const [at, state] of take.pedal) events.push({ beat: Math.max(0, at), run: (when) => this.at(when, () => this.pedal(state === 1)) });
    }
    const score = opts.score;
    if (score && beat > 0) {
      if (opts.click) {
        for (const ev of clickEvents(score.time, 0, score.totalBeats, measureStartFor(score))) {
          events.push({ beat: take.lead + ev.beat * beat, run: ev.run });
        }
      }
      if (opts.onStep) {
        (opts.steps ?? score.steps).forEach((step, index) => {
          events.push({ beat: take.lead + step.start * beat, run: (when) => this.at(when, () => opts.onStep?.(index)) });
        });
      }
    }
    const end = Math.max(playbackSeconds(take), score && beat > 0 ? take.lead + score.totalBeats * beat : 0) + 0.4;
    this.playing = true;
    this.transport.start(events, end, {
      bpm: 60,
      fromBeat: 0,
      lead: 0.2,
      onDone: () => {
        this.finish();
        opts.onDone?.();
      },
    });
  }

  private finish(): void {
    this.playing = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.pedal(false);
  }

  /** Stop at once, and silence what is sounding. */
  stop(): void {
    if (!this.playing) return;
    this.transport.stop();
    this.finish();
    instrument.stop();
  }
}
