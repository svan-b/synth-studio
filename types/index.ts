// ============================================================================
// SYNTH STUDIO - Type Definitions
// Data-driven architecture for multi-device synthesizer learning platform
// ============================================================================

// ----------------------------------------------------------------------------
// Control Types
// ----------------------------------------------------------------------------

export type ControlType = 'knob' | 'button' | 'switch' | 'jack';
export type Units = 'Hz' | 'ms' | 'octaves' | '%' | 'dB' | 'semitones' | 'cents' | 'BPM' | 'V';
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
  curve?: 'linear' | 'logarithmic' | 'exponential';  // For audio params
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

export type ControlSpec = KnobSpec | SwitchSpec | ButtonSpec | JackSpec;

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

export interface LessonStep {
  control: string;  // Control ID
  targetValue: number | string | boolean;
  instruction: string;
  explanation?: string;  // Why this setting matters
  manualReference?: string;
  audioExample?: string;  // URL to audio demo
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
}

// ----------------------------------------------------------------------------
// Application State
// ----------------------------------------------------------------------------

export interface DeviceState {
  controlValues: Record<string, number | string | boolean>;
  patchConnections: PatchConnection[];
}

export interface StudioState {
  currentDevice: string;
  devices: Record<string, DeviceState>;
  currentLesson?: Lesson;
  currentStep: number;
  completedLessons: string[];
  isTeachingMode: boolean;
}

// ----------------------------------------------------------------------------
// Component Props (for UI components)
// ----------------------------------------------------------------------------

export interface KnobProps {
  id: string;
  spec: KnobSpec;
  value: number;
  onChange: (value: number) => void;
  highlighted?: boolean;
  targetValue?: number;
  showTarget?: boolean;
}

export interface SwitchProps {
  id: string;
  spec: SwitchSpec;
  value: number;  // Index into options
  onChange: (value: number) => void;
  highlighted?: boolean;
  targetValue?: number;
}

export interface ButtonProps {
  id: string;
  spec: ButtonSpec;
  value: boolean;
  onChange: (value: boolean) => void;
  highlighted?: boolean;
}

export interface JackProps {
  id: string;
  spec: JackSpec;
  isConnected: boolean;
  onConnect?: () => void;
  highlighted?: boolean;
}

// ----------------------------------------------------------------------------
// Device Registry (for multi-device support)
// ----------------------------------------------------------------------------

export interface DeviceRegistry {
  devices: Record<string, DeviceSpec>;
  getDevice: (id: string) => DeviceSpec | undefined;
  listDevices: () => { id: string; name: string; manufacturer: string }[];
}
