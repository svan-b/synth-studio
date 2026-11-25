/**
 * Schedules musical events against the audio clock.
 *
 * Events sit on a timeline in beats. A short timer looks a little way ahead
 * and hands each event the exact audio time it should sound, which keeps
 * playback steady even when the screen is busy.
 */

import { shapeNoteOn } from '../music/chords';
import type { Score, Step } from '../music/score';
import { measureBeats, pulseBeats, type TimeSig } from '../music/theory';
import { guitar } from './engine';

export interface TimedEvent {
  beat: number;
  run: (when: number) => void;
}

export interface TransportOptions {
  bpm: number;
  /** Beat that plays first. Negative gives a count in. */
  fromBeat: number;
  /** Seconds before the first beat, so nothing is cut off. */
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
    this.t0 = guitar.now() + (opts.lead ?? 0.12);
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

  /** Audio time at which a beat sounds. */
  timeOfBeat(beat: number): number {
    return this.t0 + (beat - this.fromBeat) * this.secondsPerBeat;
  }

  /** Beat at an audio time, now by default. */
  beatAt(time: number = guitar.now()): number {
    return this.fromBeat + (time - this.t0) / this.secondsPerBeat;
  }

  get beatSeconds(): number {
    return this.secondsPerBeat;
  }

  private tick(): void {
    if (!this.running) return;
    const horizon = guitar.now() + LOOKAHEAD;
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
    if (this.index >= this.events.length && guitar.now() >= this.timeOfBeat(this.endBeat)) {
      const done = this.onDone;
      this.stop();
      done?.();
    }
  }
}

/** For a score, the beat at which the measure holding a beat begins. Before the music, measures are counted back from the first full one. */
export function measureStartFor(score: Score): (beat: number) => number {
  const mLen = measureBeats(score.time);
  return (beat: number): number => {
    if (beat < score.pickup - 1e-9 || beat < 0) {
      const first = score.pickup > 0 ? score.pickup - mLen : 0;
      return first + Math.floor((beat - first) / mLen + 1e-9) * mLen;
    }
    let start = 0;
    for (const s of score.measureStarts) if (s <= beat + 1e-9) start = s;
    return start;
  };
}

/** Metronome clicks over [fromBeat, toBeat), one per counted beat, the first of each measure accented. */
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
  let b = measureStart(fromBeat);
  while (b < toBeat - 1e-6) {
    if (b >= fromBeat - 1e-6) {
      const inMeasure = (((b - measureStart(b)) % mLen) + mLen) % mLen;
      const accent = inMeasure < 1e-6;
      const beat = b;
      out.push({
        beat,
        run: (when) => {
          if (audible) guitar.click(when, accent);
          onPulse?.(beat, accent, when);
        },
      });
    }
    b += pulse;
  }
  return out;
}

/** Play one step of a score: its strum, or its notes. Returns when it ends. */
export function playStep(step: Step, when: number, secondsPerBeat: number, velocity = 0.75): number {
  if (step.strum) {
    const ev = step.strum;
    // Strums on the beat are a little firmer than those between.
    const onBeat = Math.abs(ev.start - Math.round(ev.start)) < 1e-6;
    const v = velocity * (ev.dir === 'up' ? 0.85 : onBeat ? 1 : 0.92);
    const notes = ev.strings.map((string) => ({ string, midi: shapeNoteOn(ev.shape, string) as number }));
    return guitar.strum(notes, when, { dir: ev.dir, velocity: v, spread: secondsPerBeat < 0.45 ? 0.009 : 0.012 });
  }
  let ends = when;
  for (const n of step.notes) {
    ends = Math.max(ends, guitar.pluck(n.midi, when, { velocity, string: n.place.string }));
  }
  return ends;
}

export interface PlaybackOptions {
  velocity?: number;
  /** Called a moment before each step sounds. */
  onStep?: (index: number, when: number) => void;
}

/** Events that play a whole score, for a Transport. */
export function scoreEvents(score: Score, secondsPerBeat: number, opts: PlaybackOptions = {}): TimedEvent[] {
  return score.steps.map((step) => ({
    beat: step.start,
    run: (when: number) => {
      playStep(step, when, secondsPerBeat, opts.velocity ?? 0.75);
      opts.onStep?.(step.index, when);
    },
  }));
}
