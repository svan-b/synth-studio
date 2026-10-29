// ============================================================================
// SYNTH STUDIO - Type Definitions
// Data-driven architecture for multi-device synthesizer learning platform
// ============================================================================

// ----------------------------------------------------------------------------
// Control Types
// ----------------------------------------------------------------------------

export type ControlType = 'knob' | 'slider' | 'button' | 'switch' | 'jack' | 'pattern';
export type Units =
  | 'Hz' | 'ms' | 's' | 'octaves' | '%' | 'dB' | 'semitones' | 'cents' | 'BPM' | 'V'
  | 'ratio' | 'steps' | 'none';
export type KnobSize = 'small' | 'medium' | 'large';
export type JackType = 'input' | 'output';
export type SignalType = 'audio' | 'cv' | 'gate' | 'trigger' | 'clock';

export interface Position {
  x: number;
  y: number;
}

// ----------------------------------------------------------------------------
// Control Specifications (Data-Driven)
// ----------------------------------------------------------------------------

interface BaseControlSpec {
  type: ControlType;
  label: string;
  description?: string;  // For teaching tooltips
  manualReference?: string;  // e.g., "Page 12, Section 3"
}

export interface KnobSpec extends BaseControlSpec {
  type: 'knob';
  min: number;
  max: number;
  default: number;
  units: Units;
  bipolar?: boolean;
  size?: KnobSize;
  step?: number;  // For stepped controls
  curve?: 'linear' | 'logarithmic' | 'exponential';  // Knob travel → value mapping
  endless?: boolean;  // Endless encoder (Elektron style) - drawn without end stops
  format?: (value: number) => string;  // Custom display formatting
}

export interface SliderSpec extends BaseControlSpec {
  type: 'slider';
  min: number;
  max: number;
  default: number;
  units: Units;
  bipolar?: boolean;
  step?: number;
  curve?: 'linear' | 'logarithmic' | 'exponential';
  format?: (value: number) => string;
}

// Hidden data control - stores a step pattern as a string, one character per step.
// '0' = step off, any other character = step on (devices may use '1'-'9' for accents/ratchets).
export interface PatternSpec extends BaseControlSpec {
  type: 'pattern';
  steps: number;
  default: string;
}

export interface SwitchSpec extends BaseControlSpec {
  type: 'switch';
  options: string[];
  default: number;  // Index into options
}

export interface ButtonSpec extends BaseControlSpec {
  type: 'button';
  momentary?: boolean;  // true = trigger, false = toggle
  ledColor?: string;
  default: boolean;
}

export interface JackSpec extends BaseControlSpec {
  type: 'jack';
  jackType: JackType;
  signalType: SignalType;
  normalled?: string;  // ID of internally connected jack
}

export type ControlSpec = KnobSpec | SliderSpec | SwitchSpec | ButtonSpec | JackSpec | PatternSpec;

export type ControlValue = number | string | boolean;

// ----------------------------------------------------------------------------
// Signal Flow Section (Organizes controls by function)
// ----------------------------------------------------------------------------

export interface SignalFlowSection {
  id: string;
  name: string;
  description?: string;
  order: number;  // For rendering order
  controls: string[];  // Control IDs in this section
  layout?: {
    position: Position;
    width: number;
    height: number;
  };
}

// ----------------------------------------------------------------------------
// Patch Bay
// ----------------------------------------------------------------------------

export interface PatchPoint {
  id: string;
  label: string;
  jackType: JackType;
  signalType: SignalType;
  column: number;  // 0, 1, 2 for 3-column layout
  row: number;
  normalled?: string;  // Internally connected to this jack by default
}

export interface PatchConnection {
  from: string;  // Output jack ID
  to: string;    // Input jack ID
  color?: string;
}

// ----------------------------------------------------------------------------
// Device Specification
// ----------------------------------------------------------------------------

export interface DeviceSpec {
  // Identity
  id: string;
  name: string;
  manufacturer: string;
  year?: number;
  description?: string;
  manualUrl?: string;

  // Physical dimensions (for accurate layout)
  dimensions: {
    width: number;   // mm
    height: number;  // mm
    depth?: number;  // mm
    eurorackHP?: number;  // Eurorack width in HP
  };

  // Display sizing
  display: {
    width: number;   // px
    height: number;  // px
    scale: number;   // px per mm
  };

  // Signal flow architecture
  signalFlow: SignalFlowSection[];

  // All controls
  controls: Record<string, ControlSpec>;

  // Patch bay configuration
  patchBay?: {
    inputs: PatchPoint[];
    outputs: PatchPoint[];
  };

  // Factory presets
  presets?: Record<string, PresetSpec>;
}

// ----------------------------------------------------------------------------
// Presets
// ----------------------------------------------------------------------------

export interface PresetSpec {
  name: string;
  description?: string;
  source: 'manual' | 'community' | 'factory';
  author?: string;
  settings: Record<string, number | string | boolean>;
  patchConnections?: PatchConnection[];
}

// ----------------------------------------------------------------------------
// Teaching / Lessons
// ----------------------------------------------------------------------------

// Synthesis concept categories
export type SynthConcept =
  | 'oscillator-pitch'
  | 'oscillator-waveform'
  | 'oscillator-sync'
  | 'frequency-modulation'
  | 'subharmonics'
  | 'noise'
  | 'mixing'
  | 'envelope-attack'
  | 'envelope-decay'
  | 'envelope-sustain'
  | 'envelope-release'
  | 'envelope-shape'
  | 'filter-cutoff'
  | 'filter-resonance'
  | 'filter-type'
  | 'lfo'
  | 'modulation-source'
  | 'modulation-depth'
  | 'signal-routing'
  | 'velocity-dynamics'
  | 'glide'
  | 'timing-tempo'
  | 'sequencer-pattern'
  | 'polyrhythm'
  | 'parameter-locks'
  | 'effects'
  | 'equalization'
  | 'dj-mixing'
  | 'gain-staging';

export interface LessonStep {
  // For control adjustments
  control?: string;  // Control ID (optional if this is a patch step)
  targetValue?: number | string | boolean;
  tolerance?: number;  // Optional absolute tolerance override for numeric targets

  // For patch connection steps
  patchFrom?: string;  // Output jack ID
  patchTo?: string;    // Input jack ID

  // Common fields
  instruction: string;
  explanation?: string;  // Why this setting matters
  manualReference?: string;
  audioExample?: string;  // URL to audio demo

  // First principles teaching fields
  concept?: SynthConcept;  // What concept this step teaches
  principle?: string;      // One-liner fundamental truth about synthesis

  // ---- v2: active-learning step kinds (see docs/PEDAGOGY.md) ---------------
  /**
   * do       - set a control (control + targetValue)            [default when control is set]
   * patch    - connect two jacks (patchFrom + patchTo)            [default when patchFrom is set]
   * info     - read/listen, then press Next
   * predict  - answer `predict` first, then do the action and hear whether you were right
   * listen   - A/B comparison of two settings, optional question
   * match    - ear training: recreate `match.target` by ear, then Check
   * quiz     - retrieval question
   * reflect  - explain it in your own words, compare with a model answer, rate yourself
   * challenge- open brief with a checklist; done when every check passes
   */
  kind?: 'do' | 'patch' | 'info' | 'predict' | 'listen' | 'match' | 'quiz' | 'reflect' | 'challenge';
  predict?: MultipleChoice;
  listen?: {
    a: Record<string, ControlValue>;
    b: Record<string, ControlValue>;
    labels?: [string, string];
    question?: MultipleChoice;
    // ---- v3, studio state (docs/PEDAGOGY.md "Lesson API v3 – studio state") ----
    /**
     * Play both sides at the same loudness: each side's loudness is measured on the master
     * meter (momentary LUFS) and the louder one is turned down after the master, so "louder"
     * never wins by default. The coach shows the gain it applied.
     */
    matchLoudness?: boolean;
    /** Values on several instruments at once: { [instance or device]: values } per side */
    parts?: { a: Record<string, Record<string, ControlValue>>; b: Record<string, Record<string, ControlValue>> };
    /** The studio master section per side: fader into the limiter (dB), glue and EQ on/off */
    master?: { a: LessonMasterPatch; b: LessonMasterPatch };
    /** Studio-wide settings per side (swing 0..0.75) */
    studio?: { a: { swing?: number }; b: { swing?: number } };
    /**
     * Elektron pattern settings per side: { [instance or device]: { swing } }. Every pattern of
     * the instrument plays with them while the side plays (whichever pattern the song is on);
     * the learner's patterns are not changed.
     */
    patterns?: { a: Record<string, LessonPatternPatch>; b: Record<string, LessonPatternPatch> };
    /** Start the A/B from this song section (by name), so both sides play the same part of the song */
    from?: string;
  };
  match?: {
    target: Record<string, ControlValue>;
    /** The controls the learner must get right (others are set from `target` before the step) */
    controls: string[];
    patches?: PatchConnection[];
    /** Allowed knob-travel error 0..1 (default 0.08) */
    tolerance?: number;
    /**
     * v3: an Elektron pattern setting to match by ear on the step's instrument (its active
     * pattern), next to or instead of `controls`. `start` is set when the step begins. The
     * tolerance is knob travel too: SWING's travel is 50..80 %, so 0.1 is ±3 %.
     */
    pattern?: { target: { swing: number }; start?: { swing: number } };
  };
  quiz?: MultipleChoice;
  reflect?: { prompt: string; model: string };
  checklist?: { text: string; check?: (s: LessonCheckState) => boolean }[];
  /** Custom completion test - sequencer tasks, multi-device tasks */
  check?: (s: LessonCheckState) => boolean;
  /** Values (and cables) applied when the step begins */
  setup?: Record<string, ControlValue>;
  setupPatches?: PatchConnection[];
  /** Controls/jacks to spotlight when the step isn't about a single control */
  focus?: string[];
  /** Instance this step acts on (multi-device lessons); defaults to the lesson's device */
  instance?: string;
  /** Play the device's demo phrase when the step starts */
  autoplay?: boolean;
  /** Hint ladder - revealed one at a time on request (guidance that fades) */
  hints?: string[];
  /** One way to satisfy an open challenge - used by "show me" and the automated lesson runner */
  solution?: LessonSolution;

  // ---- v3: performance actions, scope (see docs/PEDAGOGY.md) ----------------
  /**
   * Presses needed to finish the step (default 1). A `do` step whose `control` is a
   * momentary button (TRIGGER, ADVANCE, TAP...) completes once the learner has pressed
   * it this many times during the step - no `targetValue` needed. Also works on toggle
   * buttons ("press RUN / STOP twice") and together with `event`.
   */
  presses?: number;
  /**
   * A `do` step about a button that has no control of its own - pads, trig keys,
   * transport keys. Name the button's `event` from the layout; the step completes after
   * `presses` presses. The button is highlighted like a control target.
   */
  event?: string;
  /**
   * A `do` step about playing the keys (on-screen keys, computer keyboard or MIDI):
   * `count` notes of any pitch, or exactly `notes` (MIDI numbers, in this order).
   */
  play?: { count?: number; notes?: number[]; anyOctave?: boolean };
  /** Scope view for this step - 'spectrum' for EQ and filter work. The coach switches to it; the learner can still change it. */
  scope?: 'wave' | 'spectrum' | 'both';

  // ---- v3, studio state (docs/PEDAGOGY.md "Lesson API v3 – studio state") ----
  /**
   * Live numbers the coach shows under the step: 'loudness' (LUFS M / S / I and the time
   * measured), 'peaks' (pre-limiter peak and true peak), 'limiter' (gain reduction now and
   * the most since Play), 'channels' (every mixer-device channel meter, with PK).
   */
  readout?: ('loudness' | 'peaks' | 'limiter' | 'channels')[];
  /** Where on screen the step happens: the coach offers to take the learner there */
  area?: 'mixer' | 'master' | 'arranger' | 'transport' | 'rack';
  /**
   * Arranger snapshots of chosen controls: the coach shows one "capture" button per song
   * section that stores only these controls of the instrument (now) in that section's
   * snapshot, merged with what the snapshot already holds.
   */
  capture?: { instance: string; controls: string[]; label?: string };
}

/**
 * Settings of an Elektron sequencer pattern (Analog Rytm, Analog Four) that lessons can A/B,
 * match and set like controls (Lesson API v3). On the hardware they live in the pattern, not
 * in a knob: SWING in the SWING menu, LENGTH in the SCALE menu.
 */
export interface LessonPatternPatch {
  /** SWING, 50 (straight) .. 80 %: every swing trig (by default every second 16th) plays (swing - 50) / 50 of a step late */
  swing?: number;
  /** LENGTH in steps, 1..64. A longer length copies the existing pages into the new ones, as the SCALE menu does */
  length?: number;
}

/** A trig on an Elektron sequencer, as a lesson solution writes it (the shared sequencer's Step) */
export interface LessonTrig {
  /** MIDI note (60 = C4) */
  note?: number;
  vel?: number;
  /** Note length: an index into NOTE_LENGTHS (14 = one step, 1/16) */
  len?: number;
  /** Micro timing, -23..23 (1/384 of a whole note) */
  micro?: number;
  /** Trig condition: '1:2' … '8:8', 'X%', FILL, !FILL, PRE, !PRE, NEI, !NEI, 1ST, !1ST */
  cond?: string;
  /** Parameter locks: lock key (the control id without the track prefix) -> value */
  locks?: Record<string, number>;
  /** A lock trig: parameters only, no note */
  trigless?: boolean;
  accent?: boolean;
  slide?: boolean;
  pslide?: boolean;
  retrig?: { rate: number; len: number; vel: number };
}

/**
 * Elektron sequencer edits in a lesson solution: set or clear trigs on one track. Trigs are
 * numbered 1..64 like the trig keys (and the lesson text): trig 17 is page 2's first key.
 */
export interface LessonSequenceEdit {
  /** Instance or device (default: the step's instrument) */
  instance?: string;
  /** Pattern id (default: the instrument's active pattern) */
  pattern?: string;
  /** Track index, 0-based (Analog Rytm BD 0 … CB 11, FX 12; Analog Four T1 0 … T4 3) */
  track: number;
  /** Remove every trig of the track first */
  clear?: boolean;
  /** Trig number (1-based) -> its fields (merged into what is there, locks too) or null to remove it */
  trigs: Record<number, LessonTrig | null>;
}

/** A studio master section patch (lesson A/B, solutions) */
export interface LessonMasterPatch {
  /** Master fader in dB: the gain into the limiter */
  gain?: number;
  glue?: { on?: boolean; threshold?: number; ratio?: number; attack?: number; release?: number; auto?: boolean; makeup?: number; mix?: number };
  eq?: { on?: boolean; low?: number; tilt?: number; high?: number };
}

/** A studio cable in a start state or solution: each end by instance id */
export interface LessonStudioCable {
  from: { instance: string; jack: string };
  to: { instance: string; jack: string };
  color?: string;
}

/**
 * A whole studio a lesson starts from ("checkpoint"): rack, every instrument's settings,
 * routes, sync, cables, the mix, the song and the tempo. The learner's own studio is saved
 * first and can be restored with one press (store: lessonBackups).
 */
export interface LessonStudioStart {
  /** Instruments in rack order. Each starts from its defaults plus `values` (or keeps its settings with `keep`) */
  rack: {
    id: string;
    device: string;
    label?: string;
    values?: Record<string, ControlValue>;
    patches?: PatchConnection[];
    data?: unknown;
    /** Keep the instrument's current settings (and data) when it is already in the rack; `values` still apply */
    keep?: boolean;
  }[];
  /** instance -> 'master' | '<mixer instance>:<input>' */
  routes?: Record<string, string>;
  /** instance -> follows the studio clock */
  sync?: Record<string, boolean>;
  cables?: LessonStudioCable[];
  bpm?: number;
  /** Studio swing, 0..0.75 of a 16th (TransportBar shows 50 % + swing × 50) */
  swing?: number;
  /** The studio mixer: channel strips per instance, the returns and the master section. Anything left out is at its default. */
  mixer?: {
    channels?: Record<string, { gain?: number; pan?: number; mute?: boolean; solo?: boolean; sendA?: number; sendB?: number }>;
    delay?: { level?: number; mute?: boolean; division?: string; feedback?: number; tone?: number; pingPong?: boolean };
    reverb?: { level?: number; mute?: boolean; decay?: number; damping?: number; predelay?: number; size?: number };
    master?: LessonMasterPatch;
  };
  /** The song: sections in order (ids are generated) */
  arrangement?: {
    enabled?: boolean;
    loop?: boolean;
    sections: { name: string; bars: number; color?: string; parts?: Record<string, { pattern?: string; snapshot?: Record<string, ControlValue>; muted?: boolean }> }[];
  };
  /** Instance shown first (and the default instance of steps without one) */
  focus?: string;
  /**
   * The lesson also works on the learner's own studio. The coach then offers "Use my own
   * studio": this sentence says what that studio needs ("a mix with at least two channels").
   */
  ownStudio?: string;
  /**
   * Pressing ▶ parks clock-stepped sequencers (a DFAM clocked from the Studio Clock) so their
   * step 1 lands on the bar the song starts from, the way a reset input would. Default true.
   */
  alignClocked?: boolean;
}

/** One way to complete a step - "show me" and the automated lesson runner use it */
export interface LessonSolution {
  values?: Record<string, ControlValue>;
  patches?: PatchConnection[];
  data?: unknown;
  /** Instance the values, patches and presses apply to (default: the step's instance) */
  instance?: string;
  /** Buttons to press, in order: control ids or event names */
  presses?: string[];
  /** Notes to play, in order (MIDI numbers) */
  notes?: number[];
  /** Cables between instruments; name each end by `instance` or by `device` (its first instance in the rack) */
  studioCables?: { from: { instance?: string; device?: string; jack: string }; to: { instance?: string; device?: string; jack: string } }[];
  /** Start or stop the studio transport */
  transport?: 'play' | 'stop';

  // ---- v3, studio state ------------------------------------------------------
  /** Values on several instruments: { [instance or device]: values } */
  parts?: Record<string, Record<string, ControlValue>>;
  /** The studio master section */
  master?: LessonMasterPatch;
  /** Studio mixer channel strips: { [instance or device]: fader dB, pan, sends... } */
  channels?: Record<string, { gain?: number; pan?: number; mute?: boolean; solo?: boolean; sendA?: number; sendB?: number }>;
  /** Studio tempo, swing and routing */
  studio?: { bpm?: number; swing?: number; routes?: Record<string, string>; sync?: Record<string, boolean> };
  /** Replace the song (same shape as a start state's arrangement) */
  arrangement?: LessonStudioStart['arrangement'];
  /**
   * Arranger snapshots to capture, in order: the instrument's current knobs (or only
   * `controls`) become the snapshot of that section (by name, case-insensitive)
   */
  capture?: { section: string; instance: string; values?: Record<string, ControlValue>; controls?: string[] }[];
  /**
   * Play the studio (from bar 1 with `fromStart`, or the whole song with `song`) and keep
   * playing for `seconds`, so meter checks have something to measure (the lesson runner waits)
   */
  play?: { seconds?: number; fromStart?: boolean; song?: boolean; from?: string };
  /** Bounce the song (Bounce dialog), optionally with stems. The runner waits until it is done. */
  bounce?: { stems?: boolean };
  /** Press this button (control id or event name, on the solution's instrument) until the step is done, 16 times at most */
  pressUntilDone?: string;
  /** Record with REC for `seconds` (optionally with stems) */
  record?: { seconds: number; stems?: boolean };
  /** Elektron pattern settings on an instrument's active pattern: { [instance or device]: { swing, length } } */
  patterns?: Record<string, LessonPatternPatch>;
  /**
   * Elektron sequencer edits, in order: trigs set or cleared on the learner's pattern (not a
   * replacement of the whole project, so they also work in the learner's own studio)
   */
  sequence?: LessonSequenceEdit[];
}

export interface MultipleChoice {
  question: string;
  options: string[];
  /** Index of the correct option */
  answer: number;
  /** Shown after answering - why the answer is right */
  explain?: string;
}

/** What lesson checks can inspect */
export interface LessonCheckState {
  values: Record<string, ControlValue>;
  patches: PatchConnection[];
  data: unknown;
  engine: Record<string, unknown>;
  /** All studio instances (multi-device lessons) */
  instances: Record<string, { device: string; values: Record<string, ControlValue>; patches: PatchConnection[]; data: unknown }>;
  studioCables: { from: { instance: string; jack: string }; to: { instance: string; jack: string } }[];
  routes: Record<string, string>;
  /** instance -> follows the studio clock (missing = default on for MIDI-syncable gear) */
  sync: Record<string, boolean>;
  /** `swing` (v3): studio swing 0..0.75 of a 16th; 0.08 = 54 % */
  transport: { playing: boolean; bpm: number; swing?: number };
  arrangement: { enabled: boolean; loop: boolean; sections: { name: string; bars: number; parts: Record<string, { pattern?: string; snapshot?: unknown; muted?: boolean }> }[] };
  /**
   * Presses the learner made during this step on the step's instrument, keyed by control
   * id and by event name: momentary buttons, pads, trig keys, transport keys
   * (`s.events?.trigger >= 3`). Always present while a lesson runs; optional in the type so
   * test harnesses that build a state by hand still compile.
   */
  events?: Record<string, number>;
  /** Notes the learner played during this step on the step's instrument, oldest first (on-screen keys, computer keyboard, MIDI) */
  notesPlayed?: number[];
  /** Presses during this step on every instrument: instance -> id -> count (studio lessons) */
  eventsByInstance?: Record<string, Record<string, number>>;

  // ---- v3, studio state (docs/PEDAGOGY.md "Lesson API v3 – studio state") --------
  // Optional in the type so hand-built states still compile; set while a lesson runs.
  /** The studio mixer with defaults filled in: channel strips by instance, returns, master */
  mixer?: LessonMixerView;
  /** The studio master section in curriculum terms (the limiter is always on, -1 dBTP) */
  master?: { gainDb: number; limiterOn: boolean; ceilingDbTP: number; glueOn: boolean; eqOn: boolean };
  /** Live meters: the studio master (BS.1770-4) and every channel meter */
  meters?: LessonMeters;
  /** REC and Bounce: in progress, and the last finished take */
  bounce?: LessonBounceState;
  /** What the learner did since the lesson started */
  history?: LessonHistory;
  /** The song position while song mode plays: section index (-1 when stopped) and bar in it (0-based) */
  arranger?: { section: number; bar: number; name?: string };
}

export interface LessonMixerView {
  channels: Record<string, { gain: number; pan: number; mute: boolean; solo: boolean; sendA: number; sendB: number }>;
  delay: { level: number; mute: boolean; division: string; feedback: number; tone: number; pingPong: boolean };
  reverb: { level: number; mute: boolean; decay: number; damping: number; predelay: number; size: number };
  master: { gain: number; eq: { on: boolean; low: number; tilt: number; high: number }; glue: { on: boolean; threshold: number; ratio: number; attack: number; release: number; auto: boolean; makeup: number; mix: number } };
}

/** The studio master meter, as lesson checks see it. dB values are -Infinity for silence. */
export interface LessonMasterMeters {
  /** LUFS now: momentary (0.4 s), short-term (3 s), integrated since Play (null below the gate) */
  lufsM: number | null;
  lufsS: number | null;
  lufsI: number | null;
  /** Loudest short-term loudness since Play */
  lufsSMax: number | null;
  /** Sample peak going into the limiter (after the master fader): the last 3 s, and the most since Play, dBFS */
  peakDb: number;
  maxPeakDb: number;
  /** True peak of the output (4x oversampled): the last 3 s, and the most since Play, dBTP */
  truePeakDb: number;
  maxTruePeakDb: number;
  /** Limiter gain reduction: the last second, and the most since Play, dB */
  grDb: number;
  maxGrDb: number;
  /** Glue compressor gain reduction now, dB */
  glueGrDb: number;
  /** 50 ms windows that went over 0 dBFS before the limiter since Play */
  overs: number;
  /** Seconds of playing measured since Play */
  measuredSec: number;
  /** This measurement started at bar 1 (the song from the top) */
  fromStart: boolean;
  /** Nothing in the mix or the master changed since Play (song automation excluded) */
  steady: boolean;
}

export interface LessonChannelMeter {
  /** Highest reading in the last 2 s and now, in the meter's own unit (dBu on a Xone:96, dBFS on a studio strip) */
  peak: number;
  now: number;
  /** PK (the overload LED) lit in the last 2 s */
  pk: boolean;
  /** Highest reading since Play */
  maxSincePlay: number;
  unit: 'dBu' | 'dBFS';
}

export interface LessonMeters {
  /** The master meter is reporting (audio running) */
  live: boolean;
  master: LessonMasterMeters;
  /** Mixer-device channels by input ('xone96:1' … 'xone96:4', 'xone96:a' … 'xone96:d') and studio strips ('strip:<instance>') */
  channels: Record<string, LessonChannelMeter>;
}

/** One finished REC take or bounce, measured live on the master meter */
export interface LessonTake {
  kind: 'rec' | 'bounce';
  /** Length of the music in it (transport time), seconds */
  seconds: number;
  /** Integrated loudness of the take (gated, from the master meter), LUFS */
  lufsI: number | null;
  /** Highest true peak in the take, dBTP */
  truePeakDb: number;
  /** Largest limiter gain reduction in the take, dB */
  maxGrDb: number;
  /** Stems recorded alongside the master (channel strips and returns) */
  stems: number;
  /** It played from bar 1 */
  fromStart: boolean;
  /** Bounce: it reached the end of the song (not cancelled) */
  complete: boolean;
  /** Song length when it was made, seconds (0 without song sections) */
  songSeconds: number;
  at: number;
}

export interface LessonBounceState {
  recording: boolean;
  bouncing: boolean;
  last?: LessonTake;
  /** Finished takes since the lesson started */
  count: number;
}

export interface LessonHistory {
  /** The control changed at least once since the lesson started (instance or device name) */
  changed(instance: string, control: string): boolean;
  /** A button was on at some point since the lesson started */
  wasOn(instance: string, control: string): boolean;
  /** Smallest / largest value a numeric control had since the lesson started, its starting value included */
  min(instance: string, control: string): number | undefined;
  max(instance: string, control: string): number | undefined;
}

/** Curriculum paths (LessonBrowser groups by them; the validator checks them) */
export const LESSON_PATHS = ['foundations', 'sound-design', 'sequencing', 'performance', 'studio', 'ear-training', 'producer'] as const;
export type LessonPath = (typeof LESSON_PATHS)[number];

export interface Lesson {
  id: string;
  device: string;  // Device ID
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  source: string;  // e.g., 'Moog DFAM Manual - Patch Ideas', 'Community', etc.
  author?: string;
  estimatedMinutes?: number;
  prerequisites?: string[];  // Other lesson IDs
  steps: LessonStep[];
  tags?: string[];  // e.g., ['kick', 'bass', 'percussion']
  concepts?: SynthConcept[];  // List of concepts taught in this lesson

  // ---- v2 -------------------------------------------------------------------
  /** Learning objective - "By the end you can ..." */
  objective?: string;
  /**
   * Curriculum path and order within it. 'producer' (v3) is the cross-instrument Producer
   * path (docs/research/producer-path/curriculum.md): studio lessons, device 'studio'.
   */
  path?: LessonPath;
  order?: number;
  /**
   * State applied at lesson start; the learner's own patch is kept and can be restored.
   * `studio` (v3, studio lessons): a whole studio to start from; the learner's studio is saved first.
   */
  start?: { values?: Record<string, ControlValue>; patches?: PatchConnection[]; reset?: boolean; data?: unknown; studio?: LessonStudioStart };
  /** Retrieval questions that join the spaced-review queue after the lesson */
  review?: MultipleChoice[];
  /** Studio lessons (device: 'studio'): instruments the lesson needs in the rack */
  requires?: string[];
}
