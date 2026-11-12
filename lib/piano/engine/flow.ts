/**
 * The score follower. It listens to notes from any input and compares them
 * with what the score expects.
 *
 * Two modes:
 *   wait   The music waits for the right notes. No time pressure, which is
 *          how new material should be learned. A hint appears only after a
 *          pause or two wrong tries, so the learner recalls before being shown.
 *   tempo  The music moves with a metronome and each note is judged for
 *          pitch and timing.
 */

import { piano } from '../audio/engine';
import { Transport, clickEvents, scoreEvents, type TimedEvent } from '../audio/transport';
import { noteBus, type NoteInput, type NoteSource } from '../input/bus';
import { input, isRemoteKey } from '../input/hub';
import type { NoteEvent, Score, Step } from '../music/score';
import { stepsFor } from '../music/score';
import { measureBeats, type Hand } from '../music/theory';
import { Emitter, clamp } from '../util/emitter';

export type FlowMode = 'wait' | 'tempo';
export type FlowPhase = 'ready' | 'countin' | 'playing' | 'done' | 'stopped';
export type NoteState = 'ok' | 'warn' | 'bad';

export interface FlowOptions {
  mode: FlowMode;
  /** Hands the learner plays. */
  hands: Hand[];
  /** Quarter notes per minute, used in tempo mode. */
  bpm?: number;
  /** Wait mode: milliseconds before the next key is shown. 0 shows it at once, Infinity never. */
  hintDelayMs?: number;
  /** Wait mode: wrong tries on one step before the key is shown. */
  hintAfterWrong?: number;
  /** Tempo mode: the app plays the hands the learner is not playing. */
  accompany?: boolean;
  /** Tempo mode: audible metronome. */
  metronome?: boolean;
  /** Extra seconds of input delay to subtract, per source, from calibration. */
  latency?: Partial<Record<NoteSource, number>>;
  /** Judge timing only and accept any key. Used for rhythm work. */
  anyPitch?: boolean;
}

export type FlowEvent =
  | { type: 'phase'; phase: FlowPhase }
  | { type: 'step'; index: number }
  | { type: 'note'; id: string; state: NoteState; midi: number }
  | { type: 'wrong'; midi: number }
  | { type: 'hint'; index: number; notes: NoteEvent[] }
  | { type: 'pulse'; beat: number; accent: boolean; countIn: boolean; number: number }
  | { type: 'done'; result: FlowResult };

export interface MeasureStat {
  /** Measure index in the full piece. */
  measure: number;
  notes: number;
  errors: number;
  hesitations: number;
}

export interface FlowResult {
  mode: FlowMode;
  hands: Hand[];
  bpm: number;
  totalNotes: number;
  /** Notes played right the first time (wait) or matched in time (tempo). */
  correctNotes: number;
  /** Keys pressed that the score did not ask for. */
  wrongNotes: number;
  missedNotes: number;
  hintedSteps: number;
  totalSteps: number;
  /** 0 to 1. */
  accuracy: number;
  /** Tempo mode: share of matched notes that landed close to the beat. */
  onTime: number;
  /** Tempo mode: average distance from the beat in milliseconds. */
  meanAbsMs: number;
  /** Tempo mode: positive means late on average. */
  biasMs: number;
  /** Wait mode: share of steps played without a long pause. */
  fluency: number;
  perMeasure: MeasureStat[];
  seconds: number;
  /** A pass with no hints and almost no errors. */
  clean: boolean;
  /** Average strike strength of the right notes, 0 to 1, or null when the input cannot tell. */
  velocity: number | null;
  /** The notes came through the microphone, which mishears the odd one. */
  byEar: boolean;
}

/** Typical delay between an action and the app hearing about it. */
const DEFAULT_LATENCY: Record<NoteSource, number> = { touch: 0.045, midi: 0.008, mic: 0.07, keys: 0.02 };

/** The session now running, for development tools and tests. */
export const activeFlow: { current: FlowSession | null } = { current: null };

export class FlowSession {
  readonly events = new Emitter<FlowEvent>();
  readonly steps: Step[];
  readonly options: Required<Omit<FlowOptions, 'latency'>> & { latency: Record<NoteSource, number> };
  phase: FlowPhase = 'ready';

  private unsub: (() => void) | null = null;
  private transport = new Transport();
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private startedAt = 0;

  private byEar = false;

  // wait mode
  private stepIndex = 0;
  private pending = new Set<string>();
  private stepWrong = 0;
  private stepHinted = false;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private stepTimes: number[] = [];
  private lastStepAt = 0;

  // tempo mode
  private matched = new Map<string, number>();
  private missed = new Set<string>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private lastOn = new Map<number, number>();

  // totals
  private firstTry = 0;
  private wrong = 0;
  private hinted = 0;
  private measureErrors = new Map<number, number>();
  private velocitySum = 0;
  private velocityCount = 0;
  private readonly notes: NoteEvent[];
  private readonly pitches: Set<number>;

  constructor(
    readonly score: Score,
    opts: FlowOptions,
  ) {
    const hands = opts.hands.filter((h) => score.hands.includes(h));
    this.options = {
      mode: opts.mode,
      hands: hands.length > 0 ? hands : score.hands,
      bpm: opts.bpm ?? score.tempo,
      hintDelayMs: opts.hintDelayMs ?? 3500,
      hintAfterWrong: opts.hintAfterWrong ?? 2,
      accompany: opts.accompany ?? false,
      metronome: opts.metronome ?? true,
      anyPitch: opts.anyPitch ?? false,
      latency: { ...DEFAULT_LATENCY, ...(opts.latency ?? {}) },
    };
    this.steps = stepsFor(score, this.options.hands);
    this.notes = this.steps.flatMap((s) => s.notes);
    this.pitches = new Set(this.notes.map((n) => n.midi));
  }

  get mode(): FlowMode {
    return this.options.mode;
  }

  start(): void {
    if (this.phase !== 'ready') return;
    this.unsub = noteBus.subscribe((ev) => this.onInput(ev));
    this.startedAt = piano.now();
    activeFlow.current = this;
    if (this.steps.length === 0) {
      this.finish();
      return;
    }
    if (this.options.mode === 'wait') this.startWait();
    else this.startTempo();
  }

  /** Abandon the run without a result. */
  stop(): void {
    if (this.phase === 'done' || this.phase === 'stopped') return;
    this.cleanup();
    this.setPhase('stopped');
  }

  /** Audio time at which a note is due, in tempo mode. */
  targetTime(note: NoteEvent): number {
    return this.transport.timeOfBeat(note.start);
  }

  /** Seconds of delay assumed for an input source. */
  latencyFor(source: NoteSource): number {
    return this.options.latency[source];
  }

  private cleanup(): void {
    if (activeFlow.current === this) activeFlow.current = null;
    this.unsub?.();
    this.unsub = null;
    this.transport.stop();
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    input.expect(null);
  }

  private setPhase(phase: FlowPhase): void {
    this.phase = phase;
    this.events.emit({ type: 'phase', phase });
  }

  private onInput(ev: NoteInput): void {
    if (ev.type !== 'on' || this.phase !== 'playing') return;
    if (ev.source === 'mic') this.byEar = true;
    // The top and bottom keys are buttons for the app, unless the music uses them.
    if (ev.source === 'midi' && input.remoteKeys && isRemoteKey(ev.midi) && !this.pitches.has(ev.midi) && !this.options.anyPitch) return;
    if (this.options.mode === 'wait') this.waitInput(ev);
    else this.tempoInput(ev);
  }

  private noteVelocity(ev: NoteInput): void {
    // A microphone hears loudness only roughly, so it is left out.
    if (ev.source === 'mic') return;
    this.velocitySum += ev.velocity;
    this.velocityCount++;
  }

  private addMeasureError(measure: number): void {
    const m = measure + this.score.measureOffset;
    this.measureErrors.set(m, (this.measureErrors.get(m) ?? 0) + 1);
  }

  // ------------------------------------------------------------------ wait

  private startWait(): void {
    this.setPhase('playing');
    this.stepIndex = 0;
    this.activateStep();
  }

  private activateStep(): void {
    const step = this.steps[this.stepIndex];
    this.pending = new Set(step.notes.map((n) => n.id));
    this.stepWrong = 0;
    this.stepHinted = false;
    this.lastStepAt = piano.now();
    input.expect(step.notes.map((n) => n.midi));
    this.events.emit({ type: 'step', index: this.stepIndex });
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    const delay = this.options.hintDelayMs;
    if (delay <= 0) this.revealHint();
    else if (Number.isFinite(delay)) this.hintTimer = setTimeout(() => this.revealHint(), delay);
  }

  private revealHint(): void {
    if (this.phase !== 'playing' || this.stepHinted) return;
    this.stepHinted = true;
    // A hint shown from the start is a guide, not a rescue, so it is not counted.
    if (this.options.hintDelayMs > 0) this.hinted++;
    const step = this.steps[this.stepIndex];
    this.events.emit({ type: 'hint', index: this.stepIndex, notes: step.notes.filter((n) => this.pending.has(n.id)) });
  }

  private waitInput(ev: NoteInput): void {
    const step = this.steps[this.stepIndex];
    const match = step.notes.find((n) => this.pending.has(n.id) && (n.midi === ev.midi || this.options.anyPitch));
    if (match) {
      this.pending.delete(match.id);
      this.noteVelocity(ev);
      const rescued = this.stepWrong > 0 || (this.stepHinted && this.options.hintDelayMs > 0);
      if (!rescued) this.firstTry++;
      this.events.emit({ type: 'note', id: match.id, state: rescued ? 'warn' : 'ok', midi: match.midi });
      if (this.pending.size === 0) this.completeStep();
      return;
    }
    // Pressing a chord note again is harmless.
    if (step.notes.some((n) => n.midi === ev.midi)) return;
    // A microphone can report the previous note twice while it rings on.
    if (ev.source === 'mic' && this.stepIndex > 0) {
      const prev = this.steps[this.stepIndex - 1];
      if (prev.notes.some((n) => n.midi === ev.midi) && ev.time - this.lastStepAt < 0.35) return;
    }
    this.stepWrong++;
    this.wrong++;
    this.addMeasureError(step.measure);
    this.events.emit({ type: 'wrong', midi: ev.midi });
    if (this.stepWrong >= this.options.hintAfterWrong) this.revealHint();
  }

  private completeStep(): void {
    this.stepTimes.push(piano.now());
    this.stepIndex++;
    if (this.stepIndex >= this.steps.length) {
      this.finish();
    } else {
      this.activateStep();
    }
  }

  // ----------------------------------------------------------------- tempo

  private get beatSeconds(): number {
    return 60 / this.options.bpm;
  }

  private get matchWindow(): number {
    return clamp(0.45 * this.beatSeconds, 0.16, 0.36);
  }

  private get onTimeWindow(): number {
    return clamp(0.2 * this.beatSeconds, 0.08, 0.14);
  }

  private startTempo(): void {
    const score = this.score;
    const mLen = measureBeats(score.time);
    // Count in one full measure, shortened by any pickup the music starts with.
    const countIn = score.pickup > 0 ? mLen - score.pickup + mLen : mLen;
    const fromBeat = -countIn;
    const measureStart = (beat: number): number => {
      // Before the first full measure, bars are counted back from the pickup.
      if (beat < score.pickup - 1e-9 || beat < 0) {
        const first = score.pickup > 0 ? score.pickup - mLen : 0;
        return first + Math.floor((beat - first) / mLen + 1e-9) * mLen;
      }
      let start = 0;
      for (let i = 0; i < score.measureStarts.length; i++) {
        if (score.measureStarts[i] <= beat + 1e-9) start = score.measureStarts[i];
      }
      return start;
    };

    let pulseNumber = 0;
    let lastMeasure = NaN;
    const events: TimedEvent[] = clickEvents(
      score.time,
      fromBeat,
      score.totalBeats,
      measureStart,
      (beat, accent, when) => {
        const ms = measureStart(beat);
        if (ms !== lastMeasure) {
          lastMeasure = ms;
          pulseNumber = 0;
        }
        pulseNumber++;
        const number = pulseNumber;
        this.at(when, () => this.events.emit({ type: 'pulse', beat, accent, countIn: beat < -1e-6, number }));
      },
      this.options.metronome,
    );
    // The count in is always audible, even with the metronome off.
    if (!this.options.metronome) {
      events.push(
        ...clickEvents(score.time, fromBeat, 0, measureStart, undefined, true),
      );
    }

    if (this.options.accompany) {
      const others = score.hands.filter((h) => !this.options.hands.includes(h));
      if (others.length > 0) {
        events.push(...scoreEvents(score, this.beatSeconds, { hands: others, velocity: 0.55, voicing: false }));
      }
    }

    this.steps.forEach((step, index) => {
      events.push({
        beat: step.start,
        run: (when) => this.at(when, () => this.events.emit({ type: 'step', index })),
      });
      // A listening input hears best when told what is coming: this step and the next.
      const upcoming = [...step.notes, ...(this.steps[index + 1]?.notes ?? [])].map((n) => n.midi);
      events.push({
        beat: step.start - 0.35,
        run: (when) => this.at(when, () => input.expect(upcoming)),
      });
    });
    // Start listening a little before the first beat, so an early first note still counts.
    events.push({
      beat: -this.matchWindow / this.beatSeconds,
      run: (when) => this.at(when, () => this.setPhase('playing')),
    });

    this.setPhase('countin');
    this.transport.start(events, score.totalBeats + 0.75, {
      bpm: this.options.bpm,
      fromBeat,
      lead: 0.25,
      onDone: () => this.finish(),
    });
    this.ticker = setInterval(() => this.sweepMissed(), 60);
  }

  /** Run a callback when the audio clock reaches a time. */
  private at(when: number, fn: () => void): void {
    const delay = Math.max(0, (when - piano.now()) * 1000);
    const t = setTimeout(() => {
      if (this.phase !== 'done' && this.phase !== 'stopped') fn();
    }, delay);
    this.timers.push(t);
  }

  private tempoInput(ev: NoteInput): void {
    const t = ev.time - piano.outputLatency() - this.options.latency[ev.source];
    // A microphone may report one strike twice in quick succession.
    const last = this.lastOn.get(ev.midi);
    if (ev.source === 'mic' && last !== undefined && ev.time - last < 0.09) return;
    this.lastOn.set(ev.midi, ev.time);

    let best: NoteEvent | null = null;
    let bestErr = Infinity;
    for (const n of this.notes) {
      if ((n.midi !== ev.midi && !this.options.anyPitch) || this.matched.has(n.id) || this.missed.has(n.id)) continue;
      const err = t - this.transport.timeOfBeat(n.start);
      if (Math.abs(err) <= this.matchWindow && Math.abs(err) < Math.abs(bestErr)) {
        best = n;
        bestErr = err;
      }
    }
    if (best) {
      this.noteVelocity(ev);
      this.matched.set(best.id, bestErr);
      const onTime = Math.abs(bestErr) <= this.onTimeWindow;
      this.events.emit({ type: 'note', id: best.id, state: onTime ? 'ok' : 'warn', midi: best.midi });
    } else {
      this.wrong++;
      const beat = this.transport.beatAt(t);
      const step = this.steps.reduce((a, s) => (s.start <= beat + 0.25 ? s : a), this.steps[0]);
      this.addMeasureError(step.measure);
      this.events.emit({ type: 'wrong', midi: ev.midi });
    }
  }

  private sweepMissed(): void {
    if (this.phase !== 'playing') return;
    const now = piano.now() - piano.outputLatency();
    for (const n of this.notes) {
      if (this.matched.has(n.id) || this.missed.has(n.id)) continue;
      if (this.transport.timeOfBeat(n.start) + this.matchWindow + 0.3 < now) {
        this.missed.add(n.id);
        this.addMeasureError(n.measure);
        this.events.emit({ type: 'note', id: n.id, state: 'bad', midi: n.midi });
      }
    }
  }

  // ---------------------------------------------------------------- finish

  private finish(): void {
    if (this.phase === 'done' || this.phase === 'stopped') return;
    if (this.options.mode === 'tempo') {
      // Anything still unmatched at the end was missed.
      for (const n of this.notes) {
        if (!this.matched.has(n.id) && !this.missed.has(n.id)) {
          this.missed.add(n.id);
          this.addMeasureError(n.measure);
          this.events.emit({ type: 'note', id: n.id, state: 'bad', midi: n.midi });
        }
      }
    }
    const result = this.buildResult();
    this.cleanup();
    this.setPhase('done');
    this.events.emit({ type: 'done', result });
  }

  private hesitations(): { count: number; byMeasure: Map<number, number> } {
    const byMeasure = new Map<number, number>();
    const rates: number[] = [];
    const info: Array<{ rate: number; dt: number; db: number; measure: number }> = [];
    for (let i = 1; i < this.stepTimes.length; i++) {
      const dt = this.stepTimes[i] - this.stepTimes[i - 1];
      const db = this.steps[i].start - this.steps[i - 1].start;
      if (db <= 0) continue;
      const rate = dt / db;
      rates.push(rate);
      info.push({ rate, dt, db, measure: this.steps[i].measure });
    }
    if (rates.length < 3) return { count: 0, byMeasure };
    const sorted = rates.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    let count = 0;
    for (const r of info) {
      if (r.rate > median * 1.9 && r.dt - median * r.db > 0.45) {
        count++;
        const m = r.measure + this.score.measureOffset;
        byMeasure.set(m, (byMeasure.get(m) ?? 0) + 1);
      }
    }
    return { count, byMeasure };
  }

  private buildResult(): FlowResult {
    const total = this.notes.length;
    const seconds = piano.now() - this.startedAt;
    const perMeasureNotes = new Map<number, number>();
    for (const n of this.notes) {
      const m = n.measure + this.score.measureOffset;
      perMeasureNotes.set(m, (perMeasureNotes.get(m) ?? 0) + 1);
    }
    const hes = this.options.mode === 'wait' ? this.hesitations() : { count: 0, byMeasure: new Map<number, number>() };
    const perMeasure: MeasureStat[] = Array.from(perMeasureNotes.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([measure, notes]) => ({
        measure,
        notes,
        errors: this.measureErrors.get(measure) ?? 0,
        hesitations: hes.byMeasure.get(measure) ?? 0,
      }));

    if (this.options.mode === 'wait') {
      const accuracy = total === 0 ? 1 : this.firstTry / total;
      const steps = Math.max(1, this.steps.length);
      return {
        mode: 'wait',
        hands: this.options.hands,
        bpm: this.options.bpm,
        totalNotes: total,
        correctNotes: this.firstTry,
        wrongNotes: this.wrong,
        missedNotes: 0,
        hintedSteps: this.hinted,
        totalSteps: this.steps.length,
        accuracy,
        onTime: 1,
        meanAbsMs: 0,
        biasMs: 0,
        fluency: 1 - hes.count / steps,
        perMeasure,
        seconds,
        clean: this.wrong === 0 && this.hinted === 0,
        velocity: this.velocityCount > 0 ? this.velocitySum / this.velocityCount : null,
        byEar: this.byEar,
      };
    }

    const errs = Array.from(this.matched.values());
    const matched = errs.length;
    const onTimeCount = errs.filter((e) => Math.abs(e) <= this.onTimeWindow).length;
    const meanAbs = matched === 0 ? 0 : errs.reduce((a, e) => a + Math.abs(e), 0) / matched;
    const bias = matched === 0 ? 0 : errs.reduce((a, e) => a + e, 0) / matched;
    // Extra notes count against accuracy, but less than missing ones.
    const accuracy = total === 0 ? 1 : clamp((matched - 0.5 * this.wrong) / total, 0, 1);
    return {
      mode: 'tempo',
      hands: this.options.hands,
      bpm: this.options.bpm,
      totalNotes: total,
      correctNotes: matched,
      wrongNotes: this.wrong,
      missedNotes: this.missed.size,
      hintedSteps: 0,
      totalSteps: this.steps.length,
      accuracy,
      onTime: matched === 0 ? 0 : onTimeCount / matched,
      meanAbsMs: meanAbs * 1000,
      biasMs: bias * 1000,
      fluency: 1,
      perMeasure,
      seconds,
      clean: accuracy >= 0.95 && this.missed.size === 0,
      velocity: this.velocityCount > 0 ? this.velocitySum / this.velocityCount : null,
      byEar: this.byEar,
    };
  }
}

/** Measures that gave the most trouble, worst first. */
export function troubleSpots(result: FlowResult, limit = 2): MeasureStat[] {
  return result.perMeasure
    .filter((m) => m.errors + m.hesitations > 0)
    .sort((a, b) => (b.errors + b.hesitations) / b.notes - (a.errors + a.hesitations) / a.notes)
    .slice(0, limit);
}
