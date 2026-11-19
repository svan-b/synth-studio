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
import { Transport, clickEvents, measureStartFor, scoreEvents, type TimedEvent } from '../audio/transport';
import { noteBus, recentNotes, type NoteInput, type NoteSource } from '../input/bus';
import { input, isRemoteKey } from '../input/hub';
import { midi } from '../input/midi';
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
  /** Accept each note in any octave, so that a chord can be played in any position on the keyboard. */
  anyOctave?: boolean;
  /**
   * Wait mode: seconds to look back when the run begins. A learner who starts
   * a moment early, while the app is still getting ready, is not made to play
   * it all again.
   */
  catchUp?: number;
  /**
   * Wait mode: end the run early once this many steps have needed a hint, or
   * this many wrong keys have been pressed. For a first play through, which
   * only has to show how much is already known.
   */
  stopAfter?: { hints: number; wrong: number } | null;
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
  /** Steps in this measure where the key had to be shown. */
  hints?: number;
  /** Notes of this measure that were played. Fewer than `notes` when the run ended early or notes were missed. */
  played?: number;
}

/** What became of one note the music asked for. */
export interface NoteOutcome {
  id: string;
  hand: Hand;
  /** Measure index in the full piece. */
  measure: number;
  /** Beats from the start of the passage. */
  start: number;
  /** Written length in beats. */
  dur: number;
  midi: number;
  /**
   * ok: right, and on the beat where there is one.
   * off: the right note, but off the beat, or found only after a slip or a hint.
   * missed: never played.
   */
  state: 'ok' | 'off' | 'missed';
  /** Tempo mode: milliseconds from the beat. Positive is late. */
  errMs?: number;
  /** Tempo mode: share of the written length the key stayed down, when the input can tell. */
  held?: number;
}

/** A key that was pressed where the music asked for something else. */
export interface WrongPress {
  /** Measure index in the full piece. */
  measure: number;
  midi: number;
  /** The keys the music wanted at that moment. */
  expected: number[];
}

/**
 * Everything the learner played in a run, so that it can be played back.
 * Times are in seconds from the start of the take.
 */
export interface Take {
  /** Quarter notes per minute of the run, or 0 when the music waited. */
  bpm: number;
  /** Seconds from the start of the take to the first beat of the music. */
  lead: number;
  /** Every key pressed: the key, when, how long it was held, and how hard, 0 to 1. */
  notes: Array<[number, number, number, number]>;
  /** The right pedal: when, and 1 for down or 0 for up. */
  pedal: Array<[number, number]>;
  seconds: number;
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
  /** Every note the music asked for, and what became of it. */
  detail: NoteOutcome[];
  /** Keys pressed that the music did not ask for. */
  wrong: WrongPress[];
  /** Tempo mode: share of the long notes that were held for most of their length, or null when it cannot be told. */
  held: number | null;
  /** Wait mode: how fast it was played, as a share of the written tempo, or null for a very short passage. */
  pace: number | null;
  /** The run was ended early, see `stopAfter`. */
  cutShort: boolean;
  /** What was played, for hearing it back. Null when it came through the microphone. */
  take: Take | null;
}

/** Typical delay between an action and the app hearing about it. */
const DEFAULT_LATENCY: Record<NoteSource, number> = { touch: 0.045, midi: 0.008, mic: 0.07, keys: 0.02 };

/** The session now running, for development tools and tests. */
export const activeFlow: { current: FlowSession | null } = { current: null };

/** A timed run that is waiting for the learner to say go. Calling it starts the run. */
export const waitingGate: { current: (() => void) | null } = { current: null };

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
  private cutShort = false;
  private offPedal: (() => void) | null = null;

  // what was played, for hearing it back
  private takeStart = 0;
  private takeNotes: Array<[number, number, number, number]> = [];
  private takePedal: Array<[number, number]> = [];
  /** Keys that are down now, with their place in the take and when they went down. */
  private down = new Map<number, { at: number; index: number; noteId: string | null }>();
  private heldShare = new Map<string, number>();
  private outcome = new Map<string, 'ok' | 'off'>();
  private wrongPresses: WrongPress[] = [];
  private measureHints = new Map<number, number>();

  // wait mode
  private stepIndex = 0;
  private pending = new Set<string>();
  private stepWrong = 0;
  private stepHinted = false;
  /** The key was shown on this step, but as a guide to where to begin, not as a rescue. */
  private stepGuided = false;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
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
      anyOctave: opts.anyOctave ?? false,
      catchUp: opts.catchUp ?? 0,
      stopAfter: opts.stopAfter ?? null,
      latency: { ...DEFAULT_LATENCY, ...(opts.latency ?? {}) },
    };
    this.steps = stepsFor(score, this.options.hands);
    this.notes = this.steps.flatMap((s) => s.notes);
    this.pitches = new Set(this.notes.map((n) => n.midi));
  }

  get mode(): FlowMode {
    return this.options.mode;
  }

  /** Does a key that was pressed count as this note of the music? */
  private fits(note: NoteEvent, key: number): boolean {
    if (this.options.anyPitch || note.midi === key) return true;
    return this.options.anyOctave && (note.midi - key) % 12 === 0;
  }

  start(): void {
    if (this.phase !== 'ready') return;
    this.unsub = noteBus.subscribe((ev) => this.onInput(ev));
    this.offPedal = midi.pedals.subscribe((ev) => {
      if (ev.pedal !== 'sustain' || this.phase !== 'playing') return;
      const last = this.takePedal[this.takePedal.length - 1];
      const state = ev.down ? 1 : 0;
      if (last && last[1] === state) return;
      this.takePedal.push([round3(ev.time - this.takeStart), state]);
    });
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
    this.offPedal?.();
    this.offPedal = null;
    this.transport.stop();
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    input.expect(null);
  }

  private setPhase(phase: FlowPhase): void {
    this.phase = phase;
    if (phase === 'playing') {
      // The take begins here. In tempo mode that is a moment before the first beat.
      this.takeStart = piano.now();
      // A pedal put down during the count in is already down when the take begins.
      if (midi.isPedalDown('sustain')) this.takePedal.push([0, 1]);
    }
    this.events.emit({ type: 'phase', phase });
  }

  private onInput(ev: NoteInput): void {
    if (this.phase !== 'playing') return;
    if (ev.type === 'off') {
      this.keyUp(ev);
      return;
    }
    if (ev.source === 'mic') this.byEar = true;
    // The top and bottom keys are buttons for the app, unless the music uses them.
    if (ev.source === 'midi' && input.remoteKeys && isRemoteKey(ev.midi) && !this.pitches.has(ev.midi) && !this.options.anyPitch) return;
    if (this.options.mode === 'wait') this.waitInput(ev);
    else this.tempoInput(ev);
  }

  /** When a key press is taken to have happened, on the clock the take is kept in. */
  private heardAt(ev: NoteInput): number {
    // With a beat, the delay of the input is taken off, as it is for judging.
    return this.options.mode === 'tempo' ? ev.time - piano.outputLatency() - this.options.latency[ev.source] : ev.time;
  }

  private keyDown(ev: NoteInput, noteId: string | null): void {
    // A key struck again before it was let go ends its first sounding here.
    this.keyUp({ ...ev, type: 'off' });
    const at = this.heardAt(ev);
    // Without a beat the take begins with its first key, however long the learner took to start.
    if (this.options.mode === 'wait' && this.takeNotes.length === 0) this.takeStart = at;
    this.takeNotes.push([ev.midi, round3(Math.max(0, at - this.takeStart)), 0, Math.round(ev.velocity * 100) / 100]);
    this.down.set(ev.midi, { at: ev.time, index: this.takeNotes.length - 1, noteId });
  }

  private keyUp(ev: NoteInput, atEnd = false): void {
    const key = this.down.get(ev.midi);
    if (!key) return;
    this.down.delete(ev.midi);
    let seconds = Math.max(0.03, ev.time - key.at);
    if (atEnd && this.options.mode === 'wait') {
      // The run ends as its last key goes down. Give that note its written length.
      const note = key.noteId ? this.notes.find((n) => n.id === key.noteId) : undefined;
      seconds = Math.max(seconds, note ? (note.dur * 60) / this.score.tempo : 0.4);
    }
    this.takeNotes[key.index][2] = round3(seconds);
    if (key.noteId === null || this.options.mode !== 'tempo' || ev.source === 'mic') return;
    // With the right pedal down the sound carries on after the key comes up, so nothing can be said.
    if (!atEnd && midi.isPedalDown('sustain')) return;
    const note = this.notes.find((n) => n.id === key.noteId);
    if (note) this.heldShare.set(note.id, clamp(seconds / Math.max(0.05, note.dur * this.beatSeconds), 0, 1.5));
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
    this.catchUp();
  }

  /** Take in what was played just before the run began, from the first right note on. */
  private catchUp(): void {
    const since = piano.now() - this.options.catchUp;
    if (this.options.catchUp <= 0) return;
    // A microphone also hears the app's own demonstration, so it is left out.
    const early = recentNotes.filter((ev) => ev.time >= since && ev.source !== 'mic');
    const first = this.steps[0].notes;
    const from = early.findIndex((ev) => first.some((n) => this.fits(n, ev.midi)));
    if (from < 0) return;
    for (const ev of early.slice(from)) this.onInput(ev);
  }

  private activateStep(): void {
    const step = this.steps[this.stepIndex];
    this.pending = new Set(step.notes.map((n) => n.id));
    this.stepWrong = 0;
    this.stepHinted = false;
    this.stepGuided = false;
    this.lastStepAt = piano.now();
    input.expect(step.notes.map((n) => n.midi));
    this.events.emit({ type: 'step', index: this.stepIndex });
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = null;
    const delay = this.options.hintDelayMs;
    if (delay <= 0) this.revealHint();
    else if (Number.isFinite(delay)) this.hintTimer = setTimeout(() => this.revealHint(), delay);
  }

  private revealHint(): void {
    if (this.phase !== 'playing' || this.stepHinted) return;
    this.stepHinted = true;
    const step = this.steps[this.stepIndex];
    // A hint shown from the start is a guide, not a rescue, so it is not counted.
    // Nor is one on the very first note when nothing wrong was played: time
    // spent finding the place to begin is not a hesitation.
    this.stepGuided = this.stepIndex === 0 && this.stepWrong === 0;
    if (this.options.hintDelayMs > 0 && !this.stepGuided) {
      this.hinted++;
      const m = step.measure + this.score.measureOffset;
      this.measureHints.set(m, (this.measureHints.get(m) ?? 0) + 1);
    }
    this.events.emit({ type: 'hint', index: this.stepIndex, notes: step.notes.filter((n) => this.pending.has(n.id)) });
    this.stopIfEnough();
    // On a first play through, a key that was shown and still not played says the learner has stopped.
    if (this.options.stopAfter && !this.stepGuided && this.phase === 'playing') {
      const at = this.stepIndex;
      this.stallTimer = setTimeout(() => {
        if (this.phase !== 'playing' || this.stepIndex !== at) return;
        this.cutShort = true;
        this.finish();
      }, 4000);
    }
  }

  /** A first play through has heard enough once the learner is plainly stuck. */
  private stopIfEnough(): void {
    const limit = this.options.stopAfter;
    if (!limit || this.phase !== 'playing') return;
    if (this.hinted >= limit.hints || this.wrong >= limit.wrong) {
      this.cutShort = true;
      this.finish();
    }
  }

  private waitInput(ev: NoteInput): void {
    const step = this.steps[this.stepIndex];
    const match = step.notes.find((n) => this.pending.has(n.id) && this.fits(n, ev.midi));
    if (match) {
      this.pending.delete(match.id);
      this.noteVelocity(ev);
      this.keyDown(ev, match.id);
      const rescued = this.stepWrong > 0 || (this.stepHinted && !this.stepGuided && this.options.hintDelayMs > 0);
      if (!rescued) this.firstTry++;
      this.outcome.set(match.id, rescued ? 'off' : 'ok');
      // Where any octave will do, the key to light is the one that was pressed.
      this.events.emit({ type: 'note', id: match.id, state: rescued ? 'warn' : 'ok', midi: this.options.anyOctave ? ev.midi : match.midi });
      if (this.pending.size === 0) this.completeStep();
      return;
    }
    // Pressing a chord note again is harmless.
    if (step.notes.some((n) => this.fits(n, ev.midi))) {
      this.keyDown(ev, null);
      return;
    }
    // A microphone can report the previous note twice while it rings on.
    if (ev.source === 'mic' && this.stepIndex > 0) {
      const prev = this.steps[this.stepIndex - 1];
      if (prev.notes.some((n) => n.midi === ev.midi) && ev.time - this.lastStepAt < 0.35) return;
    }
    this.keyDown(ev, null);
    this.stepWrong++;
    this.wrong++;
    this.addMeasureError(step.measure);
    this.wrongPresses.push({ measure: step.measure + this.score.measureOffset, midi: ev.midi, expected: step.notes.map((n) => n.midi) });
    this.events.emit({ type: 'wrong', midi: ev.midi });
    if (this.stepWrong >= this.options.hintAfterWrong) this.revealHint();
    this.stopIfEnough();
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
    const measureStart = measureStartFor(score);

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
      if (!this.fits(n, ev.midi) || this.matched.has(n.id) || this.missed.has(n.id)) continue;
      const err = t - this.transport.timeOfBeat(n.start);
      if (Math.abs(err) <= this.matchWindow && Math.abs(err) < Math.abs(bestErr)) {
        best = n;
        bestErr = err;
      }
    }
    this.keyDown(ev, best ? best.id : null);
    if (best) {
      this.noteVelocity(ev);
      this.matched.set(best.id, bestErr);
      const onTime = Math.abs(bestErr) <= this.onTimeWindow;
      this.events.emit({ type: 'note', id: best.id, state: onTime ? 'ok' : 'warn', midi: this.options.anyOctave ? ev.midi : best.midi });
    } else {
      this.wrong++;
      const beat = this.transport.beatAt(t);
      const step = this.steps.reduce((a, s) => (s.start <= beat + 0.25 ? s : a), this.steps[0]);
      this.addMeasureError(step.measure);
      this.wrongPresses.push({ measure: step.measure + this.score.measureOffset, midi: ev.midi, expected: step.notes.map((n) => n.midi) });
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
    // Keys still down are taken to have been held to the end.
    const now = piano.now();
    for (const midiNote of Array.from(this.down.keys())) {
      this.keyUp({ type: 'off', midi: midiNote, velocity: 0, time: now, source: 'midi' }, true);
    }
    const result = this.buildResult();
    this.cleanup();
    this.setPhase('done');
    this.events.emit({ type: 'done', result });
  }

  private hesitations(): { count: number; byMeasure: Map<number, number>; median: number | null } {
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
    if (rates.length < 3) return { count: 0, byMeasure, median: null };
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
    return { count, byMeasure, median };
  }

  /** The take as it will be stored and played back, or null when the microphone was the ear. */
  private buildTake(seconds: number): Take | null {
    if (this.byEar || this.takeNotes.length === 0) return null;
    const tempo = this.options.mode === 'tempo';
    return {
      bpm: tempo ? this.options.bpm : 0,
      lead: tempo ? round3(Math.max(0, this.transport.timeOfBeat(0) - this.takeStart)) : 0,
      notes: this.takeNotes,
      pedal: this.takePedal,
      seconds: round3(Math.max(0, seconds)),
    };
  }

  private buildResult(): FlowResult {
    const total = this.notes.length;
    const seconds = piano.now() - this.startedAt;
    const perMeasureNotes = new Map<number, number>();
    for (const n of this.notes) {
      const m = n.measure + this.score.measureOffset;
      perMeasureNotes.set(m, (perMeasureNotes.get(m) ?? 0) + 1);
    }
    const wait = this.options.mode === 'wait';
    const hes = wait ? this.hesitations() : { count: 0, byMeasure: new Map<number, number>(), median: null };

    // What became of each note.
    const detail: NoteOutcome[] = this.notes.map((n) => {
      const base = { id: n.id, hand: n.hand, measure: n.measure + this.score.measureOffset, start: n.start, dur: n.dur, midi: n.midi };
      if (wait) return { ...base, state: this.outcome.get(n.id) ?? ('missed' as const) };
      const err = this.matched.get(n.id);
      if (err === undefined) return { ...base, state: 'missed' as const };
      const out: NoteOutcome = { ...base, state: Math.abs(err) <= this.onTimeWindow ? 'ok' : 'off', errMs: Math.round(err * 1000) };
      const share = this.heldShare.get(n.id);
      if (share !== undefined) out.held = Math.round(share * 100) / 100;
      return out;
    });
    const playedIn = new Map<number, number>();
    for (const d of detail) if (d.state !== 'missed') playedIn.set(d.measure, (playedIn.get(d.measure) ?? 0) + 1);

    const perMeasure: MeasureStat[] = Array.from(perMeasureNotes.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([measure, notes]) => ({
        measure,
        notes,
        errors: this.measureErrors.get(measure) ?? 0,
        hesitations: hes.byMeasure.get(measure) ?? 0,
        hints: this.measureHints.get(measure) ?? 0,
        played: playedIn.get(measure) ?? 0,
      }));

    // Long notes, and whether they were kept down for most of their length.
    const long = detail.filter((d) => d.dur >= 2 - 1e-6 && d.held !== undefined);
    const held = long.length >= 2 ? long.filter((d) => (d.held ?? 0) >= 0.6).length / long.length : null;
    const shared = {
      detail,
      wrong: this.wrongPresses,
      cutShort: this.cutShort,
      take: this.buildTake(piano.now() - this.takeStart),
    };

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
        clean: this.wrong === 0 && this.hinted === 0 && !this.cutShort,
        velocity: this.velocityCount > 0 ? this.velocitySum / this.velocityCount : null,
        byEar: this.byEar,
        held: null,
        pace: hes.median !== null && hes.median > 0 ? 60 / this.score.tempo / hes.median : null,
        ...shared,
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
      held,
      pace: null,
      ...shared,
    };
  }
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Measures that gave the most trouble, worst first. */
export function troubleSpots(result: FlowResult, limit = 2): MeasureStat[] {
  return result.perMeasure
    .filter((m) => m.errors + m.hesitations > 0)
    .sort((a, b) => (b.errors + b.hesitations) / b.notes - (a.errors + a.hesitations) / a.notes)
    .slice(0, limit);
}
