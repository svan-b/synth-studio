/**
 * The follower. It listens to what the guitar does and compares it with what
 * the music asks for.
 *
 * Two modes, as in the piano app:
 *   wait   The music waits for each note or chord. No time pressure, which
 *          is how new material should be learned. Help appears only after a
 *          pause or two tries that did not work.
 *   tempo  The music moves with a click, and every strum or note is judged
 *          for timing, and chords for whether they were the right ones.
 *
 * On a guitar there is a third thing to hear besides right and wrong: a
 * string that did not ring. A pluck heard with no clear note in it is a
 * muted or buzzing string, and the learner is told so instead of being told
 * they played a wrong note.
 */

import { guitar } from '../audio/engine';
import { Transport, clickEvents, measureStartFor, type TimedEvent } from '../audio/transport';
import { judgeChord, type ChordVerdict } from '../dsp/chordmatch';
import { noteBus, strikeBus, type NoteInput, type StrikeInput } from '../input/bus';
import { listener } from '../input/listen';
import { chordPitchClasses } from '../music/chords';
import { changeSteps, type Score, type Step } from '../music/score';
import { measureBeats } from '../music/theory';
import { Emitter, clamp } from '../util/emitter';

export type FollowMode = 'wait' | 'tempo';
export type FollowPhase = 'ready' | 'countin' | 'playing' | 'done' | 'stopped';
export type Mark = 'ok' | 'warn' | 'bad';

export interface FollowOptions {
  mode: FollowMode;
  /** Quarter notes per minute, for tempo mode. */
  bpm?: number;
  /** Wait mode: milliseconds before help is shown. 0 shows it at once, Infinity never. */
  hintDelayMs?: number;
  /** Wait mode: tries that did not work on one step before help is shown. */
  hintAfterWrong?: number;
  metronome?: boolean;
  /** Wait mode on a strummed score: one strum for each new chord, not every strum. */
  changesOnly?: boolean;
  /** Any strike will do. For rhythm, where only the timing is judged. */
  anyStrike?: boolean;
  /** Chords the learner may play by mistake, for the chord check. */
  confusers?: string[];
  /** Wait mode: end early once the learner is plainly stuck, as for a first play through. */
  stopAfter?: { hints: number; wrong: number } | null;
  /** Seconds the microphone adds before a sound is heard, from the timing check. */
  inputDelay?: number;
}

export interface MeasureStat {
  measure: number;
  steps: number;
  errors: number;
  hesitations: number;
  hints: number;
  played: number;
}

/** What became of one step. */
export interface StepOutcome {
  index: number;
  measure: number;
  start: number;
  kind: 'notes' | 'strum';
  chord: string | null;
  /**
   * ok: right, and on the beat where there is one.
   * off: right, but off the beat, or found after a slip or with help.
   * wrong: a strike that was not the chord asked for.
   * missed: nothing was played for it.
   */
  state: 'ok' | 'off' | 'wrong' | 'missed';
  /** Tempo mode: milliseconds from the beat, positive is late. */
  errMs?: number;
}

/** A change from one chord to the next, and how it went. */
export interface ChangeStat {
  from: string;
  to: string;
  measure: number;
  /** Wait mode: seconds from one chord to the next. */
  seconds?: number;
  /** Tempo mode: on time with the right chord, late, or not the chord. */
  state: 'ok' | 'late' | 'wrong';
}

export interface FollowResult {
  mode: FollowMode;
  kind: Score['kind'];
  bpm: number;
  totalSteps: number;
  /** Steps played right with no slip first (wait), or matched in time (tempo). */
  rightSteps: number;
  /** Tries that were a wrong note or a wrong chord. */
  wrongTries: number;
  /** Tries where a string did not ring clearly. */
  unclearTries: number;
  hintedSteps: number;
  /** Hinted steps with nothing wrong played first: a pause to think, not a slip. */
  pausedSteps: number;
  missedSteps: number;
  /** 0 to 1. Wait: share of steps right first time. Tempo: share of steps played, less a little for extras. */
  accuracy: number;
  /** Tempo: share of the matched steps that landed near the beat. */
  onTime: number;
  meanAbsMs: number;
  biasMs: number;
  /** Strummed music: share of chords that sounded right, or null when none could be judged. */
  chordsRight: number | null;
  /** Tempo: strikes that matched nothing in the music. */
  extraStrikes: number;
  /** Strikes with no pitch at all: a muted strum. */
  deadStrikes: number;
  /** Wait: share of steps played without a long pause. */
  fluency: number;
  /** Wait: speed as a share of the written tempo, or null for a short passage. */
  pace: number | null;
  perMeasure: MeasureStat[];
  changes: ChangeStat[];
  detail: StepOutcome[];
  seconds: number;
  clean: boolean;
  cutShort: boolean;
  /** Tempo: strikes during the count in, before the music began. */
  earlyStrikes: number;
  /** Notes the chord check found missing most often, as pitch classes. */
  quietNotes: number[];
}

export type FollowEvent =
  | { type: 'phase'; phase: FollowPhase }
  | { type: 'step'; index: number }
  | { type: 'mark'; index: number; state: Mark }
  | { type: 'note'; index: number; midi: number }
  | { type: 'wrong'; index: number; midi?: number; heard?: string | null }
  | { type: 'unclear'; index: number; missing?: number[] }
  | { type: 'false-start' }
  | { type: 'hint'; index: number }
  | { type: 'pulse'; beat: number; accent: boolean; countIn: boolean; number: number }
  | { type: 'done'; result: FollowResult };

/** How long a strike waits for the notes the detector finds in it. */
const NOTE_WAIT = 0.32;

/** The session now running, for development tools and tests. */
export const activeFollow: { current: Follower | null } = { current: null };

export class Follower {
  readonly events = new Emitter<FollowEvent>();
  readonly steps: Step[];
  readonly options: Required<Omit<FollowOptions, 'stopAfter' | 'confusers'>> & { stopAfter: FollowOptions['stopAfter'] | null; confusers: string[] };
  phase: FollowPhase = 'ready';

  private subs: Array<() => void> = [];
  private transport = new Transport();
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private startedAt = 0;
  private soundDelay = 0;
  private cutShort = false;

  // wait mode
  private index = 0;
  private pending = new Set<number>();
  private stepWrong = 0;
  private stepUnclear = 0;
  private stepHinted = false;
  private stepGuided = false;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private stepTimes: number[] = [];
  private rightSteps = 0;
  private paused = 0;
  private shownInARow = 0;
  private lastShown = -2;
  private wrongAt: number[] = [];
  private outcome = new Map<number, StepOutcome['state']>();
  /** Notes heard recently, so a strike can be checked against what was named in it. */
  private heard: NoteInput[] = [];

  // tempo mode
  private matched = new Map<number, number>();
  private missed = new Set<number>();
  private chordJudged = new Map<number, ChordVerdict>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private early = 0;
  private extra = 0;

  // totals
  private wrong = 0;
  private unclear = 0;
  private dead = 0;
  private hinted = 0;
  private measureErrors = new Map<number, number>();
  private measureHints = new Map<number, number>();
  private chordOk = 0;
  private chordTotal = 0;
  private missingCount = new Map<number, number>();

  constructor(
    readonly score: Score,
    opts: FollowOptions,
  ) {
    this.options = {
      mode: opts.mode,
      bpm: opts.bpm ?? score.tempo,
      hintDelayMs: opts.hintDelayMs ?? 4000,
      hintAfterWrong: opts.hintAfterWrong ?? 2,
      metronome: opts.metronome ?? true,
      changesOnly: opts.changesOnly ?? (opts.mode === 'wait' && score.kind === 'strum'),
      anyStrike: opts.anyStrike ?? false,
      confusers: opts.confusers ?? [],
      stopAfter: opts.stopAfter ?? null,
      inputDelay: opts.inputDelay ?? 0.06,
    };
    this.steps = this.options.mode === 'wait' && this.options.changesOnly && score.kind === 'strum' ? changeSteps(score) : score.steps;
  }

  get mode(): FollowMode {
    return this.options.mode;
  }

  start(): void {
    if (this.phase !== 'ready') return;
    this.subs.push(noteBus.subscribe((ev) => this.onNote(ev)));
    this.subs.push(strikeBus.subscribe((ev) => this.onStrike(ev)));
    this.startedAt = guitar.now();
    this.soundDelay = guitar.outputLatency();
    activeFollow.current = this;
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

  /** Audio time a step is due, in tempo mode. */
  timeOfStep(index: number): number {
    return this.transport.timeOfBeat(this.steps[index].start);
  }

  private cleanup(): void {
    if (activeFollow.current === this) activeFollow.current = null;
    this.subs.forEach((u) => u());
    this.subs = [];
    this.transport.stop();
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.hintTimer = null;
    this.stallTimer = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    listener.expect(null);
  }

  private setPhase(phase: FollowPhase): void {
    this.phase = phase;
    this.events.emit({ type: 'phase', phase });
  }

  private later(seconds: number, fn: () => void): void {
    const t = setTimeout(() => {
      if (this.phase === 'playing' || this.phase === 'countin') fn();
    }, Math.max(0, seconds * 1000));
    this.timers.push(t);
  }

  private chordPcs(step: Step): number[] {
    return step.strum ? chordPitchClasses(step.strum.chord) : [];
  }

  /** Chords to compare a strum with: the chord before this one, and any the caller named. */
  private confusersFor(index: number): Array<{ symbol: string; pcs: number[] }> {
    const step = this.steps[index];
    const own = step.strum?.chord;
    const names = new Set<string>(this.options.confusers);
    for (let i = index - 1; i >= 0; i--) {
      const c = this.steps[i].strum?.chord;
      if (c && c !== own) {
        names.add(c);
        break;
      }
    }
    if (own) names.delete(own);
    return Array.from(names).map((symbol) => ({ symbol, pcs: chordPitchClasses(symbol) }));
  }

  private addError(measure: number): void {
    const m = measure + this.score.measureOffset;
    this.measureErrors.set(m, (this.measureErrors.get(m) ?? 0) + 1);
  }

  /** Judge a strike as a strum of a step's chord, with the notes the detector named around it as extra evidence. */
  private judge(strike: StrikeInput, index: number): ChordVerdict {
    const step = this.steps[index];
    const pcs = this.chordPcs(step);
    const verdict = judgeChord(strike.chroma, pcs, this.confusersFor(index));
    if (!verdict.ok && !verdict.heard && step.strum) {
      // Three or more of the chord's own notes, each named by the detector, is good evidence on its own.
      const named = new Set(this.heard.filter((n) => Math.abs(n.time - strike.time) < 0.08 && step.strum!.midis.includes(n.midi)).map((n) => n.midi));
      if (named.size >= Math.min(3, step.strum.midis.length)) return { ...verdict, ok: true };
    }
    return verdict;
  }

  // ------------------------------------------------------------------ input

  private onNote(ev: NoteInput): void {
    this.heard.push(ev);
    if (this.heard.length > 40) this.heard.shift();
    if (this.phase !== 'playing') return;
    if (this.options.mode === 'wait') this.waitNote(ev);
    else this.tempoNote(ev);
  }

  private onStrike(ev: StrikeInput): void {
    if (this.phase === 'countin') {
      this.earlyStrike(ev);
      return;
    }
    if (this.phase !== 'playing') return;
    if (ev.chroma.length === 0) this.dead++;
    if (this.options.mode === 'wait') this.waitStrike(ev);
    else this.tempoStrike(ev);
  }

  // ------------------------------------------------------------------- wait

  private startWait(): void {
    this.setPhase('playing');
    this.index = 0;
    this.activate();
  }

  private activate(): void {
    const step = this.steps[this.index];
    this.pending = new Set(step.notes.map((_, i) => i));
    this.stepWrong = 0;
    this.stepUnclear = 0;
    this.stepHinted = false;
    this.stepGuided = false;
    listener.expect(step.strum ? step.strum.midis : step.notes.map((n) => n.midi));
    this.events.emit({ type: 'step', index: this.index });
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.hintTimer = null;
    this.stallTimer = null;
    const delay = this.options.hintDelayMs;
    if (delay <= 0) this.showHint();
    else if (Number.isFinite(delay)) this.hintTimer = setTimeout(() => this.showHint(), delay);
  }

  private showHint(): void {
    if (this.phase !== 'playing' || this.stepHinted) return;
    this.stepHinted = true;
    const step = this.steps[this.index];
    // Help on the very first step, with nothing played wrong, is a guide to where to begin, not a rescue.
    this.stepGuided = this.index === 0 && this.stepWrong === 0 && this.stepUnclear === 0;
    if (this.options.hintDelayMs > 0 && !this.stepGuided) {
      this.hinted++;
      const m = step.measure + this.score.measureOffset;
      this.measureHints.set(m, (this.measureHints.get(m) ?? 0) + 1);
      this.shownInARow = this.lastShown === this.index - 1 ? this.shownInARow + 1 : 1;
      this.lastShown = this.index;
    }
    this.events.emit({ type: 'hint', index: this.index });
    this.stopIfStuck();
    if (this.options.stopAfter && !this.stepGuided && this.phase === 'playing') {
      const at = this.index;
      this.stallTimer = setTimeout(() => {
        if (this.phase !== 'playing' || this.index !== at) return;
        this.cutShort = true;
        this.finish();
      }, 5000);
    }
  }

  private stopIfStuck(): void {
    const limit = this.options.stopAfter;
    if (!limit || this.phase !== 'playing') return;
    const lately = this.wrongAt.filter((i) => i > this.index - 8).length;
    if (this.shownInARow >= limit.hints || lately >= limit.wrong) {
      this.cutShort = true;
      this.finish();
    }
  }

  private slip(kind: 'wrong' | 'unclear'): void {
    const step = this.steps[this.index];
    if (kind === 'wrong') {
      this.stepWrong++;
      this.wrong++;
      this.wrongAt.push(this.index);
    } else {
      this.stepUnclear++;
      this.unclear++;
    }
    this.addError(step.measure);
    if (this.stepWrong + this.stepUnclear >= this.options.hintAfterWrong) this.showHint();
    this.stopIfStuck();
  }

  private waitNote(ev: NoteInput): void {
    const step = this.steps[this.index];
    if (step.strum || this.options.anyStrike) return;
    const i = step.notes.findIndex((n, k) => this.pending.has(k) && n.midi === ev.midi);
    if (i >= 0) {
      this.pending.delete(i);
      this.events.emit({ type: 'note', index: this.index, midi: ev.midi });
      if (this.pending.size === 0) this.complete();
      return;
    }
    // A note of this step played again, or the last step's note still ringing, is no slip.
    if (step.notes.some((n) => n.midi === ev.midi)) return;
    const prev = this.steps[this.index - 1];
    if (prev && prev.notes.some((n) => n.midi === ev.midi) && guitar.now() - (this.stepTimes[this.stepTimes.length - 1] ?? 0) < 0.6) return;
    // An octave out is more likely the microphone than the hand. It is not counted.
    if (step.notes.some((n) => Math.abs(n.midi - ev.midi) === 12)) return;
    this.events.emit({ type: 'wrong', index: this.index, midi: ev.midi });
    this.slip('wrong');
  }

  private waitStrike(ev: StrikeInput): void {
    const step = this.steps[this.index];
    const at = this.index;
    if (this.options.anyStrike) {
      this.complete();
      return;
    }
    if (step.strum) {
      const v = this.judge(ev, at);
      this.chordTotal++;
      if (v.ok) {
        this.chordOk++;
        this.complete();
        return;
      }
      for (const pc of v.fit.missing) this.missingCount.set(pc, (this.missingCount.get(pc) ?? 0) + 1);
      if (v.heard) {
        this.events.emit({ type: 'wrong', index: at, heard: v.heard });
        this.slip('wrong');
      } else {
        this.events.emit({ type: 'unclear', index: at, missing: v.dead ? undefined : v.fit.missing });
        this.slip('unclear');
      }
      return;
    }
    // A pluck for a note step. If no note was named in it by the time the detector has had its look, the string did not ring.
    const strikeTime = ev.time;
    this.later(NOTE_WAIT - Math.max(0, guitar.now() - strikeTime - 0.2), () => {
      if (this.index !== at || this.phase !== 'playing') return;
      const named = this.heard.some((n) => Math.abs(n.time - strikeTime) < 0.09);
      if (!named) {
        this.events.emit({ type: 'unclear', index: at });
        this.slip('unclear');
      }
    });
  }

  private complete(): void {
    const now = guitar.now();
    this.stepTimes.push(now);
    const rescued = this.stepWrong > 0 || this.stepUnclear > 0 || (this.stepHinted && !this.stepGuided && this.options.hintDelayMs > 0);
    this.outcome.set(this.index, rescued ? 'off' : 'ok');
    this.events.emit({ type: 'mark', index: this.index, state: rescued ? 'warn' : 'ok' });
    if (this.stepWrong === 0 && this.stepUnclear === 0) {
      this.rightSteps++;
      if (this.stepHinted && !this.stepGuided && this.options.hintDelayMs > 0) this.paused++;
    }
    this.index++;
    if (this.index >= this.steps.length) this.finish();
    else this.activate();
  }

  // ------------------------------------------------------------------ tempo

  private get beatSeconds(): number {
    return 60 / this.options.bpm;
  }

  private get matchWindow(): number {
    // Strums close together get a narrower window, so one strike cannot count for two.
    const gap = this.minGap();
    return clamp(Math.min(0.45 * this.beatSeconds, 0.48 * gap * this.beatSeconds), 0.09, 0.3);
  }

  private get onTimeWindow(): number {
    return clamp(0.18 * this.beatSeconds, 0.07, 0.12);
  }

  private gapCache: number | null = null;
  private minGap(): number {
    if (this.gapCache !== null) return this.gapCache;
    let gap = 4;
    for (let i = 1; i < this.steps.length; i++) gap = Math.min(gap, this.steps[i].start - this.steps[i - 1].start);
    this.gapCache = Math.max(0.25, gap);
    return this.gapCache;
  }

  private startTempo(): void {
    const score = this.score;
    const mLen = measureBeats(score.time);
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
    if (!this.options.metronome) events.push(...clickEvents(score.time, fromBeat, 0, measureStart, undefined, true));
    this.steps.forEach((step, index) => {
      events.push({ beat: step.start, run: (when) => this.at(when, () => this.events.emit({ type: 'step', index })) });
      const next = this.steps[index + 1];
      const notes = [...(step.strum ? step.strum.midis : step.notes.map((n) => n.midi)), ...(next ? (next.strum ? next.strum.midis : next.notes.map((n) => n.midi)) : [])];
      events.push({ beat: step.start - 0.35, run: (when) => this.at(when, () => listener.expect(notes)) });
    });
    events.push({ beat: -this.matchWindow / this.beatSeconds, run: (when) => this.at(when, () => this.setPhase('playing')) });
    this.setPhase('countin');
    this.transport.start(events, score.totalBeats + 0.75, { bpm: this.options.bpm, fromBeat, lead: 0.25, onDone: () => this.finishSoon() });
    this.ticker = setInterval(() => this.sweep(), 60);
  }

  /** The last strike's chord comes a moment after the music ends, so the result waits for it. */
  private finishSoon(): void {
    setTimeout(() => this.finish(), 350);
  }

  private at(when: number, fn: () => void): void {
    const delay = Math.max(0, (when - guitar.now()) * 1000);
    const t = setTimeout(() => {
      if (this.phase !== 'done' && this.phase !== 'stopped') fn();
    }, delay);
    this.timers.push(t);
  }

  /** A strike in the count in. Several mean the learner started before the music, so the run is stopped. */
  private earlyStrike(ev: StrikeInput): void {
    if (this.options.mode !== 'tempo') return;
    if (guitar.now() - this.startedAt < 0.6) return;
    void ev;
    this.early++;
    if (this.early >= 3) {
      this.events.emit({ type: 'false-start' });
      this.stop();
    }
  }

  /** When a sound really happened, on the clock the beat is kept on. */
  private heardAt(time: number): number {
    return time - this.soundDelay - this.options.inputDelay;
  }

  private nearestStep(t: number, wanted: (i: number) => boolean): { index: number; err: number } | null {
    let best: { index: number; err: number } | null = null;
    for (let i = 0; i < this.steps.length; i++) {
      if (!wanted(i) || this.matched.has(i) || this.missed.has(i)) continue;
      const err = t - this.transport.timeOfBeat(this.steps[i].start);
      if (Math.abs(err) <= this.matchWindow && (!best || Math.abs(err) < Math.abs(best.err))) best = { index: i, err };
    }
    return best;
  }

  private tempoStrike(ev: StrikeInput): void {
    const t = this.heardAt(ev.time);
    // In strummed music every strike is a strum, or in a pattern such as a
    // waltz, the bass note on the first beat. In picked music the notes are
    // matched as they come, and strikes only count the dead ones.
    if (this.score.kind !== 'strum' && !this.options.anyStrike) return;
    const hit = this.nearestStep(t, () => true);
    if (!hit) {
      this.extra++;
      const beat = this.transport.beatAt(t);
      const step = this.steps.reduce((a, s) => (s.start <= beat + 0.25 ? s : a), this.steps[0]);
      this.addError(step.measure);
      this.events.emit({ type: 'wrong', index: step.index });
      return;
    }
    this.matched.set(hit.index, hit.err);
    const onTime = Math.abs(hit.err) <= this.onTimeWindow;
    if (!this.options.anyStrike && this.steps[hit.index].strum) {
      const v = this.judge(ev, hit.index);
      this.chordJudged.set(hit.index, v);
      if (!v.dead) {
        this.chordTotal++;
        if (v.ok) this.chordOk++;
        else for (const pc of v.fit.missing) this.missingCount.set(pc, (this.missingCount.get(pc) ?? 0) + 1);
      }
      const state: Mark = v.ok || v.dead ? (onTime ? 'ok' : 'warn') : v.heard ? 'bad' : 'warn';
      this.events.emit({ type: 'mark', index: hit.index, state });
      if (v.heard) this.events.emit({ type: 'wrong', index: hit.index, heard: v.heard });
    } else {
      this.events.emit({ type: 'mark', index: hit.index, state: onTime ? 'ok' : 'warn' });
    }
  }

  private tempoNote(ev: NoteInput): void {
    if (this.score.kind === 'strum' || this.options.anyStrike) return;
    const t = this.heardAt(ev.time);
    const hit = this.nearestStep(t, (i) => this.steps[i].notes.some((n) => n.midi === ev.midi));
    if (!hit) {
      // The note before, still ringing and named again, is no slip.
      if (this.steps.some((s, i) => this.matched.has(i) && s.notes.some((n) => n.midi === ev.midi) && Math.abs(t - this.transport.timeOfBeat(s.start)) < 0.6)) return;
      this.wrong++;
      const beat = this.transport.beatAt(t);
      const step = this.steps.reduce((a, s) => (s.start <= beat + 0.25 ? s : a), this.steps[0]);
      this.addError(step.measure);
      this.events.emit({ type: 'wrong', index: step.index, midi: ev.midi });
      return;
    }
    this.matched.set(hit.index, hit.err);
    this.events.emit({ type: 'mark', index: hit.index, state: Math.abs(hit.err) <= this.onTimeWindow ? 'ok' : 'warn' });
  }

  private sweep(): void {
    if (this.phase !== 'playing') return;
    // A strike is reported a moment after it happens, so a step is called missed only once its report would have come.
    const now = guitar.now() - this.soundDelay - this.options.inputDelay;
    for (let i = 0; i < this.steps.length; i++) {
      if (this.matched.has(i) || this.missed.has(i)) continue;
      if (this.transport.timeOfBeat(this.steps[i].start) + this.matchWindow + 0.45 < now) {
        this.missed.add(i);
        this.addError(this.steps[i].measure);
        this.events.emit({ type: 'mark', index: i, state: 'bad' });
      }
    }
  }

  // ----------------------------------------------------------------- finish

  private finish(): void {
    if (this.phase === 'done' || this.phase === 'stopped') return;
    if (this.options.mode === 'tempo') {
      for (let i = 0; i < this.steps.length; i++) {
        if (!this.matched.has(i) && !this.missed.has(i)) {
          this.missed.add(i);
          this.addError(this.steps[i].measure);
        }
      }
    }
    const result = this.buildResult();
    this.cleanup();
    this.setPhase('done');
    this.events.emit({ type: 'done', result });
  }

  private hesitations(): { byMeasure: Map<number, number>; count: number; median: number | null } {
    const byMeasure = new Map<number, number>();
    const rates: Array<{ rate: number; dt: number; db: number; measure: number }> = [];
    for (let i = 1; i < this.stepTimes.length; i++) {
      const dt = this.stepTimes[i] - this.stepTimes[i - 1];
      const db = this.steps[i].start - this.steps[i - 1].start;
      if (db <= 0) continue;
      rates.push({ rate: dt / db, dt, db, measure: this.steps[i].measure });
    }
    if (rates.length < 3) return { byMeasure, count: 0, median: null };
    const sorted = rates.map((r) => r.rate).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    let count = 0;
    for (const r of rates) {
      if (r.rate > median * 1.9 && r.dt - median * r.db > 0.6) {
        count++;
        const m = r.measure + this.score.measureOffset;
        byMeasure.set(m, (byMeasure.get(m) ?? 0) + 1);
      }
    }
    return { byMeasure, count, median };
  }

  private changeStats(): ChangeStat[] {
    const out: ChangeStat[] = [];
    let prev: { chord: string; index: number } | null = null;
    for (let i = 0; i < this.steps.length; i++) {
      const c = this.steps[i].strum?.chord;
      if (!c) continue;
      if (prev && c !== prev.chord) {
        const measure = this.steps[i].measure + this.score.measureOffset;
        if (this.options.mode === 'wait') {
          const a = this.stepTimes[prev.index];
          const b = this.stepTimes[i];
          if (a !== undefined && b !== undefined) out.push({ from: prev.chord, to: c, measure, seconds: Math.round((b - a) * 100) / 100, state: this.outcome.get(i) === 'ok' ? 'ok' : 'late' });
        } else {
          const err = this.matched.get(i);
          const v = this.chordJudged.get(i);
          const state: ChangeStat['state'] = err === undefined ? 'late' : v?.heard === prev.chord ? 'late' : v?.heard ? 'wrong' : Math.abs(err) > this.onTimeWindow ? 'late' : 'ok';
          out.push({ from: prev.chord, to: c, measure, state });
        }
      }
      prev = { chord: c, index: i };
    }
    return out;
  }

  private buildResult(): FollowResult {
    const total = this.steps.length;
    const seconds = guitar.now() - this.startedAt;
    const wait = this.options.mode === 'wait';
    const hes = wait ? this.hesitations() : { byMeasure: new Map<number, number>(), count: 0, median: null };
    const detail: StepOutcome[] = this.steps.map((s, i) => {
      const base = { index: i, measure: s.measure + this.score.measureOffset, start: s.start, kind: s.strum ? ('strum' as const) : ('notes' as const), chord: s.strum?.chord ?? null };
      if (wait) return { ...base, state: this.outcome.get(i) ?? 'missed' };
      const err = this.matched.get(i);
      if (err === undefined) return { ...base, state: 'missed' };
      const v = this.chordJudged.get(i);
      const state = v && !v.ok && v.heard ? 'wrong' : Math.abs(err) <= this.onTimeWindow ? 'ok' : 'off';
      return { ...base, state, errMs: Math.round(err * 1000) };
    });
    const perMeasureSteps = new Map<number, number>();
    const playedIn = new Map<number, number>();
    for (const d of detail) {
      perMeasureSteps.set(d.measure, (perMeasureSteps.get(d.measure) ?? 0) + 1);
      if (d.state !== 'missed') playedIn.set(d.measure, (playedIn.get(d.measure) ?? 0) + 1);
    }
    const perMeasure: MeasureStat[] = Array.from(perMeasureSteps.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([measure, steps]) => ({
        measure,
        steps,
        errors: this.measureErrors.get(measure) ?? 0,
        hesitations: hes.byMeasure.get(measure) ?? 0,
        hints: this.measureHints.get(measure) ?? 0,
        played: playedIn.get(measure) ?? 0,
      }));
    const quietNotes = Array.from(this.missingCount.entries())
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([pc]) => pc);
    const shared = {
      mode: this.options.mode,
      kind: this.score.kind,
      bpm: this.options.bpm,
      totalSteps: total,
      wrongTries: this.wrong,
      unclearTries: this.unclear,
      deadStrikes: this.dead,
      perMeasure,
      changes: this.changeStats(),
      detail,
      seconds,
      cutShort: this.cutShort,
      earlyStrikes: this.early,
      chordsRight: this.chordTotal > 0 ? this.chordOk / this.chordTotal : null,
      quietNotes,
    };
    if (wait) {
      return {
        ...shared,
        rightSteps: this.rightSteps,
        hintedSteps: this.hinted,
        pausedSteps: this.paused,
        missedSteps: total - this.outcome.size,
        accuracy: total === 0 ? 1 : this.rightSteps / total,
        onTime: 1,
        meanAbsMs: 0,
        biasMs: 0,
        extraStrikes: 0,
        fluency: 1 - hes.count / Math.max(1, total),
        pace: hes.median !== null && hes.median > 0 ? 60 / this.score.tempo / hes.median : null,
        clean: this.wrong === 0 && this.unclear === 0 && this.hinted === 0 && !this.cutShort,
      };
    }
    const errs = Array.from(this.matched.values());
    const matched = errs.length;
    const onTimeCount = errs.filter((e) => Math.abs(e) <= this.onTimeWindow).length;
    const meanAbs = matched === 0 ? 0 : errs.reduce((a, e) => a + Math.abs(e), 0) / matched;
    const bias = matched === 0 ? 0 : errs.reduce((a, e) => a + e, 0) / matched;
    const wrongChords = detail.filter((d) => d.state === 'wrong').length;
    // Extra strikes and wrong notes count against accuracy, at half the weight of a missed step.
    const accuracy = total === 0 ? 1 : clamp((matched - wrongChords - 0.5 * (this.extra + this.wrong)) / total, 0, 1);
    return {
      ...shared,
      rightSteps: matched - wrongChords,
      hintedSteps: 0,
      pausedSteps: 0,
      missedSteps: this.missed.size,
      accuracy,
      onTime: matched === 0 ? 0 : onTimeCount / matched,
      meanAbsMs: meanAbs * 1000,
      biasMs: bias * 1000,
      extraStrikes: this.extra,
      fluency: 1,
      pace: null,
      clean: accuracy >= 0.95 && this.missed.size === 0 && (shared.chordsRight === null || shared.chordsRight >= 0.9),
    };
  }
}

/** A timed run in which nothing, or next to nothing, was played is not an attempt, and is never judged. */
export function notAttempted(result: FollowResult): 'nothing' | 'barely' | null {
  if (result.mode !== 'tempo') return null;
  const played = result.totalSteps - result.missedSteps + result.extraStrikes + result.wrongTries;
  if (played === 0) return 'nothing';
  return result.totalSteps >= 8 && played <= result.totalSteps * 0.15 ? 'barely' : null;
}

/** Measures that gave the most trouble, worst first. */
export function troubleSpots(result: FollowResult, limit = 2): MeasureStat[] {
  return result.perMeasure
    .filter((m) => m.errors + m.hesitations > 0)
    .sort((a, b) => (b.errors + b.hesitations) / b.steps - (a.errors + a.hesitations) / a.steps)
    .slice(0, limit);
}

/** The chord change that went worst in a run, when one stands out. */
export function hardestChange(result: FollowResult): { from: string; to: string; times: number } | null {
  const bad = new Map<string, number>();
  const all = new Map<string, number>();
  for (const c of result.changes) {
    const key = `${c.from}>${c.to}`;
    all.set(key, (all.get(key) ?? 0) + 1);
    const slow = result.mode === 'wait' ? (c.seconds ?? 0) >= 3 : c.state !== 'ok';
    if (slow) bad.set(key, (bad.get(key) ?? 0) + 1);
  }
  let best: { key: string; n: number } | null = null;
  for (const [key, n] of Array.from(bad.entries())) {
    if (n >= 2 && n / (all.get(key) ?? 1) >= 0.5 && (!best || n > best.n)) best = { key, n };
  }
  if (!best) return null;
  const [from, to] = best.key.split('>');
  return { from, to, times: best.n };
}
