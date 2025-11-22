export type ControlType = 'knob' | 'button' | 'switch' | 'fader' | 'step-button' | 'jack';
export type Units = 'Hz' | 'ms' | 'octaves' | '%' | 'dB' | 'semitones' | 'cents' | 'steps' | 'BPM';
export type KnobSize = 'small' | 'medium' | 'large';

export interface Position {
  x: number;
  y: number;
}

export interface ControlSpec {
  type: ControlType;
  position: Position;
  min: number;
  max: number;
  default: number;
  units: Units;
  bipolar?: boolean;
  label: string;
  size?: KnobSize;
  step?: number;
  options?: string[]; // for switches/selects
}

export interface DeviceSpec {
  name: string;
  manufacturer: string;
  width: number; // in pixels
  height: number; // in pixels
  controls: Record<string, ControlSpec>;
  presets: Record<string, PresetSpec>;
}

export interface PresetSpec {
  name: string;
  source: string; // "Manual page 9" or "Community"
  description: string;
  settings: Record<string, number | string>;
}

export interface LessonStep {
  control: string;
  targetValue: number | string;
  instruction: string;
  manualReference?: string;
}

export interface Lesson {
  device: string;
  name: string;
  description: string;
  source: string;
  steps: LessonStep[];
}

export interface StudioState {
  currentDevice: string;
  deviceSettings: Record<string, Record<string, number | string>>;
  currentLesson?: Lesson;
  currentStep: number;
  completedLessons: string[];
  isTeachingMode: boolean;
}

export interface KnobProps {
  id: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  bipolar?: boolean;
  units?: Units;
  size?: KnobSize;
  label: string;
  position?: Position;
  onChange: (value: number) => void;
  highlighted?: boolean;
  targetValue?: number;
  isCorrect?: boolean;
  showTarget?: boolean;
}

export interface ButtonProps {
  id: string;
  label: string;
  value: boolean;
  position?: Position;
  led?: boolean;
  ledColor?: string;
  onChange: (value: boolean) => void;
  highlighted?: boolean;
}

export interface SwitchProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  position?: Position;
  onChange: (value: string) => void;
  highlighted?: boolean;
}
