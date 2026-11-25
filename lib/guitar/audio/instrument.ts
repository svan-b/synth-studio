/**
 * The app playing guitar for the learner to hear: demonstrations, reference
 * notes for tuning, and the chime. The microphone hears all of it too, so
 * the listener is told to let each sound pass.
 */

import type { Score, Step } from '../music/score';
import type { StringNo } from '../music/theory';
import { listener } from '../input/listen';
import { guitar } from './engine';
import { Transport, playStep, scoreEvents, type TimedEvent } from './transport';

/** How long after the app plays something the microphone keeps ignoring new sounds. The note rings on, but a ringing note starts nothing new. */
const QUIET = 0.3;

export const instrument = {
  pluck(midi: number, when?: number, opts: { velocity?: number; string?: StringNo | null; seconds?: number } = {}): number {
    const t = when ?? guitar.now();
    const ends = guitar.pluck(midi, t, opts);
    listener.suppress(t + QUIET);
    return ends;
  },

  strum(notes: Array<{ string: StringNo; midi: number }>, when?: number, opts: { dir?: 'down' | 'up'; velocity?: number } = {}): number {
    const t = when ?? guitar.now();
    const ends = guitar.strum(notes, t, opts);
    listener.suppress(t + 0.08 + QUIET);
    return ends;
  },

  step(step: Step, when: number, secondsPerBeat: number, velocity?: number): number {
    const ends = playStep(step, when, secondsPerBeat, velocity);
    listener.suppress(when + 0.08 + QUIET);
    return ends;
  },

  /** A held reference note for tuning by ear. The tuner ignores it while it sounds. */
  reference(midi: number, string: StringNo): number {
    const t = guitar.now() + 0.02;
    const ends = guitar.pluck(midi, t, { velocity: 0.85, string, seconds: 2.5 });
    listener.suppress(ends);
    return ends;
  },

  chime(): void {
    guitar.chime();
    listener.suppress(guitar.now() + 0.9);
  },

  stop(): void {
    guitar.stopAll();
  },
};

/**
 * Play a score through once, for the learner to hear. Calls `onStep` as each
 * step sounds and `onDone` at the end. Returns a function that stops it.
 */
export function playScore(score: Score, opts: { bpm?: number; onStep?: (index: number) => void; onDone?: () => void; lead?: number } = {}): () => void {
  const bpm = opts.bpm ?? score.tempo;
  const spb = 60 / bpm;
  const transport = new Transport();
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const events = scoreEvents(score, spb, {
    onStep: (index, when) => {
      listener.suppress(when + 0.08 + QUIET);
      if (opts.onStep) {
        const delay = Math.max(0, (when - guitar.now()) * 1000);
        timers.push(setTimeout(() => opts.onStep?.(index), delay));
      }
    },
  });
  // Let the last chord ring a moment before saying it is done.
  transport.start(events, score.totalBeats + 0.5, { bpm, fromBeat: 0, lead: opts.lead ?? 0.15, onDone: () => opts.onDone?.() });
  return () => {
    transport.stop();
    timers.forEach((t) => clearTimeout(t));
    guitar.stopAll();
  };
}

/**
 * Play a song's chords with its tune over them, on one clock. The tune may
 * start before the chords, on its pickup. `onStep` follows the chords, which
 * is what the chart shows.
 */
export function playSong(chords: Score, melody: Score | null, opts: { bpm?: number; onStep?: (index: number) => void; onDone?: () => void; lead?: number } = {}): () => void {
  if (!melody) return playScore(chords, opts);
  const bpm = opts.bpm ?? chords.tempo;
  const spb = 60 / bpm;
  const offset = melody.pickup;
  const transport = new Transport();
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const events: TimedEvent[] = [
    // The chords a little under the tune, so the tune can be heard.
    ...scoreEvents(chords, spb, {
      velocity: 0.62,
      onStep: (index, when) => {
        listener.suppress(when + 0.08 + QUIET);
        if (opts.onStep) timers.push(setTimeout(() => opts.onStep?.(index), Math.max(0, (when - guitar.now()) * 1000)));
      },
    }).map((e) => ({ ...e, beat: e.beat + offset })),
    ...melody.steps.map((st) => ({
      beat: st.start,
      run: (when: number) => {
        for (const n of st.notes) guitar.pluck(n.midi, when, { velocity: 0.9, string: null, seconds: Math.max(0.25, n.dur * spb * 1.1) });
        listener.suppress(when + QUIET);
      },
    })),
  ];
  transport.start(events, Math.max(chords.totalBeats + offset, melody.totalBeats) + 0.5, { bpm, fromBeat: 0, lead: opts.lead ?? 0.15, onDone: () => opts.onDone?.() });
  return () => {
    transport.stop();
    timers.forEach((t) => clearTimeout(t));
    guitar.stopAll();
  };
}

