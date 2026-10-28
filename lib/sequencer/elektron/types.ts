// ============================================================================
// Elektron sequencer - data model
//
// Shared by the Analog Four MKII and Analog Rytm MKII twins. Everything here is
// plain JSON (no Infinity, no class instances) because it lives in
// DeviceModule.data and is saved to localStorage with the project.
//
// Compactness:
//   - patterns are stored sparsely: a project only holds the patterns that were
//     edited (`patterns.A01`, `patterns.C07`...); a missing id is an empty pattern
//   - steps are stored sparsely: `track.steps[12]` exists only when step 13 has a
//     trig; a missing field means "use the track default"
//   - note lengths, retrig rates and conditions are stored as small indices /
//     short strings (the hardware's own encoder positions)
//
// Behaviour follows the Analog Four MKII / Analog Rytm MKII manuals' sequencer
// chapters (see docs/ELEKTRON_SEQUENCER.md for what is and isn't modelled).
// ============================================================================

/** Sequencer resolution: 24 ticks per quarter note, the same as the studio transport */
export const SEQ_PPQN = 24;
/** Ticks per 16th note at 1x speed */
export const TICKS_PER_16TH = SEQ_PPQN / 4;

export const MAX_STEPS = 64;
export const PAGE_SIZE = 16;
export const MAX_PAGES = MAX_STEPS / PAGE_SIZE;

/** Banks A-H, 16 patterns each: ids "A01" ... "H16" */
export const BANKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const PATTERNS_PER_BANK = 16;
export type PatternId = string;

// ----------------------------------------------------------------------------
// Scale (speed)
// ----------------------------------------------------------------------------

/** SCALE menu speeds, fastest first (the hardware's order) */
export const SPEEDS = ['2x', '3/2x', '1x', '3/4x', '1/2x', '1/4x', '1/8x'] as const;
export type Speed = (typeof SPEEDS)[number];

/** 24-PPQN ticks per sequencer step at each speed (1x = a 16th note = 6 ticks) */
export const SPEED_TICKS: Readonly<Record<Speed, number>> = {
  '2x': 3,
  '3/2x': 4,
  '1x': 6,
  '3/4x': 8,
  '1/2x': 12,
  '1/4x': 24,
  '1/8x': 48,
};

/** PER PATTERN: every track shares the pattern's length and speed. PER TRACK: each track has its own. */
export type ScaleMode = 'pattern' | 'track';

/**
 * How a newly selected pattern takes over:
 *  sequential   at the end of the playing pattern (Elektron default)
 *  direct-start immediately, from step 1
 *  direct-jump  immediately, continuing from the current position
 *  temp-jump    like direct-jump, plays the new pattern once, then returns
 */
export type ChangeMode = 'sequential' | 'direct-start' | 'direct-jump' | 'temp-jump';
export const CHANGE_MODES: readonly ChangeMode[] = ['sequential', 'direct-start', 'direct-jump', 'temp-jump'];

/** What PLAY plays: the selected pattern, the chain (looped) or the song */
export type PlayMode = 'pattern' | 'chain' | 'song';
export const PLAY_MODES: readonly PlayMode[] = ['pattern', 'chain', 'song'];

// ----------------------------------------------------------------------------
// Note length (LEN) - the hardware's 128-position encoder scale
//
//   0.125 .. 2 steps in 1/16-step increments, then the increment doubles every
//   time the length doubles (2-4 by 1/8, 4-8 by 1/4 ... 64-128 by 4), and the
//   last position is INF. 1 step = a 16th note at 1x speed. Stored as the index.
// ----------------------------------------------------------------------------

function buildNoteLengths(): number[] {
  const out: number[] = [];
  for (let i = 2; i <= 16; i++) out.push(i / 16); // 0.125 .. 1
  let start = 1;
  let inc = 1 / 16;
  while (start < 128) {
    for (let k = 1; k <= 16; k++) out.push(start + k * inc);
    start *= 2;
    inc *= 2;
  }
  out.push(Infinity); // INF
  return out;
}

/** Steps for each LEN index 0..127 (index 127 = INF = Infinity) */
export const NOTE_LENGTHS: readonly number[] = buildNoteLengths();
export const LEN_INF = NOTE_LENGTHS.length - 1;
/** LEN index of exactly one step (1/16) - the default */
export const LEN_1_STEP = 14;
export const LEN_DEFAULT = LEN_1_STEP;

// ----------------------------------------------------------------------------
// Micro timing: -23/384 .. +23/384 of a whole note at 1x, i.e. 1/24 of a step
// per unit (the grid gets finer with the speed, like the hardware)
// ----------------------------------------------------------------------------

export const MICRO_MIN = -23;
export const MICRO_MAX = 23;
export const MICRO_PER_STEP = 24;

// ----------------------------------------------------------------------------
// Retrig (Analog Rytm): rate 1/1 .. 1/80 of a whole note (1/16 = once per step),
// length on the LEN scale (0.125 .. INF), velocity curve -128 .. +127
// ----------------------------------------------------------------------------

/** Denominators of the RATE values: 1/1, 1/2 ... 1/80 */
export const RETRIG_RATES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;
export const RETRIG_RATE_16 = 9;
export const RETRIG_RATE_32 = 12;
export const RETRIG_VEL_MIN = -128;
export const RETRIG_VEL_MAX = 127;

export interface Retrig {
  /** Index into RETRIG_RATES */
  rate: number;
  /** How long the retrigs run, index into NOTE_LENGTHS (LEN_INF = until the next trig) */
  len: number;
  /** Velocity curve over `len`: negative fades out, positive fades in, 0 = flat */
  vel: number;
}

export const RETRIG_DEFAULT: Readonly<Retrig> = { rate: RETRIG_RATE_32, len: 30 /* 2 steps */, vel: 0 };

// ----------------------------------------------------------------------------
// Trig conditions
//   A:B    true on loop A of every B loops of the track (1:2 ... 8:8)
//   X%     probability
//   FILL / !FILL   fill mode active / not active
//   PRE / !PRE     most recent condition on this track was true / false
//   NEI / !NEI     most recent condition on the neighbour track (the one before) was true / false
//   1ST / !1ST     first loop of the pattern / every loop but the first
// Stored as the display string; '' / missing = no condition.
// ----------------------------------------------------------------------------

/** The hardware's probability steps (21 values, plus 100% from later OS versions) */
export const PROBABILITIES = [1, 2, 4, 6, 9, 13, 19, 25, 33, 41, 50, 59, 67, 75, 81, 87, 91, 94, 96, 98, 99, 100] as const;
export const LOGIC_CONDITIONS = ['FILL', '!FILL', 'PRE', '!PRE', 'NEI', '!NEI', '1ST', '!1ST'] as const;

function buildAB(): string[] {
  const out: string[] = [];
  for (let b = 2; b <= 8; b++) for (let a = 1; a <= b; a++) out.push(`${a}:${b}`);
  return out;
}

/** A:B conditions in the hardware's order: 1:2, 2:2, 1:3, 2:3, 3:3, 1:4 ... 8:8 */
export const AB_CONDITIONS: readonly string[] = buildAB();

/** Every condition in encoder order ('' = none first) */
export const TRIG_CONDITIONS: readonly string[] = [
  '',
  ...PROBABILITIES.map(p => `${p}%`),
  ...LOGIC_CONDITIONS,
  ...AB_CONDITIONS,
];

export type TrigCondition = string;

// ----------------------------------------------------------------------------
// Pattern-level ranges
// ----------------------------------------------------------------------------

export const SWING_MIN = 50;
export const SWING_MAX = 80;
/** Master length / master change upper bound (in master steps) */
export const MASTER_MAX = 1024;
/** pattern.master = 0 means INF (tracks never restart together) */
export const MASTER_INF = 0;
/** pattern.change = 0 means OFF (pattern changes follow the master length) */
export const CHANGE_OFF = 0;
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 300;

// ----------------------------------------------------------------------------
// Data
// ----------------------------------------------------------------------------

/** Parameter locks: device parameter key -> value (the device decides the units) */
export type Locks = Record<string, number>;

/**
 * One trig. A step that has no entry in `track.steps` has no trig.
 * Every field is optional: missing = the track's default / off.
 */
export interface Step {
  /** Trigless lock trig: applies its locks at the step without playing a note */
  trigless?: true;
  /** MIDI note 0..127 (Rytm: pitch offset around the track's default) */
  note?: number;
  /** Velocity 1..127 */
  vel?: number;
  /** Note length, index into NOTE_LENGTHS */
  len?: number;
  /** Micro timing -23..+23 (1/24 step per unit) */
  micro?: number;
  /** Trig condition, e.g. '1:4', '50%', 'FILL', '!PRE' */
  cond?: TrigCondition;
  /** Retrig is on while this is set (Analog Rytm) */
  retrig?: Retrig;
  /** Note slide from the previous note (Analog Four) */
  slide?: true;
  /** Parameter slide from the previous trig's locks (Analog Four) */
  pslide?: true;
  /** Accent (Analog Rytm, also Analog Four) */
  accent?: true;
  /** Parameter locks for this trig only */
  locks?: Locks;
}

export interface TrackDefaults {
  /** Default note of the track's trigs */
  note: number;
  /** Default velocity 1..127 */
  vel: number;
  /** Default note length, index into NOTE_LENGTHS */
  len: number;
}

export interface Track extends TrackDefaults {
  /** Sparse steps keyed by step index 0..63 */
  steps: { [step: number]: Step };
  /** PER TRACK scale mode: this track's length 1..64 (default: the pattern length) */
  length?: number;
  /** PER TRACK scale mode: this track's speed (default: the pattern speed) */
  speed?: Speed;
  /** Track muted in this pattern */
  mute?: boolean;
}

export interface Pattern {
  name: string;
  /** Steps 1..64: the pattern length (PER PATTERN) / default track length (PER TRACK) */
  length: number;
  /** Pattern speed (PER PATTERN) / master speed (PER TRACK) */
  speed: Speed;
  scaleMode: ScaleMode;
  /** PER TRACK: master length in master steps (1..1024), MASTER_INF (0) = never restart all tracks */
  master: number;
  /** PER TRACK: master change - steps the pattern plays before a cued pattern starts (1..1024), CHANGE_OFF (0) = at the master length */
  change: number;
  /** Swing 50..80 % (50 = straight): delays every even 16th */
  swing: number;
  /** Opaque reference to the device's kit / sound setup ('' = none) */
  kit: string;
  tracks: Track[];
}

export interface SongRow {
  pattern: PatternId;
  /** Times the row plays (1..99) */
  repeats: number;
  /** Master steps per repeat (default: the pattern's own length / change) */
  length?: number;
  /** BPM while this row plays (internal clock only - the studio transport keeps its tempo) */
  tempo?: number;
  /** Tracks muted while this row plays (replaces the pattern's own track mutes) */
  mutes?: number[];
}

export interface Song {
  name: string;
  rows: SongRow[];
  /** At the end: jump back to `loopRow` (true) or stop (false) */
  loop: boolean;
  loopRow?: number;
}

export interface Project {
  /** Data format version */
  v: 1;
  /** Number of sequencer tracks (Analog Four: 4, Analog Rytm: 12) */
  tracks: number;
  /** Trig defaults for each track of a newly created pattern */
  defaults: TrackDefaults[];
  /** The selected pattern: what the trig keys edit, and what plays in PATTERN mode */
  active: PatternId;
  /** Sparse: only patterns that have been edited */
  patterns: Record<PatternId, Pattern>;
  chain: PatternId[];
  song: Song;
  mode: PlayMode;
  changeMode: ChangeMode;
}

// ----------------------------------------------------------------------------
// Scheduler output
// ----------------------------------------------------------------------------

/** One scheduled hit. Times are AudioContext seconds. */
export interface TrigEvent {
  track: number;
  step: number;
  pattern: PatternId;
  /** When the note starts (micro timing, swing and retrig offsets included) */
  time: number;
  /** Gate length in seconds; Infinity for LEN INF (the note-off comes with the next trig or stop) */
  duration: number;
  note: number;
  /** 1..127, after accent-free retrig velocity fading */
  velocity: number;
  /** The trig's parameter locks - apply for this note only. Shared with the project data: do not mutate. */
  locks: Readonly<Locks>;
  /** Lock trig: apply `locks` to the sounding voice, don't start a note */
  trigless: boolean;
  slide: boolean;
  paramSlide: boolean;
  accent: boolean;
  /** This hit belongs to a retrigged step */
  retrig: boolean;
  /** 0 = the trig itself, 1.. = retrig sub-hits */
  retrigIndex: number;
  /** Fill mode was active for this step */
  fill: boolean;
  /** False only when the sequencer was created with `emitFailed: true` and the condition failed */
  conditionPassed: boolean;
  /** The step's condition ('' = none) */
  condition: TrigCondition;
  /** The track's loop counter for this step (0 = first pass) */
  loop: number;
  /** Seconds per step on this track (useful for slide times) */
  stepDuration: number;
}

/** Playhead snapshot for the UI (what is audible now, not what is scheduled) */
export interface SeqState {
  playing: boolean;
  /** Following the studio transport (MIDI-clock style) */
  following: boolean;
  mode: PlayMode;
  /** Audible pattern */
  pattern: PatternId | null;
  /** Cued pattern (blinks on the hardware) */
  queued: PatternId | null;
  /** Audible step per track (-1 = none) */
  steps: number[];
  fill: boolean;
  fillLatched: boolean;
  fillCued: boolean;
  songRow: number;
  songRepeat: number;
  chainIndex: number;
  bpm: number;
  /** Runtime (performance) mutes, on top of the pattern's track mutes */
  mutes: boolean[];
}
