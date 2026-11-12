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
// Behaviour follows the Analog Four MKII (OS 1.55) / Analog Rytm MKII (OS 1.72)
// manuals' sequencer, chain and song chapters (see docs/ELEKTRON_SEQUENCER.md
// for the page references and what is and isn't modelled).
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

/**
 * SCALE menu speeds, fastest first (the manuals list the same seven slowest
 * first: A4 MKII manual p.48, Rytm MKII manual p.46). Per pattern, or per track
 * in ADVANCED (PER TRACK) mode.
 */
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

/**
 * PROJECT: one tempo for every pattern. PATTERN: each pattern keeps its own
 * tempo, which takes over when the pattern starts (internal clock only)
 * ([FUNC] + [YES] in the TEMPO menu, A4 MKII manual p.39, Rytm MKII manual p.38).
 */
export type TempoMode = 'project' | 'pattern';

/** TEMP JUMP state: armed ([FUNC] + [BANK D]), active (the jumped-to pattern plays), off */
export type TempJumpState = 'off' | 'armed' | 'active';

/** Notes a chord trig can hold: the Analog Four plays up to four on one track (A4 MKII manual p.28) */
export const CHORD_MAX = 4;
/** Largest chord offset from a trig's note, in semitones */
export const CHORD_SPAN = 48;

/** Most different parameters a pattern can lock: Analog Four 128 (A4 MKII manual p.50), Analog Rytm 72 (Rytm MKII manual p.47) */
export const LOCK_LIMIT_A4 = 128;
export const LOCK_LIMIT_RYTM = 72;

// ----------------------------------------------------------------------------
// Note length (LEN) - the hardware's 128-position encoder scale
//
//   0.125 .. 2 steps in 1/16-step increments, then the increment doubles every
//   time the length doubles (2-4 by 1/8, 4-8 by 1/4 ... 64-128 by 4), and the
//   last position is INF. 1 step = a 16th note at 1x speed: LEN 1/16 is one
//   step, 1/8 two, 1/4 four (A4 MKII manual p.41, Rytm MKII manual p.40); the
//   range is 0.125 step .. INF (Rytm MKII manual p.41). Stored as the index.
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
// per unit (the grid gets finer with the speed, like the hardware). One unit is
// 1/384 note (A4 MKII manual p.45); the micro timing pop-up spans one step on
// either side in 24 divisions (Rytm MKII manual p.39), so the range stops one
// unit short of the neighbouring steps.
// ----------------------------------------------------------------------------

export const MICRO_MIN = -23;
export const MICRO_MAX = 23;
export const MICRO_PER_STEP = 24;

/**
 * GLOBAL / TRACK QUANTIZE 0..127: pulls micro-timed trigs towards the grid
 * (127 = fully on the grid), non-destructively (A4 MKII manual p.47, Rytm MKII
 * manual p.45).
 */
export const QUANTIZE_MAX = 127;

// ----------------------------------------------------------------------------
// Retrig (Analog Rytm): rate 1/1 .. 1/80 of a whole note (1/16 = once per step,
// 1/32 twice, 1/12 and 1/24 triplets), length on the LEN scale (0.125 .. INF),
// velocity curve -128 (fade out completely) .. +127 (fade in from silence) over
// that length (Rytm MKII manual p.41-42)
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
// Trig conditions (A4 MKII manual p.50-51, Rytm MKII manual p.48-49)
//   A:B    true on loop A of every B loops of the track (1:2 ... 8:8)
//   X%     probability
//   FILL / !FILL   fill mode active / not active
//   PRE / !PRE     the most recently evaluated condition on this track was true /
//                  was not true (PRE and !PRE are not evaluated themselves, so
//                  they never change it; nothing evaluated yet = not true)
//   NEI / !NEI     the same for the neighbour track (the track before); NEI is
//                  false when the neighbour has no evaluated condition, !NEI true
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
  /**
   * Chord trig (Analog Four POLY): the trig's further notes, as semitone offsets from `note`
   * (non-zero, unique, -48..48; at most CHORD_MAX - 1 of them). A track playing polyphonically
   * sounds them together with `note`; a mono track plays `note` alone (A4 MKII manual p.28, p.42).
   */
  chord?: number[];
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
  /** Note slide: the previous note's pitch glides to this trig's note (Analog Four) */
  slide?: true;
  /**
   * Parameter slide: this trig's parameter values glide to the next trig's,
   * arriving when the next trig is reached (Analog Four). See TrigEvent.slideTo.
   */
  pslide?: true;
  /** Accent (Analog Rytm, also Analog Four) */
  accent?: true;
  /**
   * Trig mute: the trig is silenced - no note, no locks - while its condition
   * is still evaluated (TRIG MUTE menu, A4 MKII manual p.51, Rytm MKII manual p.49)
   */
  mute?: true;
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
  /**
   * Track muted in this pattern only. Not a hardware feature: the hardware's
   * track mutes are global (Project.mutes / ElektronSequencer.setMute) and
   * song mutes belong to a song position (SongRow.mutes).
   */
  mute?: boolean;
  /**
   * Track trig probability (PRB) 0..100 % (missing = 100), rolled again every
   * time a trig is due. A trig condition overrides it (A4 MKII manual p.45,
   * Rytm MKII manual p.43-44).
   */
  prob?: number;
  /** TRACK QUANTIZE 0..127 of the micro timing (the larger of this and Pattern.quantize applies) */
  quantize?: number;
}

export interface Pattern {
  name: string;
  /** Steps 1..64: the pattern length (PER PATTERN) / default track length (PER TRACK) */
  length: number;
  /** Pattern speed (PER PATTERN) / master speed (PER TRACK) */
  speed: Speed;
  scaleMode: ScaleMode;
  /**
   * PER TRACK: master length in master steps (1..1024): every track restarts
   * after it. MASTER_INF (0) = the tracks loop on their own and never restart
   * together (A4 MKII manual p.49, Rytm MKII manual p.47).
   */
  master: number;
  /**
   * PER TRACK: master change - master steps the pattern plays before a cued or
   * chained pattern starts (1..1024). CHANGE_OFF (0, the hardware default) = at
   * the master length; with the master length at INF too the pattern plays
   * forever and a SEQUENTIAL change never happens (DIRECT modes still work,
   * Rytm MKII manual p.47).
   */
  change: number;
  /**
   * Swing 50..80 % (50 = straight, 51-80 % swing, Rytm MKII manual p.50): the
   * share of each pair of steps taken by the first one, so a swing trig's step
   * is late by (swing-50)/50 of a step.
   */
  swing: number;
  /**
   * Swing trigs: the step indices (0..63) that swing. Missing = the default,
   * every second step (keys 2, 4, 6...). One set for the pattern; a step swings
   * on every track that plays it (A4 MKII manual p.38, Rytm MKII manual p.50).
   */
  swingTrigs?: number[];
  /** Opaque reference to the device's kit / sound setup ('' = none) */
  kit: string;
  /** This pattern's BPM in PATTERN tempo mode (Project.tempoMode) */
  tempo?: number;
  /** GLOBAL QUANTIZE 0..127 of the micro timing (A4 MKII manual p.47, Rytm MKII manual p.45) */
  quantize?: number;
  tracks: Track[];
}

/** One pattern position in a song row: its pattern, song mutes and transpose */
export interface SongEntry {
  pattern: PatternId;
  /** Song mutes of this position (replace the pattern's own track mutes while it plays) */
  mutes?: number[];
  /** Semitones added to every note at this position (Analog Four song transpose), -48..48 */
  transpose?: number;
}

/**
 * A song row: a pattern, or a chain of patterns (`pattern` then `chain`), played
 * `repeats` times. Song mutes and transpose belong to each pattern position
 * (A4 MKII manual p.56-57, Rytm MKII manual p.54-55). The row itself is the
 * first position.
 */
export interface SongRow extends SongEntry {
  /** Times the row plays (1..99) */
  repeats: number;
  /** The row's further pattern positions, played in order after `pattern` */
  chain?: SongEntry[];
  /**
   * Master steps each pattern position plays per repeat (default: the pattern's
   * own length / change). Not on the A4 / Rytm MKII: their rows always play
   * whole patterns.
   */
  length?: number;
  /**
   * BPM from the start of this row (internal clock only - the studio transport
   * keeps its tempo). Not on the A4 / Rytm MKII: they change tempo per pattern
   * (Project.tempoMode 'pattern').
   */
  tempo?: number;
}

export interface Song {
  name: string;
  rows: SongRow[];
  /**
   * At the end: jump back to `loopRow` (true) or stop (false). The A4 / Rytm
   * MKII songs play their rows once and stop - their song chapters have no
   * loop setting (A4 MKII manual p.55-57, Rytm MKII manual p.53-55).
   */
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
  /**
   * Track mutes ([FUNC] + [TRACK] on the A4, MUTE mode on the Rytm): global,
   * kept through pattern changes and saved with the project, and they win over
   * trig mutes and song mutes (A4 MKII manual p.16, p.37; Rytm MKII manual p.23).
   */
  mutes?: number[];
  /** PROJECT (default) or PATTERN tempo mode */
  tempoMode?: TempoMode;
  /**
   * RELOAD PATTERN / RELOAD TRACK restore point of the active pattern: its
   * state when it was selected (the auto-save) or at the last SAVE PATTERN /
   * SAVE TRACK. Selecting another pattern replaces it (A4 MKII manual p.42-43,
   * Rytm MKII manual p.42-43, p.51-52). null pattern = the slot was empty.
   */
  restore?: { id: PatternId; pattern: Pattern | null };
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
  /** MIDI note: the step's note (or the track default) plus any song-row transpose */
  note: number;
  /** 1..127, after retrig velocity fading (accent is a separate flag) */
  velocity: number;
  /** The trig's parameter locks - apply for this note only. Shared with the project data: do not mutate. */
  locks: Readonly<Locks>;
  /** Lock trig: apply `locks` to the sounding voice, don't start a note */
  trigless: boolean;
  /** Note slide: glide from the previous note to `note`. The previous gate stays open (no note-off) when they overlap. */
  slide: boolean;
  /** Parameter slide starts here: glide this trig's values to `slideTo`'s */
  paramSlide: boolean;
  /**
   * Parameter slide target: the next trig on the track (its audio time and
   * locks; parameters it doesn't lock glide back to the track values). Looked
   * up in the playing pattern, so a pattern change before it may make it moot.
   * Null unless `paramSlide`.
   */
  slideTo: { time: number; locks: Readonly<Locks> } | null;
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
  /** Play mode in effect (PATTERN while the song arranger drives the patterns) */
  mode: PlayMode;
  /** The studio song arranger picked the playing pattern (selectPattern) */
  arranged: boolean;
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
  /** Internal clock paused ([PLAY] while playing): resume() continues from here */
  paused?: boolean;
  /** Soloed tracks (Rytm [RTRG] + pad): while any is on, the others are muted */
  solos?: boolean[];
  /** Pattern position in the playing (or cued) song row's chain */
  songPos?: number;
  /** TEMP JUMP: armed (blinks), active (the jumped-to pattern plays) or off */
  tempJump?: TempJumpState;
  /** The change mode the next pattern selection uses (a used TEMP JUMP falls back to the mode before it) */
  changeMode?: ChangeMode;
}
