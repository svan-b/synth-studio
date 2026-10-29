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
  listen?: { a: Record<string, ControlValue>; b: Record<string, ControlValue>; labels?: [string, string]; question?: MultipleChoice };
  match?: {
    target: Record<string, ControlValue>;
    /** The controls the learner must get right (others are set from `target` before the step) */
    controls: string[];
    patches?: PatchConnection[];
    /** Allowed knob-travel error 0..1 (default 0.08) */
    tolerance?: number;
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
  transport: { playing: boolean; bpm: number };
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
}

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
  /** Curriculum path and order within it */
  path?: 'foundations' | 'sound-design' | 'sequencing' | 'performance' | 'studio' | 'ear-training';
  order?: number;
  /** State applied at lesson start; the learner's own patch is kept and can be restored */
  start?: { values?: Record<string, ControlValue>; patches?: PatchConnection[]; reset?: boolean; data?: unknown };
  /** Retrieval questions that join the spaced-review queue after the lesson */
  review?: MultipleChoice[];
  /** Studio lessons (device: 'studio'): instruments the lesson needs in the rack */
  requires?: string[];
}
