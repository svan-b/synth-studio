/**
 * Schedules musical events against the audio clock.
 *
 * Events are placed on a timeline measured in beats. A short timer looks a
 * little way ahead and hands each event the exact audio time it should
 * sound, which keeps playback steady even when the screen is busy.
 */

import type { Hand, TimeSig } from '../music/theory';
import { measureBeats, pulseBeats } from '../music/theory';
import type { Score } from '../music/score';
import { piano } from './engine';
import { instrument } from './instrument';

export interface TimedEvent {
  beat: number;
  run: (when: number) => void;
}

export interface TransportOptions {
  bpm: number;
  /** Beat position that plays first. Negative values give a lead in. */
  fromBeat: number;
  /** Seconds to wait before the first beat, so nothing is cut off. */
  lead?: number;
  onDone?: () => void;
}

const LOOKAHEAD = 0.14;
const INTERVAL_MS = 25;

export class Transport {
  private timer: ReturnType<typeof setInterval> | null = null;
  private events: TimedEvent[] = [];
  private index = 0;
  private t0 = 0;
  private fromBeat = 0;
  private secondsPerBeat = 0.75;
  private endBeat = 0;
  private onDone?: () => void;
  running = false;

  start(events: TimedEvent[], endBeat: number, opts: TransportOptions): void {
    this.stop();
    this.events = events.slice().sort((a, b) => a.beat - b.beat);
    this.index = 0;
    this.fromBeat = opts.fromBeat;
    this.secondsPerBeat = 60 / opts.bpm;
    this.endBeat = endBeat;
    this.onDone = opts.onDone;
    this.t0 = piano.now() + (opts.lead ?? 0.12);
    this.running = true;
    this.tick();
    this.timer = setInterval(() => this.tick(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.events = [];
  }

  /** Audio time at which a beat position sounds. */
  timeOfBeat(beat: number): number {
    return this.t0 + (beat - this.fromBeat) * this.secondsPerBeat;
  }

  /** Beat position for an audio time, defaults to now. */
  beatAt(time: number = piano.now()): number {
    return this.fromBeat + (time - this.t0) / this.secondsPerBeat;
  }

  get beatSeconds(): number {
    return this.secondsPerBeat;
  }

  private tick(): void {
    if (!this.running) return;
    const horizon = piano.now() + LOOKAHEAD;
    while (this.index < this.events.length) {
      const ev = this.events[this.index];
      const when = this.timeOfBeat(ev.beat);
      if (when > horizon) break;
      this.index++;
      try {
        ev.run(when);
      } catch {
        /* one bad event must not stop the clock */
      }
    }
    if (this.index >= this.events.length && piano.now() >= this.timeOfBeat(this.endBeat)) {
      const done = this.onDone;
      this.stop();
      done?.();
    }
  }
}

/** Metronome clicks covering [fromBeat, toBeat), aligned to measures. */
export function clickEvents(
  time: TimeSig,
  fromBeat: number,
  toBeat: number,
  measureStart: (beat: number) => number,
  onPulse?: (beat: number, accent: boolean, when: number) => void,
  audible = true,
): TimedEvent[] {
  const out: TimedEvent[] = [];
  const pulse = pulseBeats(time);
  const mLen = measureBeats(time);
  // Walk pulse by pulse from the measure that contains fromBeat.
  let b = measureStart(fromBeat);
  while (b < toBeat - 1e-6) {
    if (b >= fromBeat - 1e-6) {
      const inMeasure = (((b - measureStart(b)) % mLen) + mLen) % mLen;
      const accent = inMeasure < 1e-6;
      const beat = b;
      out.push({
        beat,
        run: (when) => {
          if (audible) piano.click(when, accent);
          onPulse?.(beat, accent, when);
        },
      });
    }
    b += pulse;
  }
  return out;
}

export interface PlaybackOptions {
  hands?: Hand[];
  velocity?: number;
  /** Called on the audio thread schedule, slightly ahead of the sound. */
  onNote?: (noteId: string, when: number, midi: number, seconds: number) => void;
  /** Make the melody hand slightly louder than the accompaniment. */
  voicing?: boolean;
}

/** Note events for a score, to be given to a Transport. */
export function scoreEvents(score: Score, secondsPerBeat: number, opts: PlaybackOptions = {}): TimedEvent[] {
  const hands = opts.hands ?? score.hands;
  const base = opts.velocity ?? 0.68;
  const both = hands.length > 1 && opts.voicing !== false;
  return score.notes
    .filter((n) => !n.tied && hands.includes(n.hand))
    .map((n) => ({
      beat: n.start,
      run: (when: number) => {
        // Hold notes for almost their full length, like a legato touch.
        const seconds = Math.max(0.08, n.dur * secondsPerBeat * 0.96);
        const v = both ? (n.hand === 'R' ? base + 0.06 : base - 0.12) : base;
        instrument.play(n.midi, seconds, v, when);
        opts.onNote?.(n.id, when, n.midi, seconds);
      },
    }));
}
