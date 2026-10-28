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
}
