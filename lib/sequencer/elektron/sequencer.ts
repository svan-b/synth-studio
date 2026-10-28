// ============================================================================
// ElektronSequencer - the scheduler shared by the Analog Four and Analog Rytm
//
// No audio nodes: it turns Project data into callbacks carrying AudioContext
// times, which the engine turns into sound.
//
// Clock sources (both feed the same 24-PPQN tick processor):
//   internal  start()/stop(): own BPM, Clock-style look-ahead on the AudioContext
//   follow    follow(transport): derives steps from the studio transport's ticks
//             (MIDI clock style: 6 ticks per 16th at 1x), start/stop/locate events
//
// Per tick, per track:
//   - step boundary -> advance (track length, loop counter, master length reset)
//                   -> evaluate the trig (condition, mute) -> onTrig at
//                      grid time + swing + micro timing
//   - trigs with negative micro timing are evaluated early, on the latest tick
//     whose time is not after the trig, so they can still be scheduled ahead
//   - retrig sub-hits and note-offs are released lazily, one tick ahead, so a
//     new trig can still cut them
// Pattern changes (SEQUENTIAL / DIRECT START / DIRECT JUMP / TEMP JUMP), chain
// and song advance happen on tick boundaries computed from the pattern's change
// length. selectPattern(id, time) is the song arranger's hook: the pattern starts
// from step 1 on the tick at `time` (a bar line) and plays until stop.
//
// Allocation: the tick path works on typed arrays and preallocated state; only
// emitted TrigEvents (one small object per hit) and UI snapshots allocate.
// ============================================================================

import type { TransportEvent, TransportTick } from '@/lib/audio/transport';
import {
  MAX_STEPS, MICRO_PER_STEP, NOTE_LENGTHS, RETRIG_RATES, SPEED_TICKS, SWING_MAX, SWING_MIN, TEMPO_MAX, TEMPO_MIN,
  TICKS_PER_16TH, SEQ_PPQN,
  type ChangeMode, type Locks, type Pattern, type PatternId, type PlayMode, type Project, type SeqState,
  type Step, type Track, type TrigEvent,
} from './types';
import { asProject, createTrack, getPattern, isPatternId } from './project';
import {
  C_FILL, C_FIRST, C_NEI, C_NONE, C_NOT_FILL, C_NOT_FIRST, C_NOT_NEI, C_NOT_PRE, C_PRE,
  compileCondition, conditionString,
} from './conditions';
import { mulberry32, randomSeed, type Rng } from './rng';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/** Anything with an audio clock (an AudioContext, or a fake in tests) */
export interface TimeSource {
  readonly currentTime: number;
}

/** Timer functions (injectable so tests can run on a fake clock) */
export interface TimerApi {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** The parts of lib/audio/transport's Transport the sequencer uses */
export interface TransportLike {
  onTick(listener: (t: TransportTick) => void): () => void;
  onEvent(listener: (e: TransportEvent) => void): () => void;
  readonly playing: boolean;
  readonly bpm: number;
  /** 0..0.75 of a 16th: the transport delays ticks 6..11 of every 12 by this */
  readonly swing?: number;
}

export interface SequencerOptions {
  ctx: TimeSource;
  /** Number of tracks (Analog Four 4, Analog Rytm 12) */
  tracks: number;
  /** A trig (or retrig sub-hit) to play. One fresh object per hit. */
  onTrig?: (e: TrigEvent) => void;
  /** Gate off for the note started by the previous onTrig on `track` */
  onNoteOff?: (track: number, note: number, time: number) => void;
  /** A track reached a step (playheads), at the step's grid time (swing included, micro timing not) */
  onStep?: (track: number, step: number, time: number) => void;
  onPattern?: (id: PatternId, time: number) => void;
  onSongRow?: (row: number, repeat: number, time: number) => void;
  /** A song row changed the internal tempo */
  onTempo?: (bpm: number, time: number) => void;
  onPlay?: (playing: boolean, time: number) => void;
  /** RNG seed for probability conditions (tests); default random */
  seed?: number;
  /** Custom RNG returning [0, 1) */
  rng?: Rng;
  /** Also report trigs whose condition failed (conditionPassed: false) - for LED feedback */
  emitFailed?: boolean;
  /** NEI neighbour of a track (default: the track before; track 0 is its own neighbour) */
  neighbor?: (track: number) => number;
  /** Internal clock: seconds scheduled ahead (default 0.12) */
  lookahead?: number;
  /** Internal clock: pump interval in seconds (default 0.02) */
  interval?: number;
  timers?: TimerApi;
  /** Initial internal tempo */
  bpm?: number;
  /** Initial project (or anything asProject() accepts) */
  project?: unknown;
}

// ----------------------------------------------------------------------------
// Compiled pattern data (rebuilt only when the underlying objects change)
// ----------------------------------------------------------------------------

const K_NONE = 0;
const K_NOTE = 1;
const K_LOCK = 2;

interface CTrack {
  src: Track | undefined;
  q: number;
  len: number;
  mute: boolean;
  /** Track trig probability 0..100 for trigs without a condition */
  prob: number;
  note: number;
  vel: number;
  nlen: number;
  kind: Uint8Array;
  cond: Int16Array;
  condStr: string[];
  micro: Int8Array;
  /** Ticks before the step boundary at which a negative-micro trig is evaluated */
  early: Uint8Array;
  steps: (Step | undefined)[];
}

interface CPattern {
  id: PatternId;
  src: Pattern;
  tracks: CTrack[];
  /** Ticks per pattern / master step */
  q: number;
  /** Ticks after which every track restarts (0 = INF) */
  masterTicks: number;
  /** Pattern change grid in ticks (0 = INF: the pattern never hands over in SEQUENTIAL mode) */
  cycleTicks: number;
  /** A finite cycle for cued fills and song rows: cycleTicks, or the pattern length when INF */
  loopTicks: number;
  /** Swing: delay of every second step as a fraction of the step (0 .. 0.6) */
  swing: number;
}

const EMPTY_LOCKS: Readonly<Locks> = Object.freeze({});

// Switch kinds
const SW_NONE = 0;
const SW_SEQ = 1;
const SW_DIRECT = 2;
const SW_RETURN = 3;
const SW_CHAIN = 4;
const SW_ROW = 5;
const SW_MODE = 6;
const SW_ROW_JUMP = 7;
const SW_CHAIN_JUMP = 8;
const SW_SELECT = 9;

// UI event kinds
const UI_STEP = 1;
const UI_PATTERN = 2;
const UI_ROW = 3;
const UI_CHAIN = 4;
const UI_CAP = 1024;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const defaultTimers: TimerApi = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: h => clearInterval(h as ReturnType<typeof setInterval>),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: h => clearTimeout(h as ReturnType<typeof setTimeout>),
};

function fadeVelocity(v: number, fade: number, p: number): number {
  const g = fade < 0 ? 1 + fade * p : 1 - fade * (1 - p);
  return clamp(Math.round(v * g), 1, 127);
}

// ============================================================================

export class ElektronSequencer {
  private readonly o: SequencerOptions;
  private readonly n: number;
  private readonly ctx: TimeSource;
  private readonly timers: TimerApi;
  private readonly lookahead: number;
  private readonly interval: number;
  private rng: Rng;
  private project: Project;

  private patCache = new WeakMap<Pattern, CPattern>();
  private trackCache = new WeakMap<Track, CTrack>();

  // --- clocks
  private running = false;
  private timer: unknown = null;
  private nextTime = 0;
  private iTick = 0;
  private bpmValue: number;
  private transport: TransportLike | null = null;
  private unsubs: (() => void)[] = [];
  private followRunning = false;
  private startPending = false;

  // --- current tick
  private T = 0;
  private time = 0;
  private dur = 0.02;
  private base = 0;
  private winEnd = 0;
  private lastTick = -1;

  // --- playing pattern instance
  private cur: CPattern | null = null;
  private curId: PatternId = 'A01';
  private patStart = 0;
  private epoch = 0;
  private playMode: PlayMode = 'pattern';
  private queued: PatternId | null = null;
  private direct: { id: PatternId; mode: ChangeMode } | null = null;
  private tempReturn: PatternId | null = null;
  private startId: PatternId | null = null;
  private chainPos = 0;
  private chainStart = 0;
  private chainJump = -1;
  private songRow = 0;
  private songRep = 0;
  private songStart = 0;
  private rowJump = -1;
  private rowStart = 0;
  private rowRepTicks = 96;
  private rowRepeats = 1;
  private rowForce = false;
  /** Song row transpose in semitones */
  private transpose = 0;

  // --- song arranger (selectPattern)
  private selId: PatternId | null = null;
  private selTime = 0;
  /** Late selection (its tick was already scheduled): the tick its step 1 belongs to, else -1 */
  private selOrigin = -1;
  /** The arranger picked the playing pattern: PATTERN mode until stop */
  private external = false;

  // --- next switch (recomputed lazily)
  private planDirty = true;
  private swTick = -1;
  private swKind = SW_NONE;
  private swId: PatternId | null = null;
  private repTick = -1;

  // --- fill
  private fillHeld = false;
  private fillLatched = false;
  private cueStart = -1;
  private cueEnd = -1;
  private cuePending = false;

  // --- per track
  private tStep: Int32Array;
  private tNext: Float64Array;
  private tLoop: Int32Array;
  /** Steps the track has started in this pattern instance (swing: every second one) */
  private tCount: Int32Array;
  private tCond: Int8Array;
  private tPre: Float64Array;
  private offT: Float64Array;
  private offN: Int16Array;
  private offOn: Uint8Array;
  private lastOn: Float64Array;
  private rtOn: Uint8Array;
  private rtNext: Float64Array;
  private rtInt: Float64Array;
  private rtEnd: Float64Array;
  private rtStart: Float64Array;
  private rtSpan: Float64Array;
  private rtFade: Float64Array;
  private rtVel: Float64Array;
  private rtDur: Float64Array;
  private rtIdx: Int32Array;
  private rtBase: (TrigEvent | null)[];
  private runMute: Uint8Array;
  /** Note of a held preview per track (-1 = none) */
  private previewNote: Int16Array;
  private rowMute: Uint8Array;
  private rowMuteOn = false;
  private nb: Int32Array;

  // --- audible state for the UI (ring buffer of timed events)
  private uiTime = new Float64Array(UI_CAP);
  private uiKind = new Uint8Array(UI_CAP);
  private uiA = new Int32Array(UI_CAP);
  private uiB = new Int32Array(UI_CAP);
  private uiId: (PatternId | null)[] = new Array(UI_CAP).fill(null);
  private uiHead = 0;
  private uiLen = 0;
  private uiTimer: unknown = null;
  private aSteps: Int32Array;
  private aPattern: PatternId | null = null;
  private aRow = 0;
  private aRep = 0;
  private aChain = 0;
  private snap: SeqState | null = null;
  private listeners = new Set<(s: SeqState) => void>();

  constructor(opts: SequencerOptions) {
    this.o = opts;
    this.n = Math.max(1, Math.round(opts.tracks));
    this.ctx = opts.ctx;
    this.timers = opts.timers ?? defaultTimers;
    this.lookahead = opts.lookahead ?? 0.12;
    this.interval = opts.interval ?? 0.02;
    this.rng = opts.rng ?? mulberry32(opts.seed ?? randomSeed());
    this.bpmValue = clamp(opts.bpm ?? 120, TEMPO_MIN, TEMPO_MAX);
    this.project = asProject(opts.project, this.n);
    const n = this.n;
    this.tStep = new Int32Array(n).fill(-1);
    this.tNext = new Float64Array(n);
    this.tLoop = new Int32Array(n);
    this.tCount = new Int32Array(n).fill(-1);
    this.tCond = new Int8Array(n).fill(-1);
    this.tPre = new Float64Array(n).fill(-1);
    this.offT = new Float64Array(n);
    this.offN = new Int16Array(n);
    this.offOn = new Uint8Array(n);
    this.lastOn = new Float64Array(n);
    this.rtOn = new Uint8Array(n);
    this.rtNext = new Float64Array(n);
    this.rtInt = new Float64Array(n);
    this.rtEnd = new Float64Array(n);
    this.rtStart = new Float64Array(n);
    this.rtSpan = new Float64Array(n);
    this.rtFade = new Float64Array(n);
    this.rtVel = new Float64Array(n);
    this.rtDur = new Float64Array(n);
    this.rtIdx = new Int32Array(n);
    this.rtBase = new Array(n).fill(null);
    this.runMute = new Uint8Array(n);
    this.previewNote = new Int16Array(n).fill(-1);
    this.rowMute = new Uint8Array(n);
    this.aSteps = new Int32Array(n).fill(-1);
    this.nb = new Int32Array(n);
    for (let t = 0; t < n; t++) {
      const x = opts.neighbor ? opts.neighbor(t) : t - 1;
      this.nb[t] = x >= 0 && x < n ? x : t;
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /** Feed new project data (DeviceModule.data). Cheap when nothing changed. */
  setProject(data: unknown): void {
    const p = asProject(data, this.n);
    if (p === this.project) return;
    const prev = this.project;
    this.project = p;
    if (p.active !== prev.active) this.startId = null;
    if (this.cur) {
      this.cur = this.compile(this.curId);
      if (this.playMode === 'song') this.applyRowMutes();
      this.planDirty = true;
      if (this.playMode === 'pattern' && p.active !== prev.active) this.queuePattern(p.active);
    }
    this.changed();
  }

  getProject(): Project {
    return this.project;
  }

  /** Internal-clock tempo (ignored while following the transport) */
  setTempo(bpm: number): void {
    const b = clamp(bpm, TEMPO_MIN, TEMPO_MAX);
    if (b === this.bpmValue || !Number.isFinite(b)) return;
    this.bpmValue = b;
    this.changed();
  }

  get tempo(): number {
    return this.transport ? this.transport.bpm : this.bpmValue;
  }

  get playing(): boolean {
    return this.transport ? this.followRunning : this.running;
  }

  get following(): boolean {
    return this.transport !== null;
  }

  /** Start the internal clock. Ignored (returns false) while following the transport. */
  start(atTime?: number): boolean {
    if (this.transport) return false;
    if (this.running) return true;
    this.running = true;
    this.iTick = 0;
    this.lastTick = -1;
    this.nextTime = Math.max(this.ctx.currentTime + 0.05, atTime ?? 0);
    this.startPending = true;
    this.timer = this.timers.setInterval(() => this.pump(), this.interval * 1000);
    this.pump();
    return true;
  }

  /** Stop the internal clock: sounding notes get their note-off */
  stop(): void {
    if (this.transport || !this.running) return;
    this.running = false;
    this.clearClock();
    this.halt(this.ctx.currentTime);
  }

  /**
   * Follow the studio transport (null = back to the internal clock, stopped).
   * While following, the transport's start/stop/locate drive playback and
   * start()/stop() are ignored.
   */
  follow(t: TransportLike | null): void {
    if (t === this.transport) return;
    if (this.transport) {
      this.unsubs.forEach(u => u());
      this.unsubs = [];
      if (this.followRunning) {
        this.followRunning = false;
        this.halt(this.ctx.currentTime);
      }
    }
    if (this.running) {
      this.running = false;
      this.clearClock();
      this.halt(this.ctx.currentTime);
    }
    this.transport = t;
    if (t) {
      this.unsubs.push(t.onTick(tk => this.onTransportTick(tk)), t.onEvent(e => this.onTransportEvent(e)));
      if (t.playing) {
        // Join a running transport, aligned to its tick 0 (in sync with everything else)
        this.followRunning = true;
        this.startPending = true;
        this.lastTick = -1;
      }
    }
    this.changed();
  }

  /**
   * Select the pattern to play next. Stopped: it plays on start. Playing in
   * PATTERN mode: switches per the change mode (default: the project's).
   */
  queuePattern(id: PatternId, mode?: ChangeMode): void {
    if (!isPatternId(id)) return;
    if (!this.cur) {
      this.startId = id;
      this.changed();
      return;
    }
    if (this.playMode !== 'pattern') return;
    const cm = mode ?? this.project.changeMode;
    if (cm === 'sequential') {
      this.direct = null;
      this.queued = id === this.curId ? null : id;
    } else if (id !== this.curId || cm === 'direct-start') {
      this.direct = { id, mode: cm };
      this.queued = id;
    }
    this.planDirty = true;
    this.changed();
  }

  /**
   * The studio song arranger's hook (engine.event('arranger:pattern', { id, time })):
   * play `id` from step 1 starting on the tick at audio time `atTime` (a bar
   * line), then loop it in PATTERN mode until playback stops, whatever the
   * project's own play mode. Stopped: it plays from the top on the next start.
   * Without `atTime` it starts on the next step.
   * If the tick at `atTime` was already scheduled (the call came late), the
   * pattern still lines up with `atTime` but joins on the next tick.
   */
  selectPattern(id: PatternId, atTime?: number): void {
    if (!isPatternId(id)) return;
    this.selId = id;
    this.selTime = typeof atTime === 'number' && Number.isFinite(atTime) ? atTime : -Infinity;
    this.selOrigin = -1;
    if (this.cur && this.selTime !== -Infinity && this.selTime <= this.time + this.dur * 0.5) {
      this.selOrigin = this.lastTick - Math.max(0, Math.round((this.time - this.selTime) / this.dur));
    }
    this.planDirty = true;
    this.changed();
  }

  /** Song row to play from: the next start, or now (per change mode) when the song is playing */
  playSong(row: number): void {
    const r = Math.max(0, Math.round(row));
    this.songStart = r;
    if (this.cur && this.playMode === 'song') {
      this.rowJump = r;
      this.planDirty = true;
    }
    this.changed();
  }

  /** Chain position to play from: the next start, or next (per change mode) when the chain is playing */
  playChain(index: number): void {
    const i = Math.max(0, Math.round(index));
    this.chainStart = i;
    if (this.cur && this.playMode === 'chain') {
      this.chainJump = i;
      this.planDirty = true;
    }
    this.changed();
  }

  /** Momentary FILL (hold) */
  setFill(on: boolean): void {
    if (this.fillHeld === on) return;
    this.fillHeld = on;
    this.changed();
  }

  /** Latched FILL (toggles without an argument) */
  latchFill(on?: boolean): void {
    const v = on ?? !this.fillLatched;
    if (v === this.fillLatched) return;
    this.fillLatched = v;
    this.changed();
  }

  /** FILL for one pattern cycle, starting when the pattern next loops (stopped: the first cycle) */
  cueFill(): void {
    if (this.cur) {
      const c = this.cur.loopTicks;
      const s = this.nextOnGrid(this.lastTick + 1, this.patStart, c);
      this.cueStart = s;
      this.cueEnd = s + c;
    } else {
      this.cuePending = true;
    }
    this.changed();
  }

  /** Runtime (performance) mute, on top of the pattern's track mutes */
  setMute(track: number, on: boolean): void {
    if (!(track >= 0 && track < this.n) || !!this.runMute[track] === on) return;
    this.runMute[track] = on ? 1 : 0;
    this.changed();
  }

  isMuted(track: number): boolean {
    const ct = this.cur?.tracks[track];
    return !!this.runMute[track] || (this.rowMuteOn ? !!this.rowMute[track] : !!ct?.mute);
  }

  /** Re-seed the probability RNG */
  reseed(seed: number): void {
    this.rng = mulberry32(seed);
  }

  /**
   * Audition one step now (REC off: trig keys play their step; the hardware's
   * trig preview). Emits onTrig with the step's note, velocity, length and
   * locks - the track's defaults on an empty step - outside the sequence:
   * conditions, mutes and retrigs are ignored. previewOff() ends a held preview.
   */
  preview(track: number, step: number, pattern?: PatternId, time = this.ctx.currentTime): TrigEvent | null {
    if (!(track >= 0 && track < this.n)) return null;
    const id = pattern && isPatternId(pattern) ? pattern : this.cur ? this.curId : this.startId ?? this.project.active;
    const pat = getPattern(this.project, id);
    const t = pat.tracks[track] ?? createTrack(this.project.defaults[track]);
    const s: Step = t.steps[clamp(Math.round(step), 0, MAX_STEPS - 1)] ?? {};
    const speed = pat.scaleMode === 'track' && t.speed ? t.speed : pat.speed;
    const stepSec = ((SPEED_TICKS[speed] ?? TICKS_PER_16TH) * 60) / (this.tempo * SEQ_PPQN);
    const note = clamp((s.note ?? t.note) + this.transpose, 0, 127);
    const ev: TrigEvent = {
      track, step, pattern: id, time, duration: NOTE_LENGTHS[clamp(s.len ?? t.len, 0, NOTE_LENGTHS.length - 1)] * stepSec,
      note, velocity: clamp(s.vel ?? t.vel, 1, 127), locks: s.locks ?? EMPTY_LOCKS, trigless: false, slide: false,
      paramSlide: false, slideTo: null, accent: s.accent === true, retrig: false, retrigIndex: 0, fill: false,
      conditionPassed: true, condition: '', loop: 0, stepDuration: stepSec,
    };
    this.previewNote[track] = note;
    this.o.onTrig?.(ev);
    return ev;
  }

  /** End a held preview on the track (note-off now) */
  previewOff(track: number, time = this.ctx.currentTime): void {
    const note = this.previewNote[track];
    if (note === undefined || note < 0) return;
    this.previewNote[track] = -1;
    this.o.onNoteOff?.(track, note, time);
  }

  /**
   * Route the UI kit's sequencer events (components call ctx.sendEvent with
   * these names). Returns true when handled - call it first in engine.event().
   */
  handleEvent(name: string, payload?: unknown): boolean {
    const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
    switch (name) {
      case 'seq:fill': this.setFill(true); return true;
      case 'seq:fill:up': this.setFill(false); return true;
      case 'seq:fill-latch': this.latchFill(typeof p.on === 'boolean' ? p.on : undefined); return true;
      case 'seq:fill-cue': this.cueFill(); return true;
      case 'seq:queue':
        if (typeof p.id === 'string') this.queuePattern(p.id, typeof p.mode === 'string' ? (p.mode as ChangeMode) : undefined);
        return true;
      case 'seq:song-row': if (typeof p.row === 'number') this.playSong(p.row); return true;
      case 'seq:chain-index': if (typeof p.index === 'number') this.playChain(p.index); return true;
      case 'seq:mute':
        if (typeof p.track === 'number') this.setMute(p.track, typeof p.on === 'boolean' ? p.on : !this.runMute[p.track]);
        return true;
      case 'seq:start': this.start(); return true;
      case 'seq:stop': this.stop(); return true;
      case 'arranger:pattern':
        if (typeof p.id === 'string') this.selectPattern(p.id, typeof p.time === 'number' ? p.time : undefined);
        return true;
      case 'seq:preview':
        if (typeof p.track === 'number' && typeof p.step === 'number') this.preview(p.track, p.step, typeof p.pattern === 'string' ? p.pattern : undefined);
        return true;
      case 'seq:preview:up':
        if (typeof p.track === 'number') this.previewOff(p.track);
        return true;
    }
    return false;
  }

  /** Playhead snapshot (what is audible now). Same object until something changes. */
  getState(): SeqState {
    this.applyDue(this.ctx.currentTime);
    if (!this.snap) this.snap = this.buildSnap();
    return this.snap;
  }

  /** Called whenever the snapshot changes (audible step, pattern, fill, queue...) */
  subscribe(listener: (s: SeqState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Internal clock: schedule every tick inside the look-ahead window (exposed for tests) */
  pump(): void {
    if (!this.running || this.transport) return;
    const now = this.ctx.currentTime;
    // Throttled tab: skip ahead instead of firing a burst of stale ticks
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.01;
    const horizon = now + this.lookahead;
    let guard = 0;
    while (this.running && this.nextTime < horizon && guard++ < 4096) {
      const dur = 60 / this.bpmValue / SEQ_PPQN;
      this.processTick(this.iTick, this.nextTime, dur);
      this.iTick++;
      this.nextTime += 60 / this.bpmValue / SEQ_PPQN;
    }
  }

  dispose(): void {
    this.follow(null);
    if (this.running) {
      this.running = false;
      this.clearClock();
      this.halt(this.ctx.currentTime);
    }
    if (this.uiTimer !== null) this.timers.clearTimeout(this.uiTimer);
    this.uiTimer = null;
    this.listeners.clear();
  }

  // ==========================================================================
  // Transport
  // ==========================================================================

  private onTransportTick(tk: TransportTick): void {
    if (this.followRunning) this.processTick(tk.tick, tk.time, tk.tickDuration);
  }

  private onTransportEvent(e: TransportEvent): void {
    switch (e.type) {
      case 'start':
        if (this.followRunning && this.cur) this.halt(e.time);
        this.followRunning = true;
        this.startPending = true;
        this.lastTick = -1;
        this.changed();
        break;
      case 'stop':
        if (this.followRunning) {
          this.followRunning = false;
          this.halt(e.time);
        }
        break;
      case 'locate':
        if (this.followRunning) this.startPending = true;
        break;
      case 'tempo':
        this.changed();
        break;
    }
  }

  private clearClock(): void {
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
  }

  // ==========================================================================
  // Tick processing
  // ==========================================================================

  private transportSwing(tick: number): number {
    const s = this.transport?.swing ?? 0;
    return s > 0 && tick % 12 >= 6 ? s * TICKS_PER_16TH * this.dur : 0;
  }

  /** Audio time of a tick (the current one exactly, later ones predicted at the current tempo) */
  private timeAt(tick: number): number {
    if (tick === this.T) return this.time;
    return this.base + (tick - this.T) * this.dur + this.transportSwing(tick);
  }

  /** Pattern swing of the track's `count`-th step: every second step is late (the default swing trigs 2, 4, 6...) */
  private swingOf(count: number, ct: CTrack, cp: CPattern): number {
    return cp.swing > 0 && (count & 1) === 1 ? cp.swing * ct.q * this.dur : 0;
  }

  private processTick(T: number, time: number, dur: number): void {
    if (this.lastTick >= 0 && T <= this.lastTick) this.startPending = true; // jumped backwards: realign
    this.T = T;
    this.time = time;
    this.dur = dur;
    this.base = time - this.transportSwing(T);
    this.winEnd = this.base + dur;
    if (this.startPending) {
      this.startPending = false;
      this.begin(T);
    }
    if (!this.cur) {
      this.lastTick = T;
      return;
    }
    if (this.selId !== null) this.planDirty = true; // re-predict the arranger's tick at the current tempo
    if (this.planDirty) this.plan();
    if (this.repTick >= 0 && T >= this.repTick && (this.swTick < 0 || T < this.swTick)) this.songRepeat(T);
    if (this.swTick >= 0 && T >= this.swTick) {
      this.doSwitch(T);
      if (!this.cur) {
        this.lastTick = T;
        return;
      }
    }
    const cp = this.cur;
    if (cp.masterTicks > 0 && T - this.epoch >= cp.masterTicks) this.restartAll(T);
    for (let tr = 0; tr < this.n; tr++) {
      if (this.tNext[tr] <= T) this.advance(tr, T);
      this.early(tr, T);
    }
    for (let tr = 0; tr < this.n; tr++) {
      if (this.rtOn[tr]) this.flushRetrig(tr, this.winEnd);
      if (this.offOn[tr] && this.offT[tr] < this.winEnd) this.emitOff(tr, this.offT[tr]);
    }
    this.lastTick = T;
    this.armUi();
  }

  /** Start of playback on tick T (also a realign after a transport locate) */
  private begin(T: number): void {
    const wasPlaying = this.cur !== null;
    for (let tr = 0; tr < this.n; tr++) {
      if (this.offOn[tr]) this.emitOff(tr, Math.max(this.time, this.lastOn[tr] + 0.001));
    }
    this.tCond.fill(-1);
    this.tPre.fill(-1);
    this.rtOn.fill(0);
    this.rtBase.fill(null);
    this.queued = null;
    this.direct = null;
    this.tempReturn = null;
    this.rowJump = -1;
    this.chainJump = -1;
    if (!wasPlaying) this.o.onPlay?.(true, this.time);
    if (this.selId !== null && (this.selOrigin >= 0 || this.selTime <= this.time + this.dur * 0.5)) {
      // The song arranger picked the pattern for this tick (transport start / play from a section)
      const id = this.selId;
      this.selId = null;
      this.selOrigin = -1;
      this.startId = null;
      this.enterExternal();
      this.install(id, T, T, false);
    } else if (this.external && wasPlaying) {
      // Realign (transport locate) while the arranger drives: keep its pattern, lined up with tick 0
      this.install(this.curId, T, 0, true);
    } else {
      this.external = false;
      this.playMode = this.effectiveMode();
      this.enterMode(T, this.transport !== null && T > 0);
    }
    if (this.cuePending && this.cur) {
      this.cuePending = false;
      this.cueStart = T;
      this.cueEnd = T + this.cur.loopTicks;
    }
    this.changed();
  }

  /** The arranger takes over: PATTERN mode, nothing queued */
  private enterExternal(): void {
    this.external = true;
    this.playMode = 'pattern';
    this.queued = null;
    this.direct = null;
    this.tempReturn = null;
    this.rowJump = -1;
    this.chainJump = -1;
  }

  private effectiveMode(): PlayMode {
    if (this.external) return 'pattern';
    const p = this.project;
    if (p.mode === 'song' && p.song.rows.length) return 'song';
    if (p.mode === 'chain' && p.chain.length) return 'chain';
    return 'pattern';
  }

  private enterMode(T: number, align = false): void {
    this.playMode = this.effectiveMode();
    this.tempReturn = null;
    this.queued = null;
    const p = this.project;
    if (this.playMode === 'song') {
      this.installRow(clamp(this.songStart, 0, p.song.rows.length - 1), T);
    } else if (this.playMode === 'chain') {
      this.chainPos = clamp(this.chainStart, 0, p.chain.length - 1);
      this.install(p.chain[this.chainPos], T, T, false);
      this.uiPush(UI_CHAIN, this.time, this.chainPos, 0, null);
    } else {
      const id = this.startId ?? p.active;
      this.startId = null;
      // Joining a running transport: position the pattern as if it had played since tick 0
      this.install(id, T, align ? 0 : T, align);
    }
  }

  /** Make `id` the playing pattern from tick T. origin = tick its timeline started; keep = continue mid-pattern. */
  private install(id: PatternId, T: number, origin: number, keep: boolean): void {
    const cp = this.compile(id);
    this.cur = cp;
    this.curId = id;
    this.patStart = origin;
    const mt = cp.masterTicks;
    this.epoch = mt > 0 && T > origin ? origin + Math.floor((T - origin) / mt) * mt : origin;
    const fresh = !keep || T === this.epoch;
    for (let tr = 0; tr < this.n; tr++) {
      const ct = cp.tracks[tr];
      this.tLoop[tr] = 0;
      // tPre (a step already evaluated early for tick tPre) survives: it may be this pattern's first step
      if (fresh) {
        this.tStep[tr] = -1;
        this.tNext[tr] = T;
        this.tCount[tr] = -1;
        continue;
      }
      const e = T - this.epoch;
      const k = Math.floor(e / ct.q);
      if (e - k * ct.q === 0) {
        this.tStep[tr] = k % ct.len === 0 ? -1 : (k - 1) % ct.len;
        this.tNext[tr] = T;
        this.tCount[tr] = k - 1;
      } else {
        this.tStep[tr] = k % ct.len;
        this.tNext[tr] = this.epoch + (k + 1) * ct.q;
        this.tCount[tr] = k;
      }
    }
    this.transpose = 0;
    this.rowMuteOn = false;
    this.planDirty = true;
    this.o.onPattern?.(id, this.time);
    this.uiPush(UI_PATTERN, this.time, 0, 0, id);
  }

  private installRow(r: number, T: number): void {
    const row = this.project.song.rows[r];
    this.songRow = r;
    this.songRep = 0;
    this.rowStart = T;
    this.install(row.pattern, T, T, false);
    this.transpose = row.transpose ?? 0;
    this.applyRowMutes();
    if (row.tempo && !this.transport) {
      const b = clamp(row.tempo, TEMPO_MIN, TEMPO_MAX);
      if (b !== this.bpmValue) {
        this.bpmValue = b;
        this.o.onTempo?.(b, this.time);
      }
    }
    this.o.onSongRow?.(r, 0, this.time);
    this.uiPush(UI_ROW, this.time, r, 0, null);
  }

  private applyRowMutes(): void {
    const row = this.playMode === 'song' ? this.project.song.rows[this.songRow] : undefined;
    this.rowMute.fill(0);
    this.rowMuteOn = !!row?.mutes;
    if (row?.mutes) for (const t of row.mutes) if (t >= 0 && t < this.n) this.rowMute[t] = 1;
  }

  /** Master length reached (or a song row repeat with its own length): every track restarts */
  private restartAll(T: number): void {
    this.epoch = T;
    const cp = this.cur!;
    for (let tr = 0; tr < this.n; tr++) {
      const s = this.tStep[tr];
      if (s < 0) continue;
      if (this.tNext[tr] <= T && s >= cp.tracks[tr].len - 1) continue; // wraps naturally on this tick
      this.tStep[tr] = -1;
      this.tNext[tr] = T;
      this.tLoop[tr]++;
    }
  }

  private advance(tr: number, T: number): void {
    const cp = this.cur!;
    const ct = cp.tracks[tr];
    let s = this.tStep[tr];
    if (s < 0) s = 0;
    else if (++s >= ct.len) {
      s = 0;
      this.tLoop[tr]++;
    }
    this.tStep[tr] = s;
    this.tNext[tr] = T + ct.q;
    const count = ++this.tCount[tr];
    const grid = this.time + this.swingOf(count, ct, cp);
    this.o.onStep?.(tr, s, grid);
    this.uiPush(UI_STEP, grid, tr, s, null);
    if (this.tPre[tr] === T) {
      this.tPre[tr] = -1; // evaluated early (negative micro timing)
      return;
    }
    this.tPre[tr] = -1;
    if (ct.kind[s] !== K_NONE) this.evalStep(tr, ct, s, this.tLoop[tr], T, count, cp, this.transpose);
  }

  /** Evaluate the track's upcoming step now if its negative micro timing needs it */
  private early(tr: number, T: number): void {
    const cp = this.cur!;
    let B = this.tNext[tr];
    let kind = 0; // 0 natural, 1 restart, 2 switch
    const mt = cp.masterTicks;
    let rt = mt > 0 ? this.epoch + mt : Infinity;
    if (this.rowForce && this.repTick >= 0 && this.repTick < rt) rt = this.repTick;
    if (rt <= B) { B = rt; kind = 1; }
    let target = cp;
    if (this.swTick >= 0) {
      const sw = Math.max(this.swTick, T + 1);
      if (sw <= B) {
        const id = this.freshSwitchTarget();
        if (id === null) return; // continues mid-pattern or stops: nothing to pre-evaluate
        B = sw;
        kind = 2;
        target = this.compile(id);
      }
    }
    let s: number;
    let loop: number;
    let count: number;
    if (kind === 0) {
      const cur = this.tStep[tr];
      loop = this.tLoop[tr];
      s = cur < 0 ? 0 : cur + 1;
      if (cur >= 0 && s >= cp.tracks[tr].len) { s = 0; loop++; }
      count = this.tCount[tr] + 1;
    } else {
      s = 0;
      loop = kind === 1 ? this.tLoop[tr] + 1 : 0;
      count = kind === 1 ? this.tCount[tr] + 1 : 0;
    }
    const ct = target.tracks[tr];
    const off = ct.early[s];
    if (off === 0 || B - off !== T || ct.kind[s] === K_NONE || this.tPre[tr] === B) return;
    this.tPre[tr] = B;
    this.evalStep(tr, ct, s, loop, B, count, target, kind === 2 ? this.switchTranspose() : this.transpose);
  }

  /** Song transpose in effect after the planned switch */
  private switchTranspose(): number {
    const rows = this.project.song.rows;
    switch (this.swKind) {
      case SW_ROW: { const r = this.nextRowIndex(); return r < 0 ? 0 : rows[r].transpose ?? 0; }
      case SW_ROW_JUMP: return rows[clamp(this.rowJump, 0, rows.length - 1)]?.transpose ?? 0;
      case SW_MODE: return this.effectiveMode() === 'song' ? rows[clamp(this.songStart, 0, rows.length - 1)]?.transpose ?? 0 : 0;
    }
    return 0;
  }

  /** Pattern that the planned switch starts from step 1 (null when it continues mid-pattern or ends) */
  private freshSwitchTarget(): PatternId | null {
    const p = this.project;
    switch (this.swKind) {
      case SW_SEQ: case SW_RETURN: case SW_CHAIN: case SW_CHAIN_JUMP: return this.swId;
      case SW_SELECT: return this.selOrigin >= 0 ? null : this.swId;
      case SW_DIRECT: return this.direct?.mode === 'direct-start' ? this.direct.id : null;
      case SW_ROW: {
        const r = this.nextRowIndex();
        return r < 0 ? null : p.song.rows[r].pattern;
      }
      case SW_ROW_JUMP: return p.song.rows[clamp(this.rowJump, 0, p.song.rows.length - 1)]?.pattern ?? null;
      case SW_MODE: {
        const mode = this.effectiveMode();
        if (mode === 'song') return p.song.rows[clamp(this.songStart, 0, p.song.rows.length - 1)].pattern;
        if (mode === 'chain') return p.chain[clamp(this.chainStart, 0, p.chain.length - 1)];
        return this.startId ?? p.active;
      }
    }
    return null;
  }

  private nextRowIndex(): number {
    const song = this.project.song;
    const r = this.songRow + 1;
    if (r < song.rows.length) return r;
    if (!song.loop || !song.rows.length) return -1;
    return clamp(song.loopRow ?? 0, 0, song.rows.length - 1);
  }

  private evalStep(tr: number, ct: CTrack, s: number, loop: number, B: number, count: number, cp: CPattern, transpose: number): void {
    const step = ct.steps[s]!;
    const code = ct.cond[s];
    let passed = code === C_NONE ? true : this.evalCond(tr, code, loop, B);
    // Track probability: only for trigs without a condition, and it is not a condition result (PRE/NEI ignore it)
    if (code === C_NONE && ct.prob < 100) passed = this.rng() * 100 < ct.prob;
    if (!!this.runMute[tr] || (this.rowMuteOn ? !!this.rowMute[tr] : ct.mute)) return;
    if (!passed && !this.o.emitFailed) return;
    const stepSec = ct.q * this.dur;
    let t = this.timeAt(B) + this.swingOf(count, ct, cp) + (ct.micro[s] / MICRO_PER_STEP) * stepSec;
    if (t < this.time) t = this.time;
    const li = clamp(step.len ?? ct.nlen, 0, NOTE_LENGTHS.length - 1);
    const ev: TrigEvent = {
      track: tr,
      step: s,
      pattern: cp.id,
      time: t,
      duration: NOTE_LENGTHS[li] * stepSec,
      note: clamp((step.note ?? ct.note) + transpose, 0, 127),
      velocity: clamp(step.vel ?? ct.vel, 1, 127),
      locks: step.locks ?? EMPTY_LOCKS,
      trigless: ct.kind[s] === K_LOCK,
      slide: step.slide === true,
      paramSlide: step.pslide === true,
      slideTo: step.pslide === true ? this.slideTarget(ct, s, B, count, cp) : null,
      accent: step.accent === true,
      retrig: false,
      retrigIndex: 0,
      fill: this.isFill(B),
      conditionPassed: passed,
      condition: ct.condStr[s],
      loop,
      stepDuration: stepSec,
    };
    if (!passed || ev.trigless) {
      this.o.onTrig?.(ev);
      return;
    }
    // A new note cuts the track's running retrig
    if (this.rtOn[tr]) {
      this.flushRetrig(tr, t);
      this.rtOn[tr] = 0;
      this.rtBase[tr] = null;
    }
    if (step.retrig) this.setupRetrig(tr, ev, step, stepSec);
    this.noteOn(tr, ev);
  }

  private evalCond(tr: number, code: number, loop: number, B: number): boolean {
    let r: boolean;
    switch (code) {
      case C_PRE: return this.tCond[tr] === 1; // PRE / !PRE don't update the state
      case C_NOT_PRE: return this.tCond[tr] === 0;
      case C_NEI: r = this.tCond[this.nb[tr]] === 1; break;
      case C_NOT_NEI: r = this.tCond[this.nb[tr]] === 0; break;
      case C_FILL: r = this.isFill(B); break;
      case C_NOT_FILL: r = !this.isFill(B); break;
      case C_FIRST: r = loop === 0; break;
      case C_NOT_FIRST: r = loop !== 0; break;
      default:
        if (code >= 1000) {
          const a = Math.floor((code - 1000) / 16);
          const b = (code - 1000) % 16;
          r = loop % b === a - 1;
        } else if (code > 100) {
          r = this.rng() * 100 < code - 100;
        } else {
          r = true;
        }
    }
    this.tCond[tr] = r ? 1 : 0;
    return r;
  }

  private isFill(tick: number): boolean {
    return this.fillHeld || this.fillLatched || (tick >= this.cueStart && tick < this.cueEnd);
  }

  /** Parameter slide target: the next trig (note or lock) on the track in this pattern - the step itself a loop later if it is alone */
  private slideTarget(ct: CTrack, s: number, B: number, count: number, cp: CPattern): { time: number; locks: Readonly<Locks> } {
    const len = ct.len;
    let d = 1;
    while (d < len && ct.kind[(s + d) % len] === K_NONE) d++;
    const ns = (s + d) % len;
    const time = this.timeAt(B + d * ct.q) + this.swingOf(count + d, ct, cp) + (ct.micro[ns] / MICRO_PER_STEP) * ct.q * this.dur;
    return { time, locks: ct.steps[ns]?.locks ?? EMPTY_LOCKS };
  }

  // ==========================================================================
  // Notes, note-offs, retrigs
  // ==========================================================================

  private noteOn(tr: number, ev: TrigEvent): void {
    if (this.offOn[tr]) {
      const ot = this.offT[tr];
      if (ot <= ev.time) this.emitOff(tr, ot);
      else if (ev.slide) this.offOn[tr] = 0; // legato: the gate stays open into the slide
      else this.emitOff(tr, ev.time);
    }
    this.o.onTrig?.(ev);
    this.lastOn[tr] = ev.time;
    this.offT[tr] = ev.time + ev.duration;
    this.offN[tr] = ev.note;
    this.offOn[tr] = 1;
  }

  private emitOff(tr: number, time: number): void {
    this.offOn[tr] = 0;
    this.o.onNoteOff?.(tr, this.offN[tr], time);
  }

  private setupRetrig(tr: number, ev: TrigEvent, step: Step, stepSec: number): void {
    const r = step.retrig!;
    const rate = RETRIG_RATES[clamp(Math.round(r.rate), 0, RETRIG_RATES.length - 1)];
    const interval = (16 / rate) * stepSec;
    const rl = NOTE_LENGTHS[clamp(Math.round(r.len), 0, NOTE_LENGTHS.length - 1)];
    const fade = clamp(r.vel, -128, 127) / 128;
    this.rtOn[tr] = 1;
    this.rtNext[tr] = ev.time + interval;
    this.rtInt[tr] = interval;
    this.rtEnd[tr] = rl === Infinity ? Infinity : ev.time + rl * stepSec;
    this.rtStart[tr] = ev.time;
    this.rtSpan[tr] = (rl === Infinity ? 16 : rl) * stepSec;
    this.rtFade[tr] = fade;
    this.rtVel[tr] = ev.velocity;
    this.rtIdx[tr] = 1;
    this.rtDur[tr] = Math.min(ev.duration, interval);
    this.rtBase[tr] = ev;
    ev.retrig = true;
    ev.duration = this.rtDur[tr];
    ev.velocity = fadeVelocity(ev.velocity, fade, 0);
  }

  /** Release retrig sub-hits that start before `until` (a hit exactly on `until` waits: a trig there may cut it) */
  private flushRetrig(tr: number, until: number): void {
    let guard = 0;
    const limit = until - 1e-6;
    while (this.rtOn[tr] && this.rtNext[tr] < limit && guard++ < 512) {
      const t = this.rtNext[tr];
      if (t >= this.rtEnd[tr] - 1e-9) {
        this.rtOn[tr] = 0;
        this.rtBase[tr] = null;
        return;
      }
      const base = this.rtBase[tr]!;
      const p = Math.min(1, (t - this.rtStart[tr]) / this.rtSpan[tr]);
      this.rtNext[tr] = t + this.rtInt[tr];
      const ev: TrigEvent = {
        ...base,
        time: t,
        velocity: fadeVelocity(this.rtVel[tr], this.rtFade[tr], p),
        retrigIndex: this.rtIdx[tr]++,
        duration: this.rtDur[tr],
      };
      if (!this.isMuted(tr)) this.noteOn(tr, ev);
    }
  }

  /** Stop: release everything, forget the playing pattern */
  private halt(time: number): void {
    for (let tr = 0; tr < this.n; tr++) {
      if (this.offOn[tr]) this.emitOff(tr, Math.max(time, this.lastOn[tr] + 0.001));
      this.rtOn[tr] = 0;
      this.rtBase[tr] = null;
    }
    const wasPlaying = this.cur !== null;
    this.cur = null;
    this.queued = null;
    this.direct = null;
    this.tempReturn = null;
    this.startPending = false;
    this.lastTick = -1;
    this.swTick = -1;
    this.repTick = -1;
    this.cueStart = -1;
    this.cueEnd = -1;
    this.rowMuteOn = false;
    this.transpose = 0;
    this.external = false;
    this.selId = null;
    this.selOrigin = -1;
    this.uiLen = 0;
    this.uiHead = 0;
    this.uiId.fill(null);
    this.aSteps.fill(-1);
    this.aPattern = null;
    if (this.uiTimer !== null) this.timers.clearTimeout(this.uiTimer);
    this.uiTimer = null;
    if (wasPlaying) this.o.onPlay?.(false, time);
    this.changed();
  }

  /** Song reached its end (no loop) */
  private finish(): void {
    if (this.transport) this.followRunning = false;
    else {
      this.running = false;
      this.clearClock();
    }
    this.halt(this.time);
  }

  // ==========================================================================
  // Pattern changes, chains, songs
  // ==========================================================================

  /** First tick >= t0 on the grid origin + k * c, k >= 1 (never the grid's own start) */
  private nextOnGrid(t0: number, origin: number, c: number): number {
    const k = Math.max(1, Math.ceil((t0 - origin) / c));
    return origin + k * c;
  }

  /** First tick >= t0 on the current pattern's change grid; -1 when the change length is INF */
  private nextCycle(t0: number): number {
    const cp = this.cur;
    if (!cp) return t0;
    return cp.cycleTicks > 0 ? this.nextOnGrid(t0, this.patStart, cp.cycleTicks) : -1;
  }

  /** First master-step boundary at or after t0: immediate changes stay on the step grid */
  private nextStepTick(t0: number): number {
    const cp = this.cur;
    if (!cp) return t0;
    const e = t0 - this.epoch;
    return e <= 0 ? t0 : this.epoch + Math.ceil(e / cp.q) * cp.q;
  }

  private plan(): void {
    this.planDirty = false;
    this.swTick = -1;
    this.swKind = SW_NONE;
    this.swId = null;
    this.repTick = -1;
    const cp = this.cur;
    if (!cp) return;
    const t0 = this.lastTick + 1;
    const p = this.project;
    if (this.direct) {
      // DIRECT START waits for the next step so the new pattern stays on the grid; the jumps keep the position anyway
      this.swTick = this.direct.mode === 'direct-start' ? this.nextStepTick(t0) : t0;
      this.swKind = SW_DIRECT;
      this.swId = this.direct.id;
      return;
    }
    if (this.selId !== null) {
      this.swKind = SW_SELECT;
      this.swId = this.selId;
      if (this.selOrigin >= 0) this.swTick = t0;
      else if (this.selTime === -Infinity) this.swTick = this.nextStepTick(t0);
      else this.swTick = Math.max(t0, this.T + Math.max(0, Math.ceil((this.selTime - this.base) / this.dur - 0.5)));
      return;
    }
    const immediate = p.changeMode !== 'sequential';
    if (this.playMode === 'song') {
      // Song rows change on their own grid (row length, or the pattern's change length)
      const row = p.song.rows[this.songRow];
      if (row) {
        this.rowRepeats = row.repeats;
        this.rowForce = !!row.length;
        this.rowRepTicks = Math.max(1, row.length ? row.length * cp.q : cp.loopTicks);
      }
      const rowNext = this.nextOnGrid(t0, this.rowStart, this.rowRepTicks);
      if (!row || this.effectiveMode() !== 'song') {
        this.swTick = rowNext;
        this.swKind = SW_MODE;
        return;
      }
      if (this.rowJump >= 0) {
        this.swTick = immediate ? this.nextStepTick(t0) : rowNext;
        this.swKind = SW_ROW_JUMP;
        return;
      }
      this.swTick = Math.max(t0, this.rowStart + this.rowRepeats * this.rowRepTicks);
      this.swKind = SW_ROW;
      if (this.songRep + 1 < this.rowRepeats) this.repTick = Math.max(t0, this.rowStart + (this.songRep + 1) * this.rowRepTicks);
      return;
    }
    const next = this.nextCycle(t0);
    if (this.effectiveMode() !== this.playMode) {
      this.swTick = next;
      this.swKind = SW_MODE;
      return;
    }
    if (this.playMode === 'chain') {
      const chain = p.chain;
      if (this.chainJump >= 0) {
        this.swTick = immediate ? this.nextStepTick(t0) : next;
        this.swKind = SW_CHAIN_JUMP;
        this.swId = chain[clamp(this.chainJump, 0, chain.length - 1)];
        return;
      }
      this.swTick = next;
      this.swKind = SW_CHAIN;
      this.swId = chain[(clamp(this.chainPos, 0, chain.length - 1) + 1) % chain.length];
      return;
    }
    if (this.tempReturn) {
      this.swTick = next;
      this.swKind = SW_RETURN;
      this.swId = this.tempReturn;
      return;
    }
    if (this.queued && this.queued !== this.curId) {
      this.swTick = next;
      this.swKind = SW_SEQ;
      this.swId = this.queued;
    }
  }

  private songRepeat(T: number): void {
    this.songRep++;
    if (this.rowForce) this.restartAll(T);
    this.o.onSongRow?.(this.songRow, this.songRep, this.time);
    this.uiPush(UI_ROW, this.time, this.songRow, this.songRep, null);
    this.planDirty = true;
    this.plan();
  }

  private doSwitch(T: number): void {
    const p = this.project;
    switch (this.swKind) {
      case SW_SEQ:
        this.queued = null;
        this.install(this.swId!, T, T, false);
        break;
      case SW_DIRECT: {
        const d = this.direct!;
        this.direct = null;
        this.queued = null;
        if (d.mode === 'direct-start') {
          this.tempReturn = null;
          this.install(d.id, T, T, false);
        } else {
          if (d.mode === 'temp-jump') { if (!this.tempReturn) this.tempReturn = this.curId; }
          else this.tempReturn = null;
          this.install(d.id, T, this.patStart, true);
        }
        break;
      }
      case SW_RETURN: {
        const r = this.tempReturn!;
        this.tempReturn = null;
        this.install(r, T, T, false);
        break;
      }
      case SW_CHAIN:
      case SW_CHAIN_JUMP:
        this.chainPos = this.swKind === SW_CHAIN_JUMP
          ? clamp(this.chainJump, 0, p.chain.length - 1)
          : (clamp(this.chainPos, 0, p.chain.length - 1) + 1) % p.chain.length;
        this.chainJump = -1;
        this.install(p.chain[this.chainPos], T, T, false);
        this.uiPush(UI_CHAIN, this.time, this.chainPos, 0, null);
        break;
      case SW_ROW: {
        const r = this.nextRowIndex();
        if (r < 0) {
          this.finish();
          return;
        }
        this.installRow(r, T);
        break;
      }
      case SW_ROW_JUMP: {
        const r = clamp(this.rowJump, 0, p.song.rows.length - 1);
        this.rowJump = -1;
        this.installRow(r, T);
        break;
      }
      case SW_MODE:
        this.enterMode(T);
        break;
      case SW_SELECT: {
        const id = this.selId!;
        const origin = this.selOrigin;
        this.selId = null;
        this.selOrigin = -1;
        this.enterExternal();
        // Late call: line up with the tick it was meant for, joining mid-pattern
        if (origin >= 0) this.install(id, T, origin, true);
        else this.install(id, T, T, false);
        break;
      }
    }
    this.planDirty = true;
    this.plan();
  }

  // ==========================================================================
  // Compilation
  // ==========================================================================

  private compile(id: PatternId): CPattern {
    const pat = getPattern(this.project, id);
    const hit = this.patCache.get(pat);
    if (hit && hit.id === id) return hit;
    const perTrack = pat.scaleMode === 'track';
    const q = SPEED_TICKS[pat.speed] ?? TICKS_PER_16TH;
    const len = clamp(Math.round(pat.length) || 16, 1, MAX_STEPS);
    const tracks: CTrack[] = new Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const t = pat.tracks[i];
      const tq = perTrack && t?.speed ? SPEED_TICKS[t.speed] ?? q : q;
      const tl = perTrack && t?.length ? clamp(Math.round(t.length), 1, MAX_STEPS) : len;
      tracks[i] = this.compileTrack(t, tq, tl, i);
    }
    const masterTicks = perTrack ? (pat.master > 0 ? Math.round(pat.master) * q : 0) : len * q;
    // PER TRACK: CHG OFF follows the master length; both INF/OFF = the pattern never hands over
    const cycleTicks = perTrack ? (pat.change > 0 ? Math.round(pat.change) * q : masterTicks) : len * q;
    const cp: CPattern = {
      id,
      src: pat,
      tracks,
      q,
      masterTicks,
      cycleTicks,
      loopTicks: cycleTicks > 0 ? cycleTicks : len * q,
      swing: (clamp(pat.swing, SWING_MIN, SWING_MAX) - SWING_MIN) / 50,
    };
    this.patCache.set(pat, cp);
    return cp;
  }

  private compileTrack(t: Track | undefined, q: number, len: number, index: number): CTrack {
    if (t) {
      const c = this.trackCache.get(t);
      if (c && c.q === q && c.len === len) return c;
    }
    const src = t ?? createTrack(this.project.defaults[index]);
    const ct: CTrack = {
      src: t,
      q,
      len,
      mute: !!src.mute,
      prob: typeof src.prob === 'number' ? clamp(Math.round(src.prob), 0, 100) : 100,
      note: clamp(Math.round(src.note), 0, 127),
      vel: clamp(Math.round(src.vel), 1, 127),
      nlen: clamp(Math.round(src.len), 0, NOTE_LENGTHS.length - 1),
      kind: new Uint8Array(MAX_STEPS),
      cond: new Int16Array(MAX_STEPS),
      condStr: new Array<string>(MAX_STEPS).fill(''),
      micro: new Int8Array(MAX_STEPS),
      early: new Uint8Array(MAX_STEPS),
      steps: new Array<Step | undefined>(MAX_STEPS),
    };
    for (const k in src.steps) {
      const i = Number(k);
      if (!(i >= 0 && i < MAX_STEPS)) continue;
      const s = src.steps[i];
      if (!s) continue;
      ct.kind[i] = s.trigless ? K_LOCK : K_NOTE;
      ct.steps[i] = s;
      const code = compileCondition(s.cond);
      ct.cond[i] = code;
      ct.condStr[i] = code === C_NONE ? '' : conditionString(code);
      const m = clamp(Math.round(s.micro ?? 0), -23, 23);
      ct.micro[i] = m;
      ct.early[i] = m < 0 ? Math.ceil((-m * q) / MICRO_PER_STEP) : 0;
    }
    if (t) this.trackCache.set(t, ct);
    return ct;
  }

  // ==========================================================================
  // UI snapshot
  // ==========================================================================

  private uiPush(kind: number, time: number, a: number, b: number, id: PatternId | null): void {
    if (this.uiLen === UI_CAP) {
      this.uiId[this.uiHead] = null;
      this.uiHead = (this.uiHead + 1) % UI_CAP;
      this.uiLen--;
    }
    const i = (this.uiHead + this.uiLen) % UI_CAP;
    this.uiTime[i] = time;
    this.uiKind[i] = kind;
    this.uiA[i] = a;
    this.uiB[i] = b;
    this.uiId[i] = id;
    this.uiLen++;
  }

  /** Apply UI events that are audible by `now`. Returns whether anything changed. */
  private applyDue(now: number): boolean {
    let changed = false;
    while (this.uiLen > 0) {
      const i = this.uiHead;
      if (this.uiTime[i] > now + 0.004) break;
      switch (this.uiKind[i]) {
        case UI_STEP: this.aSteps[this.uiA[i]] = this.uiB[i]; break;
        case UI_PATTERN: this.aPattern = this.uiId[i]; break;
        case UI_ROW: this.aRow = this.uiA[i]; this.aRep = this.uiB[i]; break;
        case UI_CHAIN: this.aChain = this.uiA[i]; break;
      }
      this.uiId[i] = null;
      this.uiHead = (i + 1) % UI_CAP;
      this.uiLen--;
      changed = true;
    }
    if (changed) this.snap = null;
    return changed;
  }

  private armUi(): void {
    if (this.uiTimer !== null || this.uiLen === 0 || this.listeners.size === 0) return;
    const delay = Math.max(0, (this.uiTime[this.uiHead] - this.ctx.currentTime) * 1000);
    this.uiTimer = this.timers.setTimeout(this.onUiTimer, delay);
  }

  private onUiTimer = (): void => {
    this.uiTimer = null;
    if (this.applyDue(this.ctx.currentTime)) this.notify();
    this.armUi();
  };

  private changed(): void {
    this.snap = null;
    this.notify();
  }

  private notify(): void {
    if (!this.listeners.size) return;
    const s = this.getState();
    this.listeners.forEach(l => l(s));
  }

  private buildSnap(): SeqState {
    const playing = this.playing;
    const audible = this.cur ? this.aPattern ?? this.curId : null;
    const pendingSwitch = this.cur && audible !== this.curId ? this.curId : null;
    return {
      playing,
      following: this.transport !== null,
      mode: this.cur ? this.playMode : this.effectiveMode(),
      arranged: this.external && this.cur !== null,
      pattern: audible,
      queued: this.queued ?? this.direct?.id ?? this.selId ?? pendingSwitch ?? (this.cur ? null : this.startId),
      steps: Array.from(this.aSteps),
      fill: this.fillHeld || this.fillLatched || (this.cur !== null && this.lastTick >= this.cueStart && this.lastTick < this.cueEnd),
      fillLatched: this.fillLatched,
      fillCued: this.cuePending || this.cueEnd > this.lastTick,
      songRow: this.cur && this.playMode === 'song' ? this.aRow : this.songStart,
      songRepeat: this.cur && this.playMode === 'song' ? this.aRep : 0,
      chainIndex: this.cur && this.playMode === 'chain' ? this.aChain : this.chainStart,
      bpm: this.tempo,
      mutes: Array.from(this.runMute, v => v === 1),
    };
  }
}
